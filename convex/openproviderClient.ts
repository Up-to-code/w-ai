import { parse } from "tldts";

export const OPENPROVIDER_PRODUCTION_BASE_URL =
  "https://api.openprovider.eu/v1beta";
export const OPENPROVIDER_SANDBOX_BASE_URL =
  "http://api.sandbox.openprovider.nl:8480/v1beta";

export type OpenproviderEnvironment = "sandbox" | "production";

export type OpenproviderAvailability = {
  hostname: string;
  available: boolean;
  status: string;
  reason: string | null;
  premium: boolean;
  price: { currency: string; amountMajor: string } | null;
};

export type OpenproviderFunding = {
  currency: string;
  currencyMinorUnit: number;
  availableBalanceMajor: string;
  availableBalanceMinor: number;
  reservedBalanceMajor: string;
  reservedBalanceMinor: number;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type OpenproviderClientOptions = {
  environment: OpenproviderEnvironment;
  username: string;
  password: string;
  initialToken?: string;
  fetch?: FetchLike;
};

type JsonObject = Record<string, unknown>;

export class OpenproviderApiError extends Error {
  readonly httpStatus: number;
  readonly providerCode: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(args: {
    message: string;
    httpStatus: number;
    providerCode?: number | null;
    retryAfterSeconds?: number | null;
  }) {
    super(args.message);
    this.name = "OpenproviderApiError";
    this.httpStatus = args.httpStatus;
    this.providerCode = args.providerCode ?? null;
    this.retryAfterSeconds = args.retryAfterSeconds ?? null;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function decimalString(value: unknown) {
  const amount = asFiniteNumber(value);
  return amount === null || amount < 0 ? null : String(amount);
}

export function currencyMinorUnit(currency: string): number {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new OpenproviderApiError({
      message: "Openprovider returned an invalid account currency",
      httpStatus: 502,
    });
  }
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    }).resolvedOptions().maximumFractionDigits;
    if (
      typeof digits === "number" &&
      Number.isInteger(digits) &&
      digits >= 0 &&
      digits <= 4
    ) {
      return digits;
    }
  } catch {
    // Fall through to the provider-shaped error below.
  }
  throw new OpenproviderApiError({
    message: "Openprovider returned an unsupported account currency",
    httpStatus: 502,
  });
}

export function majorAmountToMinor(
  value: unknown,
  currency: string,
): { major: string; minor: number; digits: number } {
  const amount = asFiniteNumber(value);
  const digits = currencyMinorUnit(currency);
  if (amount === null || amount < 0) {
    throw new OpenproviderApiError({
      message: "Openprovider returned an invalid account balance",
      httpStatus: 502,
    });
  }
  const factor = 10 ** digits;
  const scaled = amount * factor;
  const minor = Math.round(scaled);
  if (
    !Number.isSafeInteger(minor) ||
    Math.abs(scaled - minor) > Math.max(1, Math.abs(scaled)) * 1e-10
  ) {
    throw new OpenproviderApiError({
      message: "Openprovider returned a balance with unsupported precision",
      httpStatus: 502,
    });
  }
  return { major: amount.toFixed(digits), minor, digits };
}

function parseFundingPayload(payload: unknown): OpenproviderFunding {
  if (!isObject(payload) || !isObject(payload.data)) {
    throw new OpenproviderApiError({
      message: safeProviderMessage(
        payload,
        "Openprovider returned an invalid reseller response",
      ),
      httpStatus: 502,
    });
  }
  const settings = isObject(payload.data.settings)
    ? payload.data.settings
    : null;
  const currency = settings
    ? asNonEmptyString(settings.currency)?.toUpperCase()
    : null;
  if (!currency) {
    throw new OpenproviderApiError({
      message: "Openprovider omitted the reseller account currency",
      httpStatus: 502,
    });
  }
  const available = majorAmountToMinor(payload.data.balance, currency);
  const reserved = majorAmountToMinor(
    payload.data.reserved_balance ?? 0,
    currency,
  );
  return {
    currency,
    currencyMinorUnit: available.digits,
    availableBalanceMajor: available.major,
    availableBalanceMinor: available.minor,
    reservedBalanceMajor: reserved.major,
    reservedBalanceMinor: reserved.minor,
  };
}

function safeProviderMessage(payload: unknown, fallback: string) {
  if (!isObject(payload)) return fallback;
  return (
    asNonEmptyString(payload.desc) ??
    asNonEmptyString(payload.message) ??
    fallback
  );
}

function parseRetryAfter(response: Response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function domainParts(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  const result = parse(normalized, { allowPrivateDomains: false });
  if (
    result.domain !== normalized ||
    !result.domainWithoutSuffix ||
    !result.publicSuffix ||
    result.isPrivate
  ) {
    throw new TypeError(
      "Openprovider searches require a registrable apex domain",
    );
  }
  return {
    hostname: normalized,
    name: result.domainWithoutSuffix,
    extension: result.publicSuffix,
  };
}

function priceFromResult(result: JsonObject) {
  const price = isObject(result.price) ? result.price : null;
  const reseller = price && isObject(price.reseller) ? price.reseller : null;
  const product = price && isObject(price.product) ? price.product : null;
  const candidate = (value: JsonObject | null) => {
    const amountMajor = value ? decimalString(value.price) : null;
    const currency = value ? asNonEmptyString(value.currency) : null;
    return amountMajor && currency
      ? { amountMajor, currency: currency.toUpperCase() }
      : null;
  };
  return candidate(reseller) ?? candidate(product);
}

function parseAvailabilityPayload(
  payload: unknown,
): OpenproviderAvailability[] {
  if (!isObject(payload)) {
    throw new OpenproviderApiError({
      message: "Openprovider returned an invalid availability response",
      httpStatus: 502,
    });
  }
  const data = isObject(payload.data) ? payload.data : null;
  const results = data && Array.isArray(data.results) ? data.results : null;
  if (!results) {
    throw new OpenproviderApiError({
      message: safeProviderMessage(
        payload,
        "Openprovider returned no availability results",
      ),
      httpStatus: 502,
      providerCode: asFiniteNumber(payload.code),
    });
  }

  return results.map((raw) => {
    if (!isObject(raw)) {
      throw new OpenproviderApiError({
        message: "Openprovider returned an invalid domain result",
        httpStatus: 502,
      });
    }
    const hostname = asNonEmptyString(raw.domain);
    const status = asNonEmptyString(raw.status);
    if (!hostname || !status) {
      throw new OpenproviderApiError({
        message: "Openprovider omitted a domain name or status",
        httpStatus: 502,
      });
    }
    return {
      hostname: hostname.toLowerCase(),
      available: status.toLowerCase() === "free",
      status,
      reason: asNonEmptyString(raw.reason),
      premium: raw.is_premium === true || raw.is_premium === 1,
      price: priceFromResult(raw),
    };
  });
}

export function openproviderBaseUrl(environment: OpenproviderEnvironment) {
  return environment === "production"
    ? OPENPROVIDER_PRODUCTION_BASE_URL
    : OPENPROVIDER_SANDBOX_BASE_URL;
}

/**
 * Read-only client boundary for the deferred registrar phase.
 *
 * There is intentionally no register, transfer, renew, restore, or payment
 * method. Adding one requires a separate reviewed release that connects the
 * already-protected domain order state machine.
 */
export class OpenproviderReadOnlyClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetcher: FetchLike;
  private token: string | null = null;

  constructor(options: OpenproviderClientOptions) {
    this.baseUrl = openproviderBaseUrl(options.environment);
    this.username = options.username.trim();
    this.password = options.password;
    this.fetcher = options.fetch ?? fetch;
    this.token = options.initialToken?.trim() || null;
    if (!this.username || !this.password) {
      throw new TypeError("Openprovider credentials are required");
    }
  }

  async authenticate() {
    if (this.token) return this.token;
    const response = await this.fetcher(this.baseUrl + "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });
    const payload = await this.readPayload(response);
    const data =
      isObject(payload) && isObject(payload.data) ? payload.data : null;
    const token = data ? asNonEmptyString(data.token) : null;
    if (!token) {
      throw new OpenproviderApiError({
        message: safeProviderMessage(
          payload,
          "Openprovider authentication returned no token",
        ),
        httpStatus: response.status || 502,
        providerCode: isObject(payload) ? asFiniteNumber(payload.code) : null,
        retryAfterSeconds: parseRetryAfter(response),
      });
    }
    this.token = token;
    return token;
  }

  async checkAvailability(hostnames: string[]) {
    if (hostnames.length < 1 || hostnames.length > 20) {
      throw new RangeError("Check between 1 and 20 domains per request");
    }
    const domains = hostnames.map(domainParts);
    const token = await this.authenticate();
    const response = await this.fetcher(this.baseUrl + "/domains/check", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        domains: domains.map(({ name, extension }) => ({ name, extension })),
        with_price: true,
        with_whois: false,
      }),
    });
    return parseAvailabilityPayload(await this.readPayload(response));
  }

  /**
   * Reads the provider's available and reserved balance. This endpoint cannot
   * top up, charge, register, renew, transfer, or otherwise spend funds.
   */
  async getFunding() {
    const token = await this.authenticate();
    const response = await this.fetcher(
      this.baseUrl + "/resellers?with_settings=true",
      { headers: { authorization: "Bearer " + token } },
    );
    return parseFundingPayload(await this.readPayload(response));
  }

  private async readPayload(response: Response): Promise<unknown> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenproviderApiError({
        message: "Openprovider returned a non-JSON response",
        httpStatus: response.status || 502,
        retryAfterSeconds: parseRetryAfter(response),
      });
    }
    const providerCode = isObject(payload)
      ? asFiniteNumber(payload.code)
      : null;
    if (!response.ok || (providerCode !== null && providerCode !== 0)) {
      throw new OpenproviderApiError({
        message: safeProviderMessage(payload, "Openprovider request failed"),
        httpStatus: response.status,
        providerCode,
        retryAfterSeconds: parseRetryAfter(response),
      });
    }
    return payload;
  }
}
