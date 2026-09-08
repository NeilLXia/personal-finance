import type {
  DateRange,
  IncomeAllocationRange,
  TransactionRange,
} from "./shared/types";

const PAYLOAD_ROOT = "dashboard";

export type TransactionSliceParams = {
  month: string;
  range: TransactionRange;
  // Only set when `range === "custom"`, so the key changes iff the request does.
  customRange: DateRange | null;
};

export type IncomeAllocationSliceParams = {
  month: string;
  range: IncomeAllocationRange;
  customRange: DateRange | null;
};

/**
 * Query keys for the composed dashboard payload that `useDashboardData` stitches
 * together from three requests (base + transaction slice + income-allocation
 * slice). Invalidating `root` refetches all three.
 *
 * It deliberately does NOT match `resourceKeys` below: saving a rule or a
 * payslip invalidates `root` so the derived dashboard figures refresh, without
 * discarding the list cache the modal just updated in place.
 */
export const dashboardPayloadKeys = {
  root: [PAYLOAD_ROOT] as const,
  base: (month: string) => [PAYLOAD_ROOT, "base", month] as const,
  transactionSlice: (params: TransactionSliceParams) =>
    [PAYLOAD_ROOT, "transaction-slice", params] as const,
  incomeAllocationSlice: (params: IncomeAllocationSliceParams) =>
    [PAYLOAD_ROOT, "income-allocation-slice", params] as const,
};

/**
 * Query keys for the standalone resource lists behind the dashboard modals.
 * Each list owns its own cache entry and is invalidated on its own; the modals
 * additionally invalidate `dashboardPayloadKeys.root` so dashboard figures that
 * derive from these resources refresh too.
 */
export const resourceKeys = {
  categoryRules: ["category-rules"] as const,
  budgetTargets: ["budget-targets"] as const,
  payslips: ["payslips"] as const,
  properties: ["properties"] as const,
};
