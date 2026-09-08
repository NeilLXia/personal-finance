export const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day || 1);
};

export const getMonthKey = (value: string) => value.split("T")[0].slice(0, 7);

export const getPreviousMonthKey = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonth = new Date(year, monthNumber - 2, 1);

  return `${previousMonth.getFullYear()}-${String(
    previousMonth.getMonth() + 1,
  ).padStart(2, "0")}`;
};
