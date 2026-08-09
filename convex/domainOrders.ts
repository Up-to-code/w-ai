import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { evaluateRegistrarReserve } from "./domainFinance";
import { HOSTNAME_RE, requireOwner } from "./helpers";

const operationValidator = v.union(
  v.literal("registration"),
  v.literal("renewal"),
  v.literal("transfer"),
  v.literal("restoration"),
);

const providerValidator = v.union(
  v.literal("openprovider"),
  v.literal("domainee"),
);

const orderStateValidator = v.union(
  v.literal("quoted"),
  v.literal("payment_pending"),
  v.literal("payment_succeeded"),
  v.literal("fulfillment_pending"),
  v.literal("fulfilling"),
  v.literal("registered"),
  v.literal("routing"),
  v.literal("active"),
  v.literal("failed"),
  v.literal("refund_pending"),
  v.literal("refunded"),
  v.literal("cancelled"),
);

const paymentStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("refund_pending"),
  v.literal("refunded"),
  v.literal("disputed"),
);

const settlementStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("pending"),
  v.literal("settled"),
  v.literal("reversed"),
);

const providerStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const eventSourceValidator = v.union(
  v.literal("user"),
  v.literal("dodo"),
  v.literal("openprovider"),
  v.literal("domainee"),
  v.literal("system"),
);

const orderValidator = v.object({
  _id: v.id("domainOrders"),
  _creationTime: v.number(),
  orgId: v.id("organizations"),
  requestedByUserId: v.string(),
  hostname: v.string(),
  operation: operationValidator,
  provider: providerValidator,
  state: orderStateValidator,
  idempotencyKey: v.string(),
  customerCurrency: v.string(),
  customerAmountMinor: v.number(),
  providerCurrency: v.string(),
  providerAmountMinor: v.number(),
  platformMarkupMinor: v.number(),
  wholesaleAmountMinor: v.optional(v.number()),
  providerFeeMinor: v.optional(v.number()),
  fundingSnapshotId: v.optional(v.id("registrarFundingSnapshots")),
  registrarBalanceMinor: v.optional(v.number()),
  pendingProviderCommitmentsMinor: v.optional(v.number()),
  renewalReserveMinor: v.optional(v.number()),
  operationallyAvailableMinor: v.optional(v.number()),
  reserveCheckedAt: v.optional(v.number()),
  quoteExpiresAt: v.number(),
  paymentProvider: v.literal("dodo"),
  paymentStatus: paymentStatusValidator,
  paymentId: v.optional(v.string()),
  checkoutId: v.optional(v.string()),
  settlementStatus: v.optional(settlementStatusValidator),
  payoutId: v.optional(v.string()),
  settledAt: v.optional(v.number()),
  providerStatus: providerStatusValidator,
  providerOrderId: v.optional(v.string()),
  registrarDomainId: v.optional(v.string()),
  routingDomainId: v.optional(v.id("domains")),
  autoRenew: v.boolean(),
  registrationExpiresAt: v.optional(v.number()),
  failureCode: v.optional(v.string()),
  failureMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const FUNDING_SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
const LIVE_REGISTRATION_STATES = [
  "quoted",
  "payment_pending",
  "payment_succeeded",
  "fulfillment_pending",
  "fulfilling",
  "registered",
  "routing",
  "active",
  "refund_pending",
] as const satisfies readonly Doc<"domainOrders">["state"][];

const eventValidator = v.object({
  _id: v.id("domainOrderEvents"),
  _creationTime: v.number(),
  orgId: v.id("organizations"),
  orderId: v.id("domainOrders"),
  eventKey: v.string(),
  type: v.string(),
  source: eventSourceValidator,
  metadata: v.optional(v.any()),
  createdAt: v.number(),
});

function normalizeHostname(raw: string) {
  const hostname = raw.trim().toLowerCase().replace(/\.$/, "");
  if (hostname.length > 253 || !HOSTNAME_RE.test(hostname)) {
    throw new ConvexError("Enter a valid registrable hostname");
  }
  return hostname;
}

function normalizeCurrency(raw: string) {
  const currency = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ConvexError("Currency must be a three-letter ISO code");
  }
  return currency;
}

function assertMinorAmount(name: string, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new ConvexError(`${name} must be a non-negative integer`);
  }
}

async function getOrder(ctx: MutationCtx, orderId: Id<"domainOrders">) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new ConvexError("Domain order not found");
  return order;
}

async function eventWasProcessed(
  ctx: MutationCtx,
  orderId: Id<"domainOrders">,
  eventKey: string,
) {
  const event = await ctx.db
    .query("domainOrderEvents")
    .withIndex("by_event_key", (q) => q.eq("eventKey", eventKey))
    .first();
  if (!event) return false;
  if (event.orderId !== orderId) {
    throw new ConvexError("Event key is already assigned to another order");
  }
  return true;
}

async function appendEvent(
  ctx: MutationCtx,
  order: Doc<"domainOrders">,
  args: {
    eventKey: string;
    type: string;
    source: Doc<"domainOrderEvents">["source"];
    metadata?: unknown;
  },
) {
  const existing = await ctx.db
    .query("domainOrderEvents")
    .withIndex("by_event_key", (q) => q.eq("eventKey", args.eventKey))
    .first();
  if (existing) {
    if (existing.orderId !== order._id) {
      throw new ConvexError("Event key is already assigned to another order");
    }
    return;
  }
  await ctx.db.insert("domainOrderEvents", {
    orgId: order.orgId,
    orderId: order._id,
    eventKey: args.eventKey,
    type: args.type,
    source: args.source,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}

function assertOpenOrder(order: Doc<"domainOrders">) {
  if (["refunded", "cancelled", "active"].includes(order.state)) {
    throw new ConvexError(`Order is already ${order.state}`);
  }
}

/** Owner-only financial history. Registration checkout remains disabled. */
export const list = query({
  args: { orgId: v.id("organizations"), limit: v.optional(v.number()) },
  returns: v.array(orderValidator),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.orgId);
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 50), 100));
    return ctx.db
      .query("domainOrders")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { orgId: v.id("organizations"), orderId: v.id("domainOrders") },
  returns: v.union(
    v.null(),
    v.object({
      order: orderValidator,
      events: v.array(eventValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.orgId);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.orgId !== args.orgId) return null;
    const events = await ctx.db
      .query("domainOrderEvents")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .take(200);
    return { order, events };
  },
});

/**
 * Explicit public guardrail. This makes the current product boundary visible
 * to clients while registration is deferred; it never writes or spends.
 */
export const purchasingStatus = query({
  args: {},
  returns: v.object({ enabled: v.boolean(), reason: v.string() }),
  handler: async () => ({
    enabled: false,
    reason:
      "Domain registration is planned; bring-your-own domains are available now.",
  }),
});

/** Future provider actions create short-lived quotes through this mutation. */
export const createQuote = internalMutation({
  args: {
    orgId: v.id("organizations"),
    requestedByUserId: v.string(),
    hostname: v.string(),
    operation: operationValidator,
    provider: providerValidator,
    idempotencyKey: v.string(),
    eventKey: v.string(),
    customerCurrency: v.string(),
    customerAmountMinor: v.number(),
    providerCurrency: v.string(),
    providerAmountMinor: v.number(),
    platformMarkupMinor: v.number(),
    wholesaleAmountMinor: v.optional(v.number()),
    providerFeeMinor: v.optional(v.number()),
    quoteExpiresAt: v.number(),
    autoRenew: v.boolean(),
  },
  returns: v.id("domainOrders"),
  handler: async (ctx, args) => {
    const hostname = normalizeHostname(args.hostname);
    const customerCurrency = normalizeCurrency(args.customerCurrency);
    const providerCurrency = normalizeCurrency(args.providerCurrency);
    const idempotencyKey = args.idempotencyKey.trim();
    const eventKey = args.eventKey.trim();
    if (!idempotencyKey) {
      throw new ConvexError("Idempotency key is required");
    }
    if (!eventKey) {
      throw new ConvexError("Quote event key is required");
    }
    assertMinorAmount("Customer amount", args.customerAmountMinor);
    assertMinorAmount("Provider amount", args.providerAmountMinor);
    assertMinorAmount("Platform markup", args.platformMarkupMinor);
    if (args.wholesaleAmountMinor !== undefined) {
      assertMinorAmount("Wholesale amount", args.wholesaleAmountMinor);
    }
    if (args.providerFeeMinor !== undefined) {
      assertMinorAmount("Provider fee", args.providerFeeMinor);
    }
    if (args.quoteExpiresAt <= Date.now()) {
      throw new ConvexError("Quote must expire in the future");
    }

    const existing = await ctx.db
      .query("domainOrders")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", idempotencyKey),
      )
      .first();
    if (existing) {
      const exactReplay =
        existing.orgId === args.orgId &&
        existing.requestedByUserId === args.requestedByUserId &&
        existing.hostname === hostname &&
        existing.operation === args.operation &&
        existing.provider === args.provider &&
        existing.customerCurrency === customerCurrency &&
        existing.customerAmountMinor === args.customerAmountMinor &&
        existing.providerCurrency === providerCurrency &&
        existing.providerAmountMinor === args.providerAmountMinor &&
        existing.platformMarkupMinor === args.platformMarkupMinor &&
        existing.wholesaleAmountMinor === args.wholesaleAmountMinor &&
        existing.providerFeeMinor === args.providerFeeMinor &&
        existing.quoteExpiresAt === args.quoteExpiresAt &&
        existing.autoRenew === args.autoRenew;
      if (!exactReplay) {
        throw new ConvexError(
          "Idempotency key is already assigned to a different domain quote",
        );
      }
      return existing._id;
    }

    if (args.operation === "registration") {
      for (const state of LIVE_REGISTRATION_STATES) {
        const reservation = await ctx.db
          .query("domainOrders")
          .withIndex("by_hostname_operation_state_and_quote_expiry", (q) => {
            const byState = q
              .eq("hostname", hostname)
              .eq("operation", "registration")
              .eq("state", state);
            return state === "quoted" || state === "payment_pending"
              ? byState.gt("quoteExpiresAt", Date.now())
              : byState;
          })
          .first();
        if (reservation) {
          throw new ConvexError(
            "Domain already has an active registration order",
          );
        }
      }
    }

    const now = Date.now();
    const orderId = await ctx.db.insert("domainOrders", {
      orgId: args.orgId,
      requestedByUserId: args.requestedByUserId,
      hostname,
      operation: args.operation,
      provider: args.provider,
      state: "quoted",
      idempotencyKey,
      customerCurrency,
      customerAmountMinor: args.customerAmountMinor,
      providerCurrency,
      providerAmountMinor: args.providerAmountMinor,
      platformMarkupMinor: args.platformMarkupMinor,
      wholesaleAmountMinor: args.wholesaleAmountMinor,
      providerFeeMinor: args.providerFeeMinor,
      quoteExpiresAt: args.quoteExpiresAt,
      paymentProvider: "dodo",
      paymentStatus: "not_started",
      settlementStatus: "not_started",
      providerStatus: "not_started",
      autoRenew: args.autoRenew,
      createdAt: now,
      updatedAt: now,
    });
    const order = (await ctx.db.get(orderId))!;
    await appendEvent(ctx, order, {
      eventKey,
      type: "quote.created",
      source: "system",
      metadata: {
        provider: args.provider,
        quoteExpiresAt: args.quoteExpiresAt,
      },
    });
    return orderId;
  },
});

export const recordPaymentPending = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    checkoutId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    assertOpenOrder(order);
    if (order.state !== "quoted" && order.state !== "payment_pending") {
      throw new ConvexError("Order is not ready for checkout");
    }
    if (order.quoteExpiresAt <= Date.now()) {
      throw new ConvexError("Domain quote expired before checkout started");
    }
    if (!args.checkoutId.trim()) {
      throw new ConvexError("Checkout ID is required");
    }
    if (order.checkoutId && order.checkoutId !== args.checkoutId) {
      throw new ConvexError("Order is already assigned to another checkout");
    }
    await ctx.db.patch(order._id, {
      state: "payment_pending",
      paymentStatus: "pending",
      checkoutId: args.checkoutId,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "payment.pending",
      source: "dodo",
      metadata: { checkoutId: args.checkoutId },
    });
    return true;
  },
});

export const recordPaymentSucceeded = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    paymentId: v.string(),
    checkoutId: v.string(),
    customerCurrency: v.string(),
    customerAmountMinor: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    assertOpenOrder(order);
    const paymentOrder = await ctx.db
      .query("domainOrders")
      .withIndex("by_payment_id", (q) => q.eq("paymentId", args.paymentId))
      .first();
    if (paymentOrder && paymentOrder._id !== order._id) {
      throw new ConvexError("Payment is already assigned to another order");
    }
    if (
      order.state !== "payment_pending" ||
      order.paymentStatus !== "pending" ||
      !order.checkoutId
    ) {
      throw new ConvexError(
        "Payment success requires the order's recorded checkout",
      );
    }
    if (args.checkoutId !== order.checkoutId) {
      throw new ConvexError("Payment checkout does not match the domain order");
    }
    if (normalizeCurrency(args.customerCurrency) !== order.customerCurrency) {
      throw new ConvexError("Payment currency does not match the domain quote");
    }
    assertMinorAmount("Payment amount", args.customerAmountMinor);
    if (args.customerAmountMinor !== order.customerAmountMinor) {
      throw new ConvexError("Payment amount does not match the domain quote");
    }
    const quoteExpired = order.quoteExpiresAt <= Date.now();
    await ctx.db.patch(order._id, {
      state: quoteExpired ? "refund_pending" : "payment_succeeded",
      paymentStatus: quoteExpired ? "refund_pending" : "succeeded",
      settlementStatus: "pending",
      paymentId: args.paymentId,
      failureCode: quoteExpired ? "quote_expired_after_payment" : undefined,
      failureMessage: quoteExpired
        ? "Payment arrived after the authoritative registrar quote expired"
        : undefined,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "payment.succeeded",
      source: "dodo",
      metadata: {
        paymentId: args.paymentId,
        checkoutId: args.checkoutId,
        customerCurrency: order.customerCurrency,
        customerAmountMinor: order.customerAmountMinor,
        quoteExpired,
      },
    });
    return true;
  },
});

/**
 * Records Dodo's later merchant payout. This never queues registrar spending:
 * Openprovider fulfillment is funded from the platform's separate reserve.
 */
export const recordSettlementSucceeded = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    payoutId: v.string(),
    settledAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (
      !order.paymentId ||
      !["succeeded", "refund_pending", "refunded", "disputed"].includes(
        order.paymentStatus,
      )
    ) {
      throw new ConvexError(
        "A customer payment is required before payout settlement",
      );
    }
    if (order.settlementStatus === "reversed") {
      throw new ConvexError("A reversed payout cannot be settled again");
    }
    if (!args.payoutId.trim()) {
      throw new ConvexError("Payout ID is required");
    }
    if (!Number.isSafeInteger(args.settledAt) || args.settledAt <= 0) {
      throw new ConvexError("Settlement time is invalid");
    }
    await ctx.db.patch(order._id, {
      settlementStatus: "settled",
      payoutId: args.payoutId,
      settledAt: args.settledAt,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "payout.settled",
      source: "dodo",
      metadata: { payoutId: args.payoutId, settledAt: args.settledAt },
    });
    return true;
  },
});

/** Records a Dodo payout reversal without rewriting customer-payment history. */
export const recordSettlementReversed = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    payoutId: v.optional(v.string()),
    reason: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (
      !order.paymentId ||
      !["succeeded", "refund_pending", "refunded", "disputed"].includes(
        order.paymentStatus,
      )
    ) {
      throw new ConvexError(
        "A customer payment is required before payout reversal",
      );
    }
    if (!args.reason.trim()) {
      throw new ConvexError("A payout reversal reason is required");
    }
    await ctx.db.patch(order._id, {
      settlementStatus: "reversed",
      payoutId: args.payoutId ?? order.payoutId,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "payout.reversed",
      source: "dodo",
      metadata: {
        payoutId: args.payoutId ?? order.payoutId,
        reason: args.reason,
      },
    });
    return true;
  },
});

export const recordPaymentFailed = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    paymentId: v.optional(v.string()),
    failureCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (order.paymentStatus === "succeeded") {
      throw new ConvexError(
        "A succeeded payment cannot be overwritten as failed",
      );
    }
    if (["cancelled", "refunded", "active"].includes(order.state)) {
      throw new ConvexError(`Order is already ${order.state}`);
    }
    await ctx.db.patch(order._id, {
      state: "failed",
      paymentStatus: "failed",
      paymentId: args.paymentId,
      failureCode: args.failureCode,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "payment.failed",
      source: "dodo",
      metadata: { paymentId: args.paymentId, failureCode: args.failureCode },
    });
    return true;
  },
});

export const queueFulfillment = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    fundingSnapshotId: v.id("registrarFundingSnapshots"),
    renewalReserveMinor: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (order.paymentStatus !== "succeeded") {
      throw new ConvexError("Registrar fulfillment requires a cleared payment");
    }
    if (!["payment_succeeded", "fulfillment_pending"].includes(order.state)) {
      throw new ConvexError(
        "Order cannot enter fulfillment from its current state",
      );
    }
    if (order.quoteExpiresAt <= Date.now()) {
      throw new ConvexError(
        "Registrar quote expired before fulfillment; re-price or refund the order",
      );
    }
    if (order.provider !== "openprovider") {
      throw new ConvexError(
        "This funding snapshot boundary only supports Openprovider orders",
      );
    }
    const funding = await ctx.db.get(args.fundingSnapshotId);
    if (!funding || funding.provider !== order.provider) {
      throw new ConvexError(
        "Registrar funding snapshot does not match the order",
      );
    }
    if (funding.currency !== order.providerCurrency) {
      throw new ConvexError(
        "Registrar funding currency does not match the provider quote",
      );
    }
    const now = Date.now();
    if (
      funding.fetchedAt > now + 30_000 ||
      now - funding.fetchedAt > FUNDING_SNAPSHOT_MAX_AGE_MS
    ) {
      throw new ConvexError(
        "Registrar funding snapshot is stale; refresh it before fulfillment",
      );
    }
    assertMinorAmount("Renewal reserve", args.renewalReserveMinor);
    const pendingByState = await Promise.all(
      (["fulfillment_pending", "fulfilling"] as const).map((state) =>
        ctx.db
          .query("domainOrders")
          .withIndex("by_state", (query) => query.eq("state", state))
          .take(501),
      ),
    );
    if (pendingByState.some((orders) => orders.length > 500)) {
      throw new ConvexError(
        "Too many pending registrar commitments to evaluate safely",
      );
    }
    const pendingProviderCommitmentsMinor = pendingByState
      .flat()
      .filter(
        (pending) =>
          pending._id !== order._id &&
          pending.provider === order.provider &&
          pending.providerCurrency === order.providerCurrency,
      )
      .reduce((total, pending) => total + pending.providerAmountMinor, 0);
    assertMinorAmount(
      "Pending provider commitments",
      pendingProviderCommitmentsMinor,
    );
    const reserve = evaluateRegistrarReserve({
      registrarBalanceMinor: funding.availableBalanceMinor,
      pendingProviderCommitmentsMinor,
      renewalReserveMinor: args.renewalReserveMinor,
      requestedProviderCostMinor: order.providerAmountMinor,
      customerPaidUnsettledMinor:
        order.settlementStatus === "settled" ? 0 : order.customerAmountMinor,
    });
    if (!reserve.canFulfill) {
      throw new ConvexError(
        `Registrar reserve is short by ${reserve.shortfallMinor} minor units`,
      );
    }
    const reserveCheckedAt = now;
    await ctx.db.patch(order._id, {
      state: "fulfillment_pending",
      fundingSnapshotId: funding._id,
      registrarBalanceMinor: funding.availableBalanceMinor,
      pendingProviderCommitmentsMinor,
      renewalReserveMinor: args.renewalReserveMinor,
      operationallyAvailableMinor: reserve.operationallyAvailableMinor,
      reserveCheckedAt,
      updatedAt: reserveCheckedAt,
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "fulfillment.queued",
      source: "system",
      metadata: {
        requestedProviderCostMinor: order.providerAmountMinor,
        fundingSnapshotId: funding._id,
        registrarBalanceMinor: funding.availableBalanceMinor,
        registrarReservedBalanceMinor: funding.reservedBalanceMinor,
        pendingProviderCommitmentsMinor,
        renewalReserveMinor: args.renewalReserveMinor,
        operationallyAvailableMinor: reserve.operationallyAvailableMinor,
        customerPaidUnsettledMinor: reserve.customerPaidUnsettledMinor,
      },
    });
    return true;
  },
});

export const recordProviderPending = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    providerOrderId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (order.paymentStatus !== "succeeded") {
      throw new ConvexError("Registrar fulfillment requires a cleared payment");
    }
    if (order.state !== "fulfillment_pending" && order.state !== "fulfilling") {
      throw new ConvexError("Order is not queued for registrar fulfillment");
    }
    const providerOrderId = args.providerOrderId.trim();
    if (!providerOrderId) {
      throw new ConvexError("Provider order ID is required");
    }
    if (order.providerOrderId && order.providerOrderId !== providerOrderId) {
      throw new ConvexError(
        "Order is already linked to another provider order",
      );
    }
    const linkedOrder = await ctx.db
      .query("domainOrders")
      .withIndex("by_provider_and_order_id", (q) =>
        q.eq("provider", order.provider).eq("providerOrderId", providerOrderId),
      )
      .first();
    if (linkedOrder && linkedOrder._id !== order._id) {
      throw new ConvexError(
        "Provider order is already assigned to another domain order",
      );
    }
    await ctx.db.patch(order._id, {
      state: "fulfilling",
      providerStatus: "pending",
      providerOrderId,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "provider.pending",
      source: order.provider,
      metadata: { providerOrderId },
    });
    return true;
  },
});

export const recordProviderSucceeded = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    registrarDomainId: v.string(),
    registrationExpiresAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (order.paymentStatus !== "succeeded") {
      throw new ConvexError(
        "A paid order is required before registration succeeds",
      );
    }
    if (order.state !== "fulfilling" && order.state !== "registered") {
      throw new ConvexError("Order is not being fulfilled");
    }
    if (!order.providerOrderId) {
      throw new ConvexError(
        "Provider success requires the recorded provider order",
      );
    }
    const registrarDomainId = args.registrarDomainId.trim();
    if (!registrarDomainId) {
      throw new ConvexError("Registrar domain ID is required");
    }
    if (
      order.registrarDomainId &&
      order.registrarDomainId !== registrarDomainId
    ) {
      throw new ConvexError(
        "Order is already linked to another registrar domain",
      );
    }
    const linkedDomainOrder = await ctx.db
      .query("domainOrders")
      .withIndex("by_provider_and_domain_id", (q) =>
        q
          .eq("provider", order.provider)
          .eq("registrarDomainId", registrarDomainId),
      )
      .first();
    if (linkedDomainOrder && linkedDomainOrder._id !== order._id) {
      throw new ConvexError(
        "Registrar domain is already assigned to another domain order",
      );
    }
    if (
      !Number.isSafeInteger(args.registrationExpiresAt) ||
      args.registrationExpiresAt <= Date.now()
    ) {
      throw new ConvexError("Registration expiration must be in the future");
    }
    await ctx.db.patch(order._id, {
      state: "registered",
      providerStatus: "succeeded",
      registrarDomainId,
      registrationExpiresAt: args.registrationExpiresAt,
      failureCode: undefined,
      failureMessage: undefined,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "provider.succeeded",
      source: order.provider,
      metadata: {
        registrarDomainId,
        registrationExpiresAt: args.registrationExpiresAt,
      },
    });
    return true;
  },
});

export const recordProviderFailed = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    failureCode: v.string(),
    failureMessage: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    assertOpenOrder(order);
    if (order.state !== "fulfillment_pending" && order.state !== "fulfilling") {
      throw new ConvexError("Only an in-flight registrar order can fail");
    }
    const needsRefund = order.paymentStatus === "succeeded";
    await ctx.db.patch(order._id, {
      state: needsRefund ? "refund_pending" : "failed",
      paymentStatus: needsRefund ? "refund_pending" : order.paymentStatus,
      providerStatus: "failed",
      failureCode: args.failureCode,
      failureMessage: args.failureMessage,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "provider.failed",
      source: order.provider,
      metadata: { failureCode: args.failureCode },
    });
    return true;
  },
});

export const recordRoutingStarted = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    domainId: v.id("domains"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (order.providerStatus !== "succeeded" || order.state !== "registered") {
      throw new ConvexError("Registration must succeed before routing starts");
    }
    const domain = await ctx.db.get(args.domainId);
    if (
      !domain ||
      domain.orgId !== order.orgId ||
      domain.hostname !== order.hostname
    ) {
      throw new ConvexError(
        "Routing domain does not match the registered order",
      );
    }
    await ctx.db.patch(order._id, {
      state: "routing",
      routingDomainId: domain._id,
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "routing.started",
      source: "system",
      metadata: { domainId: domain._id },
    });
    return true;
  },
});

export const recordActivated = internalMutation({
  args: { orderId: v.id("domainOrders"), eventKey: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (order.state !== "routing" || !order.routingDomainId) {
      throw new ConvexError("Order is not waiting for domain routing");
    }
    const domain = await ctx.db.get(order.routingDomainId);
    if (
      !domain ||
      domain.orgId !== order.orgId ||
      domain.hostname !== order.hostname
    ) {
      throw new ConvexError("Routing domain no longer matches the order");
    }
    if (
      !domain.verified ||
      domain.platformVerified !== true ||
      domain.tlsStatus !== "active"
    ) {
      throw new ConvexError(
        "The domain's DNS ownership, routing, Vercel project status, and TLS certificate are not verified",
      );
    }
    await ctx.db.patch(domain._id, {
      registrarProvider: order.provider,
      registrarDomainId: order.registrarDomainId,
      registrationStatus: "active",
      registrationExpiresAt: order.registrationExpiresAt,
      autoRenew: order.autoRenew,
      ownershipModel: "customer_registrant",
    });
    await ctx.db.patch(order._id, { state: "active", updatedAt: Date.now() });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "order.active",
      source: "system",
      metadata: { domainId: domain._id },
    });
    return true;
  },
});

export const recordRefunded = internalMutation({
  args: {
    orderId: v.id("domainOrders"),
    eventKey: v.string(),
    refundId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await eventWasProcessed(ctx, args.orderId, args.eventKey)) return false;
    const order = await getOrder(ctx, args.orderId);
    if (
      order.paymentStatus !== "refund_pending" &&
      order.state !== "refunded"
    ) {
      throw new ConvexError("Order is not awaiting a refund");
    }
    await ctx.db.patch(order._id, {
      state: "refunded",
      paymentStatus: "refunded",
      updatedAt: Date.now(),
    });
    await appendEvent(ctx, order, {
      eventKey: args.eventKey,
      type: "payment.refunded",
      source: "dodo",
      metadata: { refundId: args.refundId },
    });
    return true;
  },
});

/** No spend: an owner may only cancel before customer payment succeeds. */
export const cancelUnpaid = mutation({
  args: { orgId: v.id("organizations"), orderId: v.id("domainOrders") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.orgId);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.orgId !== args.orgId) {
      throw new ConvexError("Domain order not found");
    }
    if (order.paymentStatus === "succeeded") {
      throw new ConvexError("A paid order cannot be cancelled directly");
    }
    if (order.state === "cancelled") return false;
    if (!["quoted", "payment_pending", "failed"].includes(order.state)) {
      throw new ConvexError("Order cannot be cancelled from its current state");
    }
    const now = Date.now();
    await ctx.db.patch(order._id, { state: "cancelled", updatedAt: now });
    await appendEvent(ctx, order, {
      eventKey: `cancel:${order._id}:${now}`,
      type: "order.cancelled",
      source: "user",
    });
    return true;
  },
});
