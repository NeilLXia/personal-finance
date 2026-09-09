import type { ExpenseCategorySummary, Payslip } from "../shared/types";

type PayslipAmountField = keyof Pick<
  Payslip,
  | "associate_taxes"
  | "ca_disability_insurance_tax"
  | "federal_withholding_tax"
  | "gross_pay"
  | "medicare_tax"
  | "net_pay"
  | "post_tax_deductions"
  | "posttax_401k_bonus_deferral_roth"
  | "posttax_401k_roth"
  | "pre_tax_deductions"
  | "pretax_401k"
  | "pretax_401k_bonus_deferral"
  | "pretax_dental"
  | "pretax_fsa_healthcare"
  | "pretax_hsa"
  | "pretax_medical"
  | "social_security_tax"
  | "state_tax"
>;

type PayslipFieldCategory = {
  label: string;
  field: PayslipAmountField;
};

type PayslipGroupCategory = PayslipFieldCategory & {
  children: PayslipFieldCategory[];
};

const preTaxChildren: PayslipFieldCategory[] = [
  { label: "401K", field: "pretax_401k" },
  { label: "401K bonus deferral", field: "pretax_401k_bonus_deferral" },
  { label: "Dental", field: "pretax_dental" },
  { label: "FSA healthcare", field: "pretax_fsa_healthcare" },
  { label: "HSA", field: "pretax_hsa" },
  { label: "Medical", field: "pretax_medical" },
];

const taxChildren: PayslipFieldCategory[] = [
  { label: "Social Security", field: "social_security_tax" },
  { label: "Medicare", field: "medicare_tax" },
  { label: "Federal withholding", field: "federal_withholding_tax" },
  { label: "State tax", field: "state_tax" },
  { label: "CA disability insurance", field: "ca_disability_insurance_tax" },
];

const postTaxChildren: PayslipFieldCategory[] = [
  { label: "401K Roth", field: "posttax_401k_roth" },
  {
    label: "401K bonus deferral Roth",
    field: "posttax_401k_bonus_deferral_roth",
  },
];

const payslipGroups: PayslipGroupCategory[] = [
  {
    label: "Pre-tax deductions",
    field: "pre_tax_deductions",
    children: preTaxChildren,
  },
  {
    label: "Associate taxes",
    field: "associate_taxes",
    children: taxChildren,
  },
  {
    label: "Post-tax deductions",
    field: "post_tax_deductions",
    children: postTaxChildren,
  },
];

export const sumPayslipField = (
  payslips: Payslip[],
  field: PayslipAmountField,
) =>
  payslips.reduce((total, payslip) => total + Number(payslip[field] || 0), 0);

const buildPayslipTotal = ({
  category,
  amount,
  children = [],
  kind = "category",
  count,
}: {
  category: string;
  amount: number;
  children?: ExpenseCategorySummary["children"];
  kind?: "category" | "group";
  count: number;
}): ExpenseCategorySummary => ({
  category,
  amount: Number(amount.toFixed(2)),
  count,
  children,
  kind,
});

export const buildPayslipBreakdown = ({
  payslips,
  otherIncomeCount,
  otherIncomeTotal,
}: {
  payslips: Payslip[];
  otherIncomeCount: number;
  otherIncomeTotal: number;
}) => {
  const count = payslips.length;
  const groupedCategories = payslipGroups.map((group) =>
    buildPayslipTotal({
      category: group.label,
      amount: sumPayslipField(payslips, group.field),
      children: group.children
        .map((child) =>
          buildPayslipTotal({
            category: child.label,
            amount: sumPayslipField(payslips, child.field),
            count,
          }),
        )
        .filter((category) => category.amount > 0),
      kind: "group",
      count,
    }),
  );
  const categories = [
    ...groupedCategories,
    buildPayslipTotal({
      category: "Net income",
      amount: sumPayslipField(payslips, "net_pay"),
      count,
    }),
    buildPayslipTotal({
      category: "Other income",
      amount: otherIncomeTotal,
      count: otherIncomeCount,
    }),
  ];

  return categories.filter((category) => category.amount > 0);
};

export const getPayslipGrossTotal = (
  payslips: Payslip[],
  otherIncomeTotal: number,
) =>
  Number(
    (sumPayslipField(payslips, "gross_pay") + otherIncomeTotal).toFixed(2),
  );
