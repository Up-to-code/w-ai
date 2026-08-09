export type RegistrarReserveInput = {
  registrarBalanceMinor: number;
  pendingProviderCommitmentsMinor: number;
  renewalReserveMinor: number;
  requestedProviderCostMinor: number;
  customerPaidUnsettledMinor: number;
};

export type RegistrarReserveDecision = {
  canFulfill: boolean;
  operationallyAvailableMinor: number;
  shortfallMinor: number;
  customerPaidUnsettledMinor: number;
};

function assertMoney(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

/**
 * Pure policy used before a future registrar call. Unsettled Dodo receipts are
 * deliberately informational and never increase spendable registrar funds.
 */
export function evaluateRegistrarReserve(
  input: RegistrarReserveInput,
): RegistrarReserveDecision {
  assertMoney("Registrar balance", input.registrarBalanceMinor);
  assertMoney(
    "Pending provider commitments",
    input.pendingProviderCommitmentsMinor,
  );
  assertMoney("Renewal reserve", input.renewalReserveMinor);
  assertMoney("Requested provider cost", input.requestedProviderCostMinor);
  assertMoney(
    "Customer paid but unsettled amount",
    input.customerPaidUnsettledMinor,
  );

  const protectedMinor =
    input.pendingProviderCommitmentsMinor + input.renewalReserveMinor;
  if (!Number.isSafeInteger(protectedMinor)) {
    throw new RangeError("Protected registrar funds exceed safe integer range");
  }
  const operationallyAvailableMinor = Math.max(
    0,
    input.registrarBalanceMinor - protectedMinor,
  );
  const shortfallMinor = Math.max(
    0,
    input.requestedProviderCostMinor - operationallyAvailableMinor,
  );

  return {
    canFulfill: shortfallMinor === 0,
    operationallyAvailableMinor,
    shortfallMinor,
    customerPaidUnsettledMinor: input.customerPaidUnsettledMinor,
  };
}
