import { formatCurrency, formatDate, formatTransactionAmount } from "../shared/formatters";
import { getTransactionEffectiveDate } from "../shared/formatters";
import type { Payslip, Transaction } from "../shared/types";

export type TransactionSortColumn = "name" | "date" | "amount";
export type PayslipSortColumn = "company" | "date" | "amount";
export type TransactionSortDirection = "asc" | "desc";

export const getTransactionSearchName = (transaction: Transaction) =>
  [
    transaction.merchant_name,
    transaction.name,
    transaction.account_name,
    transaction.account_mask,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const getSignedTransactionAmount = (transaction: Transaction) => {
  const amount = Number(transaction.amount || 0);

  return amount > 0 ? -amount : Math.abs(amount);
};

export const getTransactionSelectionSummary = (transactions: Transaction[]) => {
  const transactionDates = transactions
    .map(getTransactionEffectiveDate)
    .filter(Boolean)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate));
  const totalAmount = transactions.reduce(
    (total, transaction) => total + getSignedTransactionAmount(transaction),
    0,
  );

  return {
    count:
      transactions.length === 1
        ? "1 transaction"
        : `${transactions.length} transactions`,
    dateRange:
      transactionDates.length === 0
        ? "No dates"
        : transactionDates[0] === transactionDates[transactionDates.length - 1]
          ? formatDate(transactionDates[0])
          : `${formatDate(transactionDates[0])} - ${formatDate(
              transactionDates[transactionDates.length - 1],
            )}`,
    amountTotal: `${formatCurrency(totalAmount)} total`,
  };
};

export const getPayslipSearchName = (payslip: Payslip) =>
  [
    payslip.employer_name,
    payslip.employee_name,
    payslip.employee_id,
    payslip.check_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const getPayslipSearchAmount = (payslip: Payslip) =>
  [
    payslip.gross_pay,
    payslip.pre_tax_deductions,
    payslip.pretax_401k,
    payslip.pretax_401k_bonus_deferral,
    payslip.pretax_dental,
    payslip.pretax_fsa_healthcare,
    payslip.pretax_hsa,
    payslip.pretax_medical,
    payslip.associate_taxes,
    payslip.social_security_tax,
    payslip.medicare_tax,
    payslip.federal_withholding_tax,
    payslip.state_tax,
    payslip.ca_disability_insurance_tax,
    payslip.post_tax_deductions,
    payslip.posttax_401k_roth,
    payslip.posttax_401k_bonus_deferral_roth,
    payslip.net_pay,
  ]
    .map((value) => formatCurrency(value))
    .join(" ")
    .toLowerCase();

export const isDateWithinPayPeriod = (dateSearch: string, payslip: Payslip) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSearch)) {
    return false;
  }

  return (
    dateSearch >= payslip.pay_period_begin &&
    dateSearch <= payslip.pay_period_end
  );
};

export const getPayslipSelectionSummary = (payslips: Payslip[]) => {
  const payPeriodDates = payslips
    .flatMap((payslip) => [payslip.pay_period_begin, payslip.pay_period_end])
    .filter(Boolean)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate));
  const grossPayTotal = payslips.reduce(
    (total, payslip) => total + Number(payslip.gross_pay || 0),
    0,
  );

  return {
    count: payslips.length === 1 ? "1 payslip" : `${payslips.length} payslips`,
    dateRange:
      payPeriodDates.length === 0
        ? "No dates"
        : payPeriodDates[0] === payPeriodDates[payPeriodDates.length - 1]
          ? formatDate(payPeriodDates[0])
          : `${formatDate(payPeriodDates[0])} - ${formatDate(
              payPeriodDates[payPeriodDates.length - 1],
            )}`,
    amountTotal: `${formatCurrency(grossPayTotal)} gross`,
  };
};

export const getVisiblePayslipAmounts = (
  rows: Array<{ label: string; value: string | number | null }>,
) => rows.filter((row) => Number(row.value || 0) !== 0);

export const buildSortedTransactions = ({
  transactions,
  searchTerms,
  sortColumn,
  sortDirection,
}: {
  transactions: Transaction[];
  searchTerms: Record<TransactionSortColumn, string>;
  sortColumn: TransactionSortColumn;
  sortDirection: TransactionSortDirection;
}) => {
  const nameSearch = searchTerms.name.trim().toLowerCase();
  const dateSearch = searchTerms.date.trim().toLowerCase();
  const amountSearch = searchTerms.amount.trim().toLowerCase();

  return transactions
    .filter((transaction) => {
      const signedAmount = getSignedTransactionAmount(transaction);
      const amountText = [
        String(transaction.amount),
        String(signedAmount),
        formatTransactionAmount(transaction.amount),
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!nameSearch ||
          getTransactionSearchName(transaction).includes(nameSearch)) &&
        (!dateSearch ||
          getTransactionEffectiveDate(transaction)
            .toLowerCase()
            .includes(dateSearch) ||
          formatDate(getTransactionEffectiveDate(transaction))
            .toLowerCase()
            .includes(dateSearch)) &&
        (!amountSearch || amountText.includes(amountSearch))
      );
    })
    .sort((firstTransaction, secondTransaction) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortColumn === "name") {
        return (
          getTransactionSearchName(firstTransaction).localeCompare(
            getTransactionSearchName(secondTransaction),
          ) * direction
        );
      }

      if (sortColumn === "amount") {
        return (
          (getSignedTransactionAmount(firstTransaction) -
            getSignedTransactionAmount(secondTransaction)) *
          direction
        );
      }

      return (
        getTransactionEffectiveDate(firstTransaction).localeCompare(
          getTransactionEffectiveDate(secondTransaction),
        ) * direction
      );
    });
};

export const buildSortedPayslips = ({
  payslips,
  searchTerms,
  sortColumn,
  sortDirection,
}: {
  payslips: Payslip[];
  searchTerms: Record<PayslipSortColumn, string>;
  sortColumn: PayslipSortColumn;
  sortDirection: TransactionSortDirection;
}) => {
  const companySearch = searchTerms.company.trim().toLowerCase();
  const dateSearch = searchTerms.date.trim().toLowerCase();
  const amountSearch = searchTerms.amount.trim().toLowerCase();

  return payslips
    .filter((payslip) => {
      const dateText = [
        payslip.pay_period_begin,
        payslip.pay_period_end,
        payslip.check_date,
        formatDate(payslip.pay_period_begin),
        formatDate(payslip.pay_period_end),
        formatDate(payslip.check_date),
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!companySearch ||
          getPayslipSearchName(payslip).includes(companySearch)) &&
        (!dateSearch ||
          isDateWithinPayPeriod(dateSearch, payslip) ||
          dateText.includes(dateSearch)) &&
        (!amountSearch || getPayslipSearchAmount(payslip).includes(amountSearch))
      );
    })
    .sort((firstPayslip, secondPayslip) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortColumn === "company") {
        return (
          getPayslipSearchName(firstPayslip).localeCompare(
            getPayslipSearchName(secondPayslip),
          ) * direction
        );
      }

      if (sortColumn === "amount") {
        return (
          (Number(firstPayslip.gross_pay || 0) -
            Number(secondPayslip.gross_pay || 0)) *
          direction
        );
      }

      return (
        firstPayslip.check_date.localeCompare(secondPayslip.check_date) *
        direction
      );
    });
};
