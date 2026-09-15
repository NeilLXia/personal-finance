import { getJson, postJson, putJson, request } from "../../shared/apiClient";
import type { CreateCreditCardTypeInput, CreditCardRewardsData } from "./types";

const buildRewardsPath = (selectedMonth: string) => {
  const params = new URLSearchParams({ month: selectedMonth });

  return `/api/credit-card-rewards?${params.toString()}`;
};

export const fetchCreditCardRewards = (selectedMonth: string) =>
  getJson<CreditCardRewardsData>(
    buildRewardsPath(selectedMonth),
    {},
    "Credit card rewards request failed",
  );

export const updateCreditCardAccountType = ({
  accountId,
  creditCardTypeId,
  effectiveMonth,
  selectedMonth,
}: {
  accountId: number;
  creditCardTypeId: number | null;
  effectiveMonth: string | null;
  selectedMonth: string;
}) =>
  putJson<CreditCardRewardsData>(
    `/api/credit-card-rewards/accounts/${accountId}`,
    {
      credit_card_type_id: creditCardTypeId,
      effective_month: effectiveMonth,
      selected_month: selectedMonth,
    },
    {},
    "Credit card assignment failed",
  );

export const createCreditCardType = ({
  input,
  selectedMonth,
}: {
  input: CreateCreditCardTypeInput;
  selectedMonth: string;
}) =>
  postJson<CreditCardRewardsData>(
    "/api/credit-card-rewards/card-types",
    { ...input, selected_month: selectedMonth },
    {},
    "Credit card type creation failed",
  );

export const updateCreditCardType = ({
  cardTypeId,
  input,
  selectedMonth,
}: {
  cardTypeId: number;
  input: CreateCreditCardTypeInput;
  selectedMonth: string;
}) =>
  putJson<CreditCardRewardsData>(
    `/api/credit-card-rewards/card-types/${cardTypeId}`,
    { ...input, selected_month: selectedMonth },
    {},
    "Credit card type update failed",
  );

export const deleteCreditCardType = async ({
  cardTypeId,
  selectedMonth,
}: {
  cardTypeId: number;
  selectedMonth: string;
}) => {
  const params = new URLSearchParams({ month: selectedMonth });
  const response = await request(
    `/api/credit-card-rewards/card-types/${cardTypeId}?${params.toString()}`,
    { method: "DELETE" },
    "Credit card type deletion failed",
  );

  return response.json() as Promise<CreditCardRewardsData>;
};

export const updateCreditCardPerkCompletion = ({
  accountId,
  perkAwardId,
  occurrenceIndex,
  completed,
  selectedMonth,
}: {
  accountId: number;
  perkAwardId: number;
  occurrenceIndex: number;
  completed: boolean;
  selectedMonth: string;
}) =>
  putJson<CreditCardRewardsData>(
    `/api/credit-card-rewards/accounts/${accountId}/perk-completions`,
    {
      perk_award_id: perkAwardId,
      occurrence_index: occurrenceIndex,
      completed,
      selected_month: selectedMonth,
    },
    {},
    "Perk completion update failed",
  );
