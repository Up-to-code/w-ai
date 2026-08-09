import { describe, expect, it } from "vitest";

import { evaluateRegistrarReserve } from "./domainFinance";

describe("registrar reserve policy", () => {
  it("never treats an unsettled Dodo payment as registrar cash", () => {
    const result = evaluateRegistrarReserve({
      registrarBalanceMinor: 500,
      pendingProviderCommitmentsMinor: 100,
      renewalReserveMinor: 300,
      requestedProviderCostMinor: 1_400,
      customerPaidUnsettledMinor: 1_800,
    });

    expect(result).toEqual({
      canFulfill: false,
      operationallyAvailableMinor: 100,
      shortfallMinor: 1_300,
      customerPaidUnsettledMinor: 1_800,
    });
  });

  it("permits fulfillment only from uncommitted registrar balance", () => {
    expect(
      evaluateRegistrarReserve({
        registrarBalanceMinor: 5_000,
        pendingProviderCommitmentsMinor: 1_000,
        renewalReserveMinor: 2_000,
        requestedProviderCostMinor: 1_400,
        customerPaidUnsettledMinor: 0,
      }),
    ).toMatchObject({
      canFulfill: true,
      operationallyAvailableMinor: 2_000,
      shortfallMinor: 0,
    });
  });

  it("rejects unsafe or negative money values", () => {
    expect(() =>
      evaluateRegistrarReserve({
        registrarBalanceMinor: -1,
        pendingProviderCommitmentsMinor: 0,
        renewalReserveMinor: 0,
        requestedProviderCostMinor: 0,
        customerPaidUnsettledMinor: 0,
      }),
    ).toThrow("non-negative safe integer");
  });
});
