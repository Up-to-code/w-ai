import { describe, expect, it } from "vitest";

import { normalizeAuthOrigin } from "../lib/auth-origin";

describe("normalizeAuthOrigin", () => {
  it("normalizes the public www auth proxy request to the trusted apex", async () => {
    const request = new Request(
      "https://www.w-ai.online/api/auth/sign-up/email",
      {
        method: "POST",
        headers: {
          origin: "https://www.w-ai.online",
          referer: "https://www.w-ai.online/ar/register",
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "person@example.com" }),
      },
    );

    const normalized = await normalizeAuthOrigin(request);

    expect(normalized.url).toBe("https://w-ai.online/api/auth/sign-up/email");
    expect(normalized.headers.get("origin")).toBe("https://w-ai.online");
    expect(normalized.headers.get("referer")).toBe(
      "https://w-ai.online/ar/register",
    );
    expect(await normalized.json()).toEqual({ email: "person@example.com" });
  });

  it("leaves localhost and unrelated hosts unchanged", async () => {
    const request = new Request(
      "http://localhost:3000/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: "{}",
      },
    );

    const normalized = await normalizeAuthOrigin(request);

    expect(normalized).toBe(request);
  });
});
