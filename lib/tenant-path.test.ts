import { describe, expect, it } from "vitest";

import { localizedPageHref, resolveTenantPath } from "./tenant-path";

const languages = [
  { code: "en", enabled: true, isDefault: true },
  { code: "ar", enabled: true, isDefault: false },
];

describe("tenant locale routes", () => {
  it("keeps default English unprefixed", () => {
    expect(resolveTenantPath(["about"], languages)).toEqual({
      localeCode: "en",
      pageSlug: "about",
      localePrefix: "",
      isDefaultLocale: true,
    });
    expect(localizedPageHref("home", "")).toBe("/");
  });

  it("resolves secondary locale and its home route", () => {
    expect(resolveTenantPath(["ar"], languages).pageSlug).toBe("home");
    expect(resolveTenantPath(["ar", "about"], languages).localeCode).toBe("ar");
    expect(localizedPageHref("about", "/ar")).toBe("/ar/about");
  });

  it("does not treat disabled locale codes as public prefixes", () => {
    const result = resolveTenantPath(["ar", "about"], [
      languages[0],
      { ...languages[1], enabled: false },
    ]);
    expect(result.localeCode).toBe("en");
    expect(result.pageSlug).toBe("ar/about");
  });
});
