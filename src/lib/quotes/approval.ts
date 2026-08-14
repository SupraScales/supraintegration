// Approval blocking rules. A quote with unresolved required information can
// never be approved; some blockers can be overridden by an authorized user
// with a recorded reason, others can never be overridden. Pure, unit tested.

export type ApprovalInput = {
  openRequiredClarifications: number;
  missingRequiredVendorPrices: number;
  /** Active, non-rejected takeoff rows that came from a mock extraction. */
  activeMockTakeoffRows: number;
  /** Active takeoff rows still unreviewed (AI-proposed, not confirmed/rejected). */
  unreviewedTakeoffRows: number;
  hasTakeoffItems: boolean;
  laborCostLineCount: number;
  finalPriceCents: number | null;
  calculationWarnings: string[];
};

export type ApprovalBlocker = {
  code: string;
  message: string;
  overridable: boolean;
};

export function collectApprovalBlockers(input: ApprovalInput): ApprovalBlocker[] {
  const blockers: ApprovalBlocker[] = [];

  if (input.activeMockTakeoffRows > 0) {
    blockers.push({
      code: "mock_data",
      message: `${input.activeMockTakeoffRows} takeoff row(s) came from development mock extraction and cannot be part of a real quote. Reject or replace them first.`,
      overridable: false,
    });
  }
  if (input.finalPriceCents === null) {
    blockers.push({
      code: "no_final_price",
      message: "The quote does not have a final price. Enter a manual price or configure the markup or margin.",
      overridable: false,
    });
  }
  if (input.calculationWarnings.length > 0) {
    blockers.push({
      code: "calculation_error",
      message: `Pricing calculation problems: ${input.calculationWarnings.join(" ")}`,
      overridable: false,
    });
  }
  if (input.openRequiredClarifications > 0) {
    blockers.push({
      code: "open_clarifications",
      message: `${input.openRequiredClarifications} required question(s) about this quote are still unresolved.`,
      overridable: true,
    });
  }
  if (input.missingRequiredVendorPrices > 0) {
    blockers.push({
      code: "missing_vendor_prices",
      message: `${input.missingRequiredVendorPrices} required vendor price(s) have not been received.`,
      overridable: true,
    });
  }
  if (input.unreviewedTakeoffRows > 0) {
    blockers.push({
      code: "unreviewed_takeoff",
      message: `${input.unreviewedTakeoffRows} takeoff row(s) have not been reviewed yet.`,
      overridable: true,
    });
  }
  if (input.hasTakeoffItems && input.laborCostLineCount === 0) {
    blockers.push({
      code: "labor_missing",
      message: "Materials are listed but no labor has been entered for this quote.",
      overridable: true,
    });
  }

  return blockers;
}

export function evaluateApproval(input: ApprovalInput, overrideReason?: string | null) {
  const blockers = collectApprovalBlockers(input);
  const hardBlockers = blockers.filter((blocker) => !blocker.overridable);
  const canApprove =
    blockers.length === 0 ||
    (hardBlockers.length === 0 && Boolean(overrideReason?.trim()));
  return { blockers, hardBlockers, canApprove };
}
