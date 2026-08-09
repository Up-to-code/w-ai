"use node";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import {
  openproviderBaseUrl,
  OpenproviderReadOnlyClient,
  type OpenproviderEnvironment,
} from "./openproviderClient";

const readinessValidator = v.object({
  provider: v.literal("openprovider"),
  environment: v.union(v.literal("sandbox"), v.literal("production")),
  baseUrl: v.string(),
  credentialsConfigured: v.boolean(),
  authenticationChecked: v.boolean(),
  authenticated: v.boolean(),
  purchaseCallsImplemented: v.literal(false),
  publicPurchaseEnabled: v.literal(false),
  message: v.string(),
});

const fundingSnapshotValidator = v.object({
  snapshotId: v.id("registrarFundingSnapshots"),
  provider: v.literal("openprovider"),
  environment: v.union(v.literal("sandbox"), v.literal("production")),
  currency: v.string(),
  currencyMinorUnit: v.number(),
  availableBalanceMajor: v.string(),
  availableBalanceMinor: v.number(),
  reservedBalanceMajor: v.string(),
  reservedBalanceMinor: v.number(),
  fetchedAt: v.number(),
  purchaseCallsImplemented: v.literal(false),
  publicPurchaseEnabled: v.literal(false),
});

type AuthenticatedClient = {
  client: OpenproviderReadOnlyClient;
  environment: OpenproviderEnvironment;
  accountHash: string;
};

type CachedRegistrarSession = {
  encryptedAccessToken: string;
  expiresAt: number;
} | null;

type FundingSnapshotResult = {
  snapshotId: Id<"registrarFundingSnapshots">;
  provider: "openprovider";
  environment: OpenproviderEnvironment;
  currency: string;
  currencyMinorUnit: number;
  availableBalanceMajor: string;
  availableBalanceMinor: number;
  reservedBalanceMajor: string;
  reservedBalanceMinor: number;
  fetchedAt: number;
  purchaseCallsImplemented: false;
  publicPurchaseEnabled: false;
};

function environmentFromConfig(): OpenproviderEnvironment {
  return process.env.OPENPROVIDER_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

function sessionKey() {
  const secret = process.env.REGISTRAR_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Registrar credential encryption is not configured");
  }
  return createHash("sha256").update(secret).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptToken(payload: string) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored registrar session is invalid");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    sessionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function authenticatedClient(
  ctx: ActionCtx,
): Promise<AuthenticatedClient> {
  const environment = environmentFromConfig();
  const username = process.env.OPENPROVIDER_USERNAME?.trim() ?? "";
  const password = process.env.OPENPROVIDER_PASSWORD ?? "";
  if (!username || !password) {
    throw new Error("Openprovider credentials are not configured");
  }
  const accountHash = createHash("sha256")
    .update(`${environment}:${username.toLowerCase()}`)
    .digest("hex");
  const cached: CachedRegistrarSession = await ctx.runQuery(
    internal.domainRegistrarSessions.get,
    {
      environment,
      accountHash,
    },
  );
  const cachedToken =
    cached && cached.expiresAt > Date.now() + 5 * 60 * 1000
      ? decryptToken(cached.encryptedAccessToken)
      : undefined;
  const client = new OpenproviderReadOnlyClient({
    environment,
    username,
    password,
    initialToken: cachedToken,
  });
  const token = await client.authenticate();
  if (!cachedToken) {
    await ctx.runMutation(internal.domainRegistrarSessions.save, {
      environment,
      accountHash,
      encryptedAccessToken: encryptToken(token),
      // Openprovider documents a 48-hour token lifetime. Refresh one hour
      // early so it cannot expire during a subsequent provider call.
      expiresAt: Date.now() + 47 * 60 * 60 * 1000,
    });
  }
  return { client, environment, accountHash };
}

/**
 * Operator-only, no-spend readiness probe. It can validate credentials but
 * cannot search, register, renew, transfer, restore, or charge a customer.
 */
export const openproviderReadiness = internalAction({
  args: { authenticate: v.boolean() },
  returns: readinessValidator,
  handler: async (ctx, args) => {
    const environment = environmentFromConfig();
    const username = process.env.OPENPROVIDER_USERNAME?.trim() ?? "";
    const password = process.env.OPENPROVIDER_PASSWORD ?? "";
    const credentialsConfigured = Boolean(username && password);
    let authenticated = false;
    let message = credentialsConfigured
      ? "Credentials configured; registration remains disabled."
      : "Set Openprovider credentials to test the sandbox connection.";

    if (args.authenticate && credentialsConfigured) {
      await authenticatedClient(ctx);
      authenticated = true;
      message =
        "Openprovider authentication is ready; registration remains disabled.";
    }

    return {
      provider: "openprovider" as const,
      environment,
      baseUrl: openproviderBaseUrl(environment),
      credentialsConfigured,
      authenticationChecked: args.authenticate && credentialsConfigured,
      authenticated,
      purchaseCallsImplemented: false as const,
      publicPurchaseEnabled: false as const,
      message,
    };
  },
});

/**
 * Operator-only balance observation. It reads Openprovider and records an
 * immutable snapshot, but has no method that can add funds or place an order.
 */
export const openproviderFundingSnapshot = internalAction({
  args: {},
  returns: fundingSnapshotValidator,
  handler: async (ctx): Promise<FundingSnapshotResult> => {
    const { client, environment, accountHash } = await authenticatedClient(ctx);
    const funding = await client.getFunding();
    const fetchedAt = Date.now();
    const snapshotId: Id<"registrarFundingSnapshots"> = await ctx.runMutation(
      internal.domainRegistrarFunding.save,
      {
        environment,
        accountHash,
        currency: funding.currency,
        availableBalanceMinor: funding.availableBalanceMinor,
        reservedBalanceMinor: funding.reservedBalanceMinor,
        currencyMinorUnit: funding.currencyMinorUnit,
        fetchedAt,
      },
    );
    return {
      snapshotId,
      provider: "openprovider" as const,
      environment,
      ...funding,
      fetchedAt,
      purchaseCallsImplemented: false as const,
      publicPurchaseEnabled: false as const,
    };
  },
});
