import { useMemo, useState } from "react";

import { buildTransactionPieSlices } from "./Breakdown/chartUtils";
import {
  buildPayslipBreakdown,
  getPayslipGrossTotal,
} from "./payslipBreakdownUtils";
import type {
  DashboardData,
} from "../shared/types";

export const useIncomeBreakdown = ({
  data,
  otherIncomeCount,
  otherIncomeTotal,
}: {
  data: DashboardData | null;
  otherIncomeCount: number;
  otherIncomeTotal: number;
}) => {
  const [hoveredPayslipCategory, setHoveredPayslipCategory] = useState<
    string | null
  >(null);
  const [openPayslipGroups, setOpenPayslipGroups] = useState<
    Record<string, boolean>
  >({});
  const payslipCategories = useMemo(() => {
    const payslips = data?.payslips || [];

    return buildPayslipBreakdown({
      payslips,
      otherIncomeCount,
      otherIncomeTotal,
    });
  }, [data, otherIncomeCount, otherIncomeTotal]);
  const payslipGrossTotal = useMemo(
    () => getPayslipGrossTotal(data?.payslips || [], otherIncomeTotal),
    [data, otherIncomeTotal],
  );
  const payslipPieSlices = useMemo(
    () => buildTransactionPieSlices(payslipCategories),
    [payslipCategories],
  );
  const togglePayslipGroup = (category: string) => {
    setOpenPayslipGroups((currentGroups) => ({
      ...currentGroups,
      [category]: !currentGroups[category],
    }));
  };

  return {
    hoveredPayslipCategory,
    openPayslipGroups,
    payslipCategories,
    payslipGrossTotal,
    payslipPieSlices,
    setHoveredPayslipCategory,
    togglePayslipGroup,
  };
};
