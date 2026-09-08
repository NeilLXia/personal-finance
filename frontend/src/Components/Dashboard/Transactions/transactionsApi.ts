import { postJson } from "../../../shared/apiClient";

export const updateTransactionsCategoryRules = async (
  transactionIds: number[],
  manualCategory: string,
) => {
  await Promise.all(
    transactionIds.map((transactionId) =>
      postJson(
        `/api/transactions/${transactionId}/category-rule`,
        {
          manual_category: manualCategory,
        },
        {},
        "Category update failed",
      ),
    ),
  );
};

export const updateTransactionManualDate = async (
  transactionId: number,
  manualDate: string,
) => {
  await postJson(
    `/api/transactions/${transactionId}/manual-date`,
    {
      manual_date: manualDate,
    },
    {},
    "Date update failed",
  );
};
