import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const NOW = new Date("2026-08-09T12:00:00.000Z").getTime();

async function seedOrg(t: ReturnType<typeof convexTest>, suffix = "test") {
  return t.run(async (ctx) =>
    ctx.db.insert("organizations", {
      name: `${suffix} Bakery`,
      slug: `${suffix}-bakery`,
      plan: "pro",
      status: "active",
      createdAt: NOW,
    }),
  );
}

async function seedFundingSnapshot(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<{
    currency: string;
    availableBalanceMinor: number;
    reservedBalanceMinor: number;
    fetchedAt: number;
  }> = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert("registrarFundingSnapshots", {
      provider: "openprovider",
      environment: "production",
      accountHash: "test-account",
      currency: overrides.currency ?? "USD",
      availableBalanceMinor: overrides.availableBalanceMinor ?? 10_000,
      reservedBalanceMinor: overrides.reservedBalanceMinor ?? 0,
      currencyMinorUnit: 2,
      fetchedAt: overrides.fetchedAt ?? NOW,
      createdAt: NOW,
    }),
  );
}

async function fundedReserve(t: ReturnType<typeof convexTest>) {
  return {
    fundingSnapshotId: await seedFundingSnapshot(t),
    renewalReserveMinor: 2_000,
  };
}

async function createQuote(
  t: ReturnType<typeof convexTest>,
  orgId: Id<"organizations">,
  overrides: Partial<{
    hostname: string;
    idempotencyKey: string;
    eventKey: string;
    quoteExpiresAt: number;
  }> = {},
) {
  return t.mutation(internal.domainOrders.createQuote, {
    orgId,
    requestedByUserId: "user_test",
    hostname: overrides.hostname ?? "bakery.example",
    operation: "registration",
    provider: "openprovider",
    idempotencyKey: overrides.idempotencyKey ?? "order_001",
    eventKey: overrides.eventKey ?? "quote_001",
    customerCurrency: "USD",
    customerAmountMinor: 1800,
    providerCurrency: "USD",
    providerAmountMinor: 1400,
    platformMarkupMinor: 400,
    wholesaleAmountMinor: 1400,
    providerFeeMinor: 0,
    quoteExpiresAt: overrides.quoteExpiresAt ?? NOW + 15 * 60_000,
    autoRenew: true,
  });
}

async function recordSuccessfulPayment(
  t: ReturnType<typeof convexTest>,
  orderId: Id<"domainOrders">,
  args: { eventKey: string; paymentId: string },
) {
  const checkoutId = `checkout:${args.paymentId}`;
  await t.mutation(internal.domainOrders.recordPaymentPending, {
    orderId,
    eventKey: `pending:${args.eventKey}`,
    checkoutId,
  });
  return t.mutation(internal.domainOrders.recordPaymentSucceeded, {
    orderId,
    eventKey: args.eventKey,
    paymentId: args.paymentId,
    checkoutId,
    customerCurrency: "USD",
    customerAmountMinor: 1800,
  });
}

describe("domain order lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates quote creation and Dodo payment webhooks", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const firstOrderId = await createQuote(t, orgId);
    const retriedOrderId = await createQuote(t, orgId, {
      eventKey: "quote_retry_should_not_write",
    });

    expect(retriedOrderId).toBe(firstOrderId);

    await t.mutation(internal.domainOrders.recordPaymentPending, {
      orderId: firstOrderId,
      eventKey: "dodo_checkout_001",
      checkoutId: "checkout_001",
    });
    const firstDelivery = await t.mutation(
      internal.domainOrders.recordPaymentSucceeded,
      {
        orderId: firstOrderId,
        eventKey: "dodo_webhook_001",
        paymentId: "payment_001",
        checkoutId: "checkout_001",
        customerCurrency: "USD",
        customerAmountMinor: 1800,
      },
    );
    const duplicateDelivery = await t.mutation(
      internal.domainOrders.recordPaymentSucceeded,
      {
        orderId: firstOrderId,
        eventKey: "dodo_webhook_001",
        paymentId: "payment_001",
        checkoutId: "checkout_001",
        customerCurrency: "USD",
        customerAmountMinor: 1800,
      },
    );

    expect(firstDelivery).toBe(true);
    expect(duplicateDelivery).toBe(false);
    const snapshot = await t.run(async (ctx) => ({
      orders: await ctx.db.query("domainOrders").collect(),
      events: await ctx.db.query("domainOrderEvents").collect(),
    }));
    expect(snapshot.orders).toHaveLength(1);
    expect(snapshot.orders[0]).toMatchObject({
      state: "payment_succeeded",
      paymentStatus: "succeeded",
      settlementStatus: "pending",
      paymentId: "payment_001",
    });
    expect(snapshot.events.map((event) => event.type)).toEqual([
      "quote.created",
      "payment.pending",
      "payment.succeeded",
    ]);
  });

  it("accepts only an exact replay for a quote idempotency key", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId, {
      idempotencyKey: "quote_identity",
      eventKey: "quote_identity_created",
    });

    await expect(
      createQuote(t, orgId, {
        hostname: "different.example",
        idempotencyKey: "quote_identity",
        eventKey: "quote_identity_mismatch",
      }),
    ).rejects.toThrow("different domain quote");

    const snapshot = await t.run(async (ctx) => ({
      orders: await ctx.db.query("domainOrders").collect(),
      events: await ctx.db.query("domainOrderEvents").collect(),
    }));
    expect(snapshot.orders.map((order) => order._id)).toEqual([orderId]);
    expect(snapshot.events.map((event) => event.eventKey)).toEqual([
      "quote_identity_created",
    ]);
  });

  it("reserves one live registration order per hostname across tenants", async () => {
    const t = convexTest(schema, modules);
    const firstOrgId = await seedOrg(t, "first");
    const secondOrgId = await seedOrg(t, "second");
    await createQuote(t, firstOrgId, {
      hostname: "reserved.example",
      idempotencyKey: "reserved_first",
      eventKey: "reserved_first_quote",
      quoteExpiresAt: NOW + 1_000,
    });

    await expect(
      createQuote(t, secondOrgId, {
        hostname: "reserved.example",
        idempotencyKey: "reserved_second_too_early",
        eventKey: "reserved_second_too_early_quote",
        quoteExpiresAt: NOW + 2_000,
      }),
    ).rejects.toThrow("active registration order");

    vi.setSystemTime(NOW + 1_001);
    const replacementId = await createQuote(t, secondOrgId, {
      hostname: "reserved.example",
      idempotencyKey: "reserved_second_after_expiry",
      eventKey: "reserved_second_after_expiry_quote",
      quoteExpiresAt: NOW + 5_000,
    });
    expect(await t.run((ctx) => ctx.db.get(replacementId))).toMatchObject({
      orgId: secondOrgId,
      hostname: "reserved.example",
      state: "quoted",
    });
  });

  it("keeps a paid hostname reserved even after its quote expires", async () => {
    const t = convexTest(schema, modules);
    const firstOrgId = await seedOrg(t, "paid-first");
    const secondOrgId = await seedOrg(t, "paid-second");
    const orderId = await createQuote(t, firstOrgId, {
      hostname: "paid-reserved.example",
      idempotencyKey: "paid_reserved_first",
      eventKey: "paid_reserved_first_quote",
      quoteExpiresAt: NOW + 1_000,
    });
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "paid_reserved_payment",
      paymentId: "paid_reserved_payment",
    });

    vi.setSystemTime(NOW + 1_001);
    await expect(
      createQuote(t, secondOrgId, {
        hostname: "paid-reserved.example",
        idempotencyKey: "paid_reserved_second",
        eventKey: "paid_reserved_second_quote",
        quoteExpiresAt: NOW + 5_000,
      }),
    ).rejects.toThrow("active registration order");
  });

  it("binds payment success to the recorded checkout, amount, and currency", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);

    await expect(
      t.mutation(internal.domainOrders.recordPaymentSucceeded, {
        orderId,
        eventKey: "payment_without_checkout",
        paymentId: "payment_without_checkout",
        checkoutId: "checkout_missing",
        customerCurrency: "USD",
        customerAmountMinor: 1800,
      }),
    ).rejects.toThrow("recorded checkout");

    await t.mutation(internal.domainOrders.recordPaymentPending, {
      orderId,
      eventKey: "payment_identity_checkout",
      checkoutId: "checkout_expected",
    });

    await expect(
      t.mutation(internal.domainOrders.recordPaymentSucceeded, {
        orderId,
        eventKey: "payment_wrong_checkout",
        paymentId: "payment_wrong_checkout",
        checkoutId: "checkout_other",
        customerCurrency: "USD",
        customerAmountMinor: 1800,
      }),
    ).rejects.toThrow("checkout does not match");
    await expect(
      t.mutation(internal.domainOrders.recordPaymentSucceeded, {
        orderId,
        eventKey: "payment_wrong_currency",
        paymentId: "payment_wrong_currency",
        checkoutId: "checkout_expected",
        customerCurrency: "EUR",
        customerAmountMinor: 1800,
      }),
    ).rejects.toThrow("currency does not match");
    await expect(
      t.mutation(internal.domainOrders.recordPaymentSucceeded, {
        orderId,
        eventKey: "payment_wrong_amount",
        paymentId: "payment_wrong_amount",
        checkoutId: "checkout_expected",
        customerCurrency: "USD",
        customerAmountMinor: 1799,
      }),
    ).rejects.toThrow("amount does not match");

    const unchangedOrder = await t.run((ctx) => ctx.db.get(orderId));
    expect(unchangedOrder).toMatchObject({
      state: "payment_pending",
      paymentStatus: "pending",
      checkoutId: "checkout_expected",
    });
    expect(unchangedOrder?.paymentId).toBeUndefined();
  });

  it("does not start or replace checkout after the quote boundary", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId, {
      quoteExpiresAt: NOW + 1_000,
    });
    await t.mutation(internal.domainOrders.recordPaymentPending, {
      orderId,
      eventKey: "first_checkout",
      checkoutId: "checkout_first",
    });
    await expect(
      t.mutation(internal.domainOrders.recordPaymentPending, {
        orderId,
        eventKey: "replacement_checkout",
        checkoutId: "checkout_replacement",
      }),
    ).rejects.toThrow("already assigned");

    const expiredOrderId = await createQuote(t, orgId, {
      hostname: "expired-checkout.example",
      idempotencyKey: "expired_before_checkout",
      eventKey: "expired_before_checkout_quote",
      quoteExpiresAt: NOW + 1_000,
    });
    vi.setSystemTime(NOW + 2_000);
    await expect(
      t.mutation(internal.domainOrders.recordPaymentPending, {
        orderId: expiredOrderId,
        eventKey: "expired_checkout",
        checkoutId: "checkout_expired",
      }),
    ).rejects.toThrow("quote expired");
  });

  it("sends a late payment to refund instead of buying at an expired price", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId, {
      quoteExpiresAt: NOW + 1_000,
    });
    const reserve = await fundedReserve(t);

    await t.mutation(internal.domainOrders.recordPaymentPending, {
      orderId,
      eventKey: "dodo_late_checkout",
      checkoutId: "checkout:payment_late",
    });

    vi.setSystemTime(NOW + 2_000);
    await t.mutation(internal.domainOrders.recordPaymentSucceeded, {
      orderId,
      eventKey: "dodo_late_payment",
      paymentId: "payment_late",
      checkoutId: "checkout:payment_late",
      customerCurrency: "USD",
      customerAmountMinor: 1800,
    });

    const order = (await t.run((ctx) =>
      ctx.db.get(orderId),
    )) as Doc<"domainOrders"> | null;
    expect(order).toMatchObject({
      state: "refund_pending",
      paymentStatus: "refund_pending",
      providerStatus: "not_started",
      failureCode: "quote_expired_after_payment",
    });
    await expect(
      t.mutation(internal.domainOrders.queueFulfillment, {
        orderId,
        eventKey: "must_not_fulfill",
        ...reserve,
      }),
    ).rejects.toThrow("cleared payment");
  });

  it("does not queue a paid order after its registrar quote expires", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId, {
      quoteExpiresAt: NOW + 1_000,
    });
    const reserve = await fundedReserve(t);
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid_while_quote_valid",
      paymentId: "payment_before_expiry",
    });

    vi.setSystemTime(NOW + 2_000);
    await expect(
      t.mutation(internal.domainOrders.queueFulfillment, {
        orderId,
        eventKey: "stale_quote_must_not_fulfill",
        ...reserve,
      }),
    ).rejects.toThrow("quote expired");

    expect(await t.run((ctx) => ctx.db.get(orderId))).toMatchObject({
      state: "payment_succeeded",
      providerStatus: "not_started",
    });
  });

  it("never counts an unsettled customer payment as registrar funding", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid_but_not_settled",
      paymentId: "payment_receivable_only",
    });
    const fundingSnapshotId = await seedFundingSnapshot(t, {
      availableBalanceMinor: 1_500,
    });

    await expect(
      t.mutation(internal.domainOrders.queueFulfillment, {
        orderId,
        eventKey: "insufficient_reserve",
        fundingSnapshotId,
        renewalReserveMinor: 500,
      }),
    ).rejects.toThrow("short by 400 minor units");

    const order = (await t.run((ctx) =>
      ctx.db.get(orderId),
    )) as Doc<"domainOrders"> | null;
    expect(order).toMatchObject({
      state: "payment_succeeded",
      settlementStatus: "pending",
      providerStatus: "not_started",
    });
    expect(order?.reserveCheckedAt).toBeUndefined();
  });

  it("refunds exactly once when Openprovider rejects a paid order", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid",
      paymentId: "payment_paid",
    });
    const reserve = await fundedReserve(t);
    await t.mutation(internal.domainOrders.queueFulfillment, {
      orderId,
      eventKey: "fulfillment_queued",
      ...reserve,
    });
    await t.mutation(internal.domainOrders.recordProviderPending, {
      orderId,
      eventKey: "openprovider_started",
      providerOrderId: "op_order_001",
    });
    await t.mutation(internal.domainOrders.recordProviderFailed, {
      orderId,
      eventKey: "openprovider_failed",
      failureCode: "domain_unavailable",
      failureMessage: "The registry rejected the registration",
    });
    const firstRefund = await t.mutation(internal.domainOrders.recordRefunded, {
      orderId,
      eventKey: "dodo_refund_001",
      refundId: "refund_001",
    });
    const duplicateRefund = await t.mutation(
      internal.domainOrders.recordRefunded,
      {
        orderId,
        eventKey: "dodo_refund_001",
        refundId: "refund_001",
      },
    );

    expect(firstRefund).toBe(true);
    expect(duplicateRefund).toBe(false);
    const order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order).toMatchObject({
      state: "refunded",
      paymentStatus: "refunded",
      providerStatus: "failed",
      failureCode: "domain_unavailable",
    });
  });

  it("can use the registrar reserve before Dodo settles its payout", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);

    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid_before_settlement",
      paymentId: "payment_unsettled",
    });
    const reserve = await fundedReserve(t);
    await t.mutation(internal.domainOrders.queueFulfillment, {
      orderId,
      eventKey: "reserve_fulfillment_queued",
      ...reserve,
    });
    await t.mutation(internal.domainOrders.recordProviderPending, {
      orderId,
      eventKey: "reserve_provider_started",
      providerOrderId: "op_reserve_order",
    });
    await t.mutation(internal.domainOrders.recordProviderSucceeded, {
      orderId,
      eventKey: "reserve_provider_succeeded",
      registrarDomainId: "op_reserve_domain",
      registrationExpiresAt: NOW + 365 * 24 * 60 * 60_000,
    });

    const registeredBeforePayout = await t.run((ctx) => ctx.db.get(orderId));
    expect(registeredBeforePayout).toMatchObject({
      state: "registered",
      providerStatus: "succeeded",
      settlementStatus: "pending",
      registrarBalanceMinor: 10_000,
      pendingProviderCommitmentsMinor: 0,
      renewalReserveMinor: 2_000,
      operationallyAvailableMinor: 8_000,
      reserveCheckedAt: NOW,
    });

    const firstSettlement = await t.mutation(
      internal.domainOrders.recordSettlementSucceeded,
      {
        orderId,
        eventKey: "dodo_payout_settled",
        payoutId: "payout_001",
        settledAt: NOW + 10 * 24 * 60 * 60_000,
      },
    );
    const duplicateSettlement = await t.mutation(
      internal.domainOrders.recordSettlementSucceeded,
      {
        orderId,
        eventKey: "dodo_payout_settled",
        payoutId: "payout_001",
        settledAt: NOW + 10 * 24 * 60 * 60_000,
      },
    );

    expect(firstSettlement).toBe(true);
    expect(duplicateSettlement).toBe(false);
    expect(await t.run((ctx) => ctx.db.get(orderId))).toMatchObject({
      state: "registered",
      providerStatus: "succeeded",
      settlementStatus: "settled",
      payoutId: "payout_001",
    });
  });

  it("records a payout reversal without rewriting the domain order", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid_then_reversed",
      paymentId: "payment_then_reversed",
    });
    await t.mutation(internal.domainOrders.recordSettlementSucceeded, {
      orderId,
      eventKey: "dodo_settled_then_reversed",
      payoutId: "payout_then_reversed",
      settledAt: NOW + 10 * 24 * 60 * 60_000,
    });
    const firstReversal = await t.mutation(
      internal.domainOrders.recordSettlementReversed,
      {
        orderId,
        eventKey: "dodo_reversal_001",
        payoutId: "payout_then_reversed",
        reason: "Processor payout reversal",
      },
    );
    const duplicateReversal = await t.mutation(
      internal.domainOrders.recordSettlementReversed,
      {
        orderId,
        eventKey: "dodo_reversal_001",
        payoutId: "payout_then_reversed",
        reason: "Processor payout reversal",
      },
    );

    expect(firstReversal).toBe(true);
    expect(duplicateReversal).toBe(false);
    expect(await t.run((ctx) => ctx.db.get(orderId))).toMatchObject({
      state: "payment_succeeded",
      paymentStatus: "succeeded",
      settlementStatus: "reversed",
      payoutId: "payout_then_reversed",
    });
  });

  it("never assigns one registrar order or domain identity to two orders", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const firstOrderId = await createQuote(t, orgId, {
      hostname: "first.example",
      idempotencyKey: "provider_identity_first",
      eventKey: "provider_identity_first_quote",
    });
    await recordSuccessfulPayment(t, firstOrderId, {
      eventKey: "provider_identity_first_payment",
      paymentId: "provider_identity_first_payment",
    });
    await t.mutation(internal.domainOrders.queueFulfillment, {
      orderId: firstOrderId,
      eventKey: "provider_identity_first_queue",
      ...(await fundedReserve(t)),
    });
    await t.mutation(internal.domainOrders.recordProviderPending, {
      orderId: firstOrderId,
      eventKey: "provider_identity_first_pending",
      providerOrderId: "openprovider-order-shared",
    });
    await t.mutation(internal.domainOrders.recordProviderSucceeded, {
      orderId: firstOrderId,
      eventKey: "provider_identity_first_success",
      registrarDomainId: "openprovider-domain-shared",
      registrationExpiresAt: NOW + 365 * 24 * 60 * 60_000,
    });

    const secondOrderId = await createQuote(t, orgId, {
      hostname: "second.example",
      idempotencyKey: "provider_identity_second",
      eventKey: "provider_identity_second_quote",
    });
    await recordSuccessfulPayment(t, secondOrderId, {
      eventKey: "provider_identity_second_payment",
      paymentId: "provider_identity_second_payment",
    });
    await t.mutation(internal.domainOrders.queueFulfillment, {
      orderId: secondOrderId,
      eventKey: "provider_identity_second_queue",
      ...(await fundedReserve(t)),
    });

    await expect(
      t.mutation(internal.domainOrders.recordProviderPending, {
        orderId: secondOrderId,
        eventKey: "provider_identity_empty_order",
        providerOrderId: "   ",
      }),
    ).rejects.toThrow("Provider order ID is required");
    await expect(
      t.mutation(internal.domainOrders.recordProviderPending, {
        orderId: secondOrderId,
        eventKey: "provider_identity_duplicate_order",
        providerOrderId: "openprovider-order-shared",
      }),
    ).rejects.toThrow("already assigned to another domain order");

    await t.mutation(internal.domainOrders.recordProviderPending, {
      orderId: secondOrderId,
      eventKey: "provider_identity_second_pending",
      providerOrderId: "openprovider-order-second",
    });
    await expect(
      t.mutation(internal.domainOrders.recordProviderSucceeded, {
        orderId: secondOrderId,
        eventKey: "provider_identity_empty_domain",
        registrarDomainId: "   ",
        registrationExpiresAt: NOW + 365 * 24 * 60 * 60_000,
      }),
    ).rejects.toThrow("Registrar domain ID is required");
    await expect(
      t.mutation(internal.domainOrders.recordProviderSucceeded, {
        orderId: secondOrderId,
        eventKey: "provider_identity_duplicate_domain",
        registrarDomainId: "openprovider-domain-shared",
        registrationExpiresAt: NOW + 365 * 24 * 60 * 60_000,
      }),
    ).rejects.toThrow("already assigned to another domain order");
    await expect(
      t.mutation(internal.domainOrders.recordProviderSucceeded, {
        orderId: secondOrderId,
        eventKey: "provider_identity_expired_domain",
        registrarDomainId: "openprovider-domain-second",
        registrationExpiresAt: NOW,
      }),
    ).rejects.toThrow("expiration must be in the future");

    expect(await t.run((ctx) => ctx.db.get(secondOrderId))).toMatchObject({
      state: "fulfilling",
      providerStatus: "pending",
      providerOrderId: "openprovider-order-second",
    });
  });

  it("cannot activate until the matching Vercel domain is fully verified", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid_for_active",
      paymentId: "payment_active",
    });
    const reserve = await fundedReserve(t);
    await t.mutation(internal.domainOrders.queueFulfillment, {
      orderId,
      eventKey: "fulfillment_active_queued",
      ...reserve,
    });
    await t.mutation(internal.domainOrders.recordProviderPending, {
      orderId,
      eventKey: "openprovider_active_started",
      providerOrderId: "op_order_active",
    });
    await t.mutation(internal.domainOrders.recordProviderSucceeded, {
      orderId,
      eventKey: "openprovider_active_succeeded",
      registrarDomainId: "op_domain_001",
      registrationExpiresAt: NOW + 365 * 24 * 60 * 60_000,
    });
    const domainId = await t.run((ctx) =>
      ctx.db.insert("domains", {
        orgId,
        hostname: "bakery.example",
        verified: false,
        provider: "vercel",
        status: "configuring",
        platformVerified: false,
        createdAt: NOW,
      }),
    );
    await t.mutation(internal.domainOrders.recordRoutingStarted, {
      orderId,
      eventKey: "routing_started",
      domainId,
    });

    await expect(
      t.mutation(internal.domainOrders.recordActivated, {
        orderId,
        eventKey: "activation_too_early",
      }),
    ).rejects.toThrow("not verified");

    await t.run(async (ctx) => {
      await ctx.db.patch(domainId, {
        verified: true,
        platformVerified: true,
        tlsStatus: "active",
        status: "verified",
      });
    });
    await t.mutation(internal.domainOrders.recordActivated, {
      orderId,
      eventKey: "activation_verified",
    });

    const result = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      domain: await ctx.db.get(domainId),
    }));
    expect(result.order).toMatchObject({ state: "active" });
    expect(result.domain).toMatchObject({
      registrationStatus: "active",
      registrarProvider: "openprovider",
      registrarDomainId: "op_domain_001",
      ownershipModel: "customer_registrant",
      autoRenew: true,
    });
  });

  it("rejects stale or wrong-currency registrar funding snapshots", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const orderId = await createQuote(t, orgId);
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "dodo_paid_for_snapshot_checks",
      paymentId: "payment_snapshot_checks",
    });

    const staleSnapshotId = await seedFundingSnapshot(t, {
      fetchedAt: NOW - 5 * 60_000 - 1,
    });
    await expect(
      t.mutation(internal.domainOrders.queueFulfillment, {
        orderId,
        eventKey: "stale_funding_snapshot",
        fundingSnapshotId: staleSnapshotId,
        renewalReserveMinor: 0,
      }),
    ).rejects.toThrow("funding snapshot is stale");

    const eurSnapshotId = await seedFundingSnapshot(t, { currency: "EUR" });
    await expect(
      t.mutation(internal.domainOrders.queueFulfillment, {
        orderId,
        eventKey: "wrong_currency_snapshot",
        fundingSnapshotId: eurSnapshotId,
        renewalReserveMinor: 0,
      }),
    ).rejects.toThrow("funding currency does not match");
  });

  it("derives pending registrar commitments instead of trusting the caller", async () => {
    const t = convexTest(schema, modules);
    const orgId = await seedOrg(t);
    const pendingOrderId = await createQuote(t, orgId, {
      hostname: "pending-commitment.example",
      idempotencyKey: "pending_commitment",
      eventKey: "pending_commitment_quote",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(pendingOrderId, {
        state: "fulfillment_pending",
        paymentStatus: "succeeded",
      });
    });

    const orderId = await createQuote(t, orgId, {
      hostname: "new-commitment.example",
      idempotencyKey: "new_commitment",
      eventKey: "new_commitment_quote",
    });
    await recordSuccessfulPayment(t, orderId, {
      eventKey: "new_commitment_paid",
      paymentId: "new_commitment_payment",
    });
    const fundingSnapshotId = await seedFundingSnapshot(t, {
      availableBalanceMinor: 2_700,
    });

    await expect(
      t.mutation(internal.domainOrders.queueFulfillment, {
        orderId,
        eventKey: "server_derived_commitments",
        fundingSnapshotId,
        renewalReserveMinor: 0,
      }),
    ).rejects.toThrow("short by 100 minor units");
  });
});
