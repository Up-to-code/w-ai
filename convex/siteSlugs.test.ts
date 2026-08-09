import { describe, expect, it } from "vitest";

import { siteSlugStatus } from "./siteSlugs";

describe("site slug policy", () => {
  it("accepts tenant-safe site addresses", () => {
    expect(siteSlugStatus("studio-north")).toBe("available");
    expect(siteSlugStatus("ahmed2026")).toBe("available");
  });

  it("rejects invalid and platform-reserved addresses", () => {
    expect(siteSlugStatus("no spaces")).toBe("invalid");
    expect(siteSlugStatus("www")).toBe("reserved");
    expect(siteSlugStatus("dashboard")).toBe("reserved");
    expect(siteSlugStatus("api")).toBe("reserved");
  });
});
