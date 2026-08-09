import { describe, expect, it } from "vitest";

import {
  isAppHost,
  tenantHostname,
  tenantSlugFromHost,
} from "../lib/tenant-host";

describe("tenant host routing", () => {
  it("keeps the Qentrah apex and www alias on the application", () => {
    expect(isAppHost("qentrah.com")).toBe(true);
    expect(isAppHost("www.qentrah.com")).toBe(true);
  });

  it("uses Qentrah as the parent zone for published tenant sites", () => {
    expect(tenantHostname("studio")).toBe("studio.qentrah.com");
    expect(tenantSlugFromHost("studio.qentrah.com")).toBe("studio");
  });
});
