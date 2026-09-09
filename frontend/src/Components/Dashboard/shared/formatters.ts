import type { Transaction } from "./types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const tooltipCompactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const signedCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "always",
});

export const formatCurrency = (value: string | number | null | undefined) =>
  currencyFormatter.format(Number(value || 0));

export const formatCompactCurrency = (value: number) =>
  compactCurrencyFormatter.format(value);

export const formatTooltipCompactCurrency = (value: number) =>
  Math.abs(value) >= 1000
    ? tooltipCompactCurrencyFormatter.format(value)
    : compactCurrencyFormatter.format(value);

export const maskCurrency = (
  value: string | number | null | undefined,
  isMasked: boolean,
) => (isMasked ? "$XXX,XXX" : formatCurrency(value));

export const maskCompactCurrency = (value: number, isMasked: boolean) =>
  isMasked ? "$XXX,XXX" : formatCompactCurrency(value);

export const maskTooltipCompactCurrency = (value: number, isMasked: boolean) =>
  isMasked ? "$XXX,XXX" : formatTooltipCompactCurrency(value);

export const formatTransactionAmount = (value: string | number) => {
  const amount = Number(value);
  const signedAmount = amount > 0 ? -amount : Math.abs(amount);

  return signedCurrencyFormatter.format(signedAmount);
};

export const formatDate = (value: string) => {
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString();
};

export const getDateInputValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return value.split("T")[0];
};

export const getTransactionEffectiveDate = (transaction: Transaction) =>
  getDateInputValue(transaction.manual_date) ||
  getDateInputValue(transaction.date);

export const getDefaultDashboardMonth = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const formatShortDate = (value: string) => {
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const formatDateRange = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) {
    return "Selected range";
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};
