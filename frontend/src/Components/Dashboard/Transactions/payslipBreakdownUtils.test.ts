import { describe, expect, it } from "vitest";

import {
  buildPayslipBreakdown,
  getPayslipGrossTotal,
  sumPayslipField,
} from "./payslipBreakdownUtils";
import type { Payslip } from "../shared/types";

const payslip = (overrides: Partial<Payslip> = {}): Payslip =>
  ({
    id: 1,
    gross_pay: 5000,
    pre_tax_deductions: 500,
    pretax_401k: 425,
    pretax_dental: 25,
    pretax_medical: 50,
    associate_taxes: 875,
    social_security_tax: 310,
    medicare_tax: 72.5,
    federal_withholding_tax: 350,
    state_tax: 112.5,
    ca_disability_insurance_tax: 30,
    post_tax_deductions: 125,
    posttax_401k_roth: 125,
    net_pay: 3500,
    ...overrides,
  }) as Payslip;

describe("sumPayslipField", () => {
  it("sums numeric and string payslip values", () => {
    expect(
      sumPayslipField(
        [
          payslip({ gross_pay: "1000.50" }),
          payslip({ gross_pay: 2499.5 }),
          payslip({ gross_pay: null }),
        ],
        "gross_pay",
      ),
    ).toBe(3500);
  });
});

describe("buildPayslipBreakdown", () => {
  it("builds grouped deduction/tax categories and other income", () => {
    const categories = buildPayslipBreakdown({
      payslips: [payslip()],
      otherIncomeCount: 2,
      otherIncomeTotal: 300,
    });
    const taxes = categories.find(
      (category) => category.category === "Associate taxes",
    );

    expect(categories.map((category) => category.category)).toEqual([
      "Pre-tax deductions",
      "Associate taxes",
      "Post-tax deductions",
      "Net income",
      "Other income",
    ]);
    expect(taxes?.kind).toBe("group");
    expect(taxes?.amount).toBe(875);
    expect(taxes?.children.map((child) => child.category)).toContain(
      "Federal withholding",
    );
  });

  it("filters zero-value categories", () => {
    const categories = buildPayslipBreakdown({
      payslips: [payslip({ post_tax_deductions: 0, posttax_401k_roth: 0 })],
      otherIncomeCount: 0,
      otherIncomeTotal: 0,
    });

    expect(categories.map((category) => category.category)).not.toContain(
      "Post-tax deductions",
    );
    expect(categories.map((category) => category.category)).not.toContain(
      "Other income",
    );
  });
});

describe("getPayslipGrossTotal", () => {
  it("includes other income in the gross total", () => {
    expect(getPayslipGrossTotal([payslip({ gross_pay: 5000 })], 250)).toBe(
      5250,
    );
  });
});
