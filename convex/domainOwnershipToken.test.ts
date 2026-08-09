import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";

import { randomToken } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("domain ownership token entropy", () => {
  it("creates the requested number of cryptographically random bytes", () => {
    const token = randomToken(16);
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("does not depend on Math.random", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not generate ownership tokens");
    });
    expect(randomToken(16)).toMatch(/^[a-f0-9]{32}$/);
  });

  it.each([0, -1, 1.5, 129])("rejects an unsafe byte count: %s", (bytes) => {
    expect(() => randomToken(bytes)).toThrow(ConvexError);
  });
});
