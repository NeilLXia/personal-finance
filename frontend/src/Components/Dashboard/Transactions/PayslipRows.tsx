import {
  formatCurrency,
  formatDate,
} from "../shared/formatters";
import shared from "../dashboard.shared.module.css";
import styles from "./index.module.css";
import type { Payslip } from "../shared/types";
import type {
  PayslipSortColumn,
  TransactionSortDirection,
} from "./tableUtils";
import { getVisiblePayslipAmounts } from "./tableUtils";

type PayslipRowsProps = {
  expandedPayslipId: number | null;
  payslipSearchTerms: Record<PayslipSortColumn, string>;
  payslipSortColumn: PayslipSortColumn;
  payslipSortDirection: TransactionSortDirection;
  visiblePayslips: Payslip[];
  onExpandedPayslipChange: (payslipId: number | null) => void;
};

const PayslipRows = ({
  expandedPayslipId,
  payslipSearchTerms,
  payslipSortColumn,
  visiblePayslips,
  onExpandedPayslipChange,
}: PayslipRowsProps) => {
  if (visiblePayslips.length === 0) {
    return <p className={shared.emptyText}>No income for this range.</p>;
  }

  return visiblePayslips.map((payslip) => {
    const isExpanded = expandedPayslipId === payslip.id;
    const toggleExpanded = () =>
      onExpandedPayslipChange(isExpanded ? null : payslip.id);
    const preTaxRows = getVisiblePayslipAmounts([
      { label: "401K", value: payslip.pretax_401k },
      {
        label: "401K bonus deferral",
        value: payslip.pretax_401k_bonus_deferral,
      },
      { label: "Dental", value: payslip.pretax_dental },
      { label: "FSA healthcare", value: payslip.pretax_fsa_healthcare },
      { label: "HSA", value: payslip.pretax_hsa },
      { label: "Medical", value: payslip.pretax_medical },
    ]);
    const taxRows = getVisiblePayslipAmounts([
      { label: "Social Security", value: payslip.social_security_tax },
      { label: "Medicare", value: payslip.medicare_tax },
      {
        label: "Federal withholding",
        value: payslip.federal_withholding_tax,
      },
      { label: "State tax", value: payslip.state_tax },
      {
        label: "CA disability insurance",
        value: payslip.ca_disability_insurance_tax,
      },
    ]);
    const postTaxRows = getVisiblePayslipAmounts([
      { label: "401K Roth", value: payslip.posttax_401k_roth },
      {
        label: "401K bonus deferral Roth",
        value: payslip.posttax_401k_bonus_deferral_roth,
      },
    ]);

    return (
      <article
        className={`${styles.payslipRow} ${
          isExpanded ? styles.payslipRowExpanded : ""
        }`}
        key={payslip.id}
        onClick={toggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleExpanded();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div
          className={
            payslipSortColumn === "date" || payslipSearchTerms.date
              ? styles.transactionActiveColumn
              : ""
          }
        >
          <strong>{formatDate(payslip.check_date)}</strong>
          <span className={styles.payslipDateRange}>
            {formatDate(payslip.pay_period_begin)} -{" "}
            {formatDate(payslip.pay_period_end)}
          </span>
        </div>
        <div
          className={
            payslipSortColumn === "company" || payslipSearchTerms.company
              ? styles.transactionActiveColumn
              : ""
          }
        >
          <strong>{payslip.employer_name || "Employer unavailable"}</strong>
          <span>{payslip.hours_worked || "0"} hours</span>
        </div>
        <div
          className={
            payslipSortColumn === "amount" || payslipSearchTerms.amount
              ? styles.transactionActiveColumn
              : ""
          }
        >
          <strong>Net {formatCurrency(payslip.net_pay)}</strong>
        </div>
        {isExpanded && (
          <div className={styles.payslipDetails}>
            <div>
              <strong>Gross pay</strong>
              <span>{formatCurrency(payslip.gross_pay)}</span>
            </div>
            <div>
              <strong>Pre-tax deductions</strong>
              <span>{formatCurrency(payslip.pre_tax_deductions)}</span>
              {preTaxRows.map((row) => (
                <small key={row.label}>
                  {row.label}: {formatCurrency(row.value)}
                </small>
              ))}
            </div>
            <div>
              <strong>Associate taxes</strong>
              <span>{formatCurrency(payslip.associate_taxes)}</span>
              {taxRows.map((row) => (
                <small key={row.label}>
                  {row.label}: {formatCurrency(row.value)}
                </small>
              ))}
            </div>
            <div>
              <strong>Post-tax deductions</strong>
              <span>{formatCurrency(payslip.post_tax_deductions)}</span>
              {postTaxRows.map((row) => (
                <small key={row.label}>
                  {row.label}: {formatCurrency(row.value)}
                </small>
              ))}
            </div>
          </div>
        )}
      </article>
    );
  });
};

export default PayslipRows;
