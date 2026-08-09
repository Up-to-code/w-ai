import { describe, expect, it, vi } from "vitest";

import {
  OPENPROVIDER_SANDBOX_BASE_URL,
  OpenproviderApiError,
  OpenproviderReadOnlyClient,
} from "./openproviderClient";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("Openprovider read-only client", () => {
  it("authenticates once and parses authoritative availability and price", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ code: 0, data: { token: "sandbox-token" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          data: {
            results: [
              {
                domain: "clean-energy.co.uk",
                status: "free",
                is_premium: 0,
                price: {
                  product: { currency: "EUR", price: 8.49 },
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          data: {
            results: [
              {
                domain: "clean-energy.co.uk",
                status: "active",
                reason: "Domain exists",
                is_premium: false,
              },
            ],
          },
        }),
      );
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      fetch: fetcher,
    });

    await expect(
      client.checkAvailability(["Clean-Energy.Co.Uk"]),
    ).resolves.toEqual([
      {
        hostname: "clean-energy.co.uk",
        available: true,
        status: "free",
        reason: null,
        premium: false,
        price: { currency: "EUR", amountMajor: "8.49" },
      },
    ]);
    await client.checkAvailability(["clean-energy.co.uk"]);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toBe(
      OPENPROVIDER_SANDBOX_BASE_URL + "/auth/login",
    );
    expect(fetcher.mock.calls[1][0]).toBe(
      OPENPROVIDER_SANDBOX_BASE_URL + "/domains/check",
    );
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      domains: [{ name: "clean-energy", extension: "co.uk" }],
      with_price: true,
      with_whois: false,
    });
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      authorization: "Bearer sandbox-token",
    });
  });

  it("rejects subdomains because registration operates on apex domains", async () => {
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      fetch: vi.fn(),
    });
    await expect(
      client.checkAvailability(["www.clean-energy.com"]),
    ).rejects.toThrow("registrable apex domain");
  });

  it("surfaces sanitized provider errors and retry timing", async () => {
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "do-not-leak",
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { code: 10005, desc: "Access denied" },
            { status: 429, headers: { "retry-after": "300" } },
          ),
        ),
    });

    const error = await client.authenticate().catch((caught) => caught);
    expect(error).toBeInstanceOf(OpenproviderApiError);
    expect(error).toMatchObject({
      message: "Access denied",
      httpStatus: 429,
      providerCode: 10005,
      retryAfterSeconds: 300,
    });
    expect(String(error)).not.toContain("do-not-leak");
  });

  it("reuses a supplied session token and falls back to product price", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 0,
        data: {
          results: [
            {
              domain: "example.com",
              status: "free",
              price: {
                reseller: {},
                product: { currency: "usd", price: "9.75" },
              },
            },
          ],
        },
      }),
    );
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      initialToken: "cached-token",
      fetch: fetcher,
    });

    await expect(client.checkAvailability(["example.com"])).resolves.toEqual([
      expect.objectContaining({
        price: { currency: "USD", amountMajor: "9.75" },
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      OPENPROVIDER_SANDBOX_BASE_URL + "/domains/check",
    );
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Bearer cached-token",
    });
  });

  it("reads the authoritative available and reserved registrar balance", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 0,
        data: {
          balance: 1234.56,
          reserved_balance: 78.9,
          settings: { currency: "eur" },
        },
      }),
    );
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      initialToken: "cached-token",
      fetch: fetcher,
    });

    await expect(client.getFunding()).resolves.toEqual({
      currency: "EUR",
      currencyMinorUnit: 2,
      availableBalanceMajor: "1234.56",
      availableBalanceMinor: 123_456,
      reservedBalanceMajor: "78.90",
      reservedBalanceMinor: 7_890,
    });
    expect(fetcher).toHaveBeenCalledWith(
      OPENPROVIDER_SANDBOX_BASE_URL + "/resellers?with_settings=true",
      { headers: { authorization: "Bearer cached-token" } },
    );
  });

  it("honors zero-decimal account currencies", async () => {
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      initialToken: "cached-token",
      fetch: vi.fn().mockResolvedValue(
        jsonResponse({
          code: 0,
          data: {
            balance: 5000,
            reserved_balance: 250,
            settings: { currency: "JPY" },
          },
        }),
      ),
    });

    await expect(client.getFunding()).resolves.toMatchObject({
      currency: "JPY",
      currencyMinorUnit: 0,
      availableBalanceMinor: 5000,
      reservedBalanceMinor: 250,
    });
  });

  it("rejects ambiguous provider balance precision", async () => {
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      initialToken: "cached-token",
      fetch: vi.fn().mockResolvedValue(
        jsonResponse({
          code: 0,
          data: {
            balance: 10.001,
            reserved_balance: 0,
            settings: { currency: "EUR" },
          },
        }),
      ),
    });

    await expect(client.getFunding()).rejects.toThrow("unsupported precision");
  });

  it("has no operation that can spend registrar balance", () => {
    const client = new OpenproviderReadOnlyClient({
      environment: "sandbox",
      username: "operator",
      password: "secret",
      fetch: vi.fn(),
    });
    expect("register" in client).toBe(false);
    expect("renew" in client).toBe(false);
    expect("transfer" in client).toBe(false);
    expect("restore" in client).toBe(false);
    expect("getFunding" in client).toBe(true);
  });
});
