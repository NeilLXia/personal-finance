import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCreditCardType,
  deleteCreditCardType,
  fetchCreditCardRewardOptimization,
  fetchCreditCardRewards,
  importVectorMintCardCatalog,
  updateCreditCardAccountType,
  updateCreditCardPerkCompletion,
  updateCreditCardType,
} from "./creditCardRewardsApi";
import type { CreateCreditCardTypeInput, CreditCardRewardsData } from "./types";

export const creditCardRewardsQueryKey = (selectedMonth: string) =>
  ["credit-card-rewards", selectedMonth] as const;

export const creditCardRewardOptimizationQueryKey = (selectedMonth: string) =>
  ["credit-card-rewards", selectedMonth, "optimization"] as const;

export const useCreditCardRewards = ({
  selectedMonth,
}: {
  selectedMonth: string;
}) => {
  const queryClient = useQueryClient();
  const queryKey = creditCardRewardsQueryKey(selectedMonth);
  const optimizationQueryKey =
    creditCardRewardOptimizationQueryKey(selectedMonth);
  const rewardsQuery = useQuery({
    queryKey,
    queryFn: () => fetchCreditCardRewards(selectedMonth),
    retry: false,
  });
  const optimizationQuery = useQuery({
    queryKey: optimizationQueryKey,
    queryFn: () => fetchCreditCardRewardOptimization(selectedMonth),
    enabled: false,
    retry: false,
  });
  const assignmentMutation = useMutation({
    mutationFn: (
      params: Omit<
        Parameters<typeof updateCreditCardAccountType>[0],
        "selectedMonth"
      >,
    ) => updateCreditCardAccountType({ ...params, selectedMonth }),
    onSuccess: (data: CreditCardRewardsData) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
  const createCardTypeMutation = useMutation({
    mutationFn: (input: CreateCreditCardTypeInput) =>
      createCreditCardType({ input, selectedMonth }),
    onSuccess: (data: CreditCardRewardsData) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
  const perkCompletionMutation = useMutation({
    mutationFn: (
      params: Omit<
        Parameters<typeof updateCreditCardPerkCompletion>[0],
        "selectedMonth"
      >,
    ) => updateCreditCardPerkCompletion({ ...params, selectedMonth }),
    onSuccess: (data: CreditCardRewardsData) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
  const updateCardTypeMutation = useMutation({
    mutationFn: (
      params: Omit<
        Parameters<typeof updateCreditCardType>[0],
        "selectedMonth"
      >,
    ) => updateCreditCardType({ ...params, selectedMonth }),
    onSuccess: (data: CreditCardRewardsData) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
  const deleteCardTypeMutation = useMutation({
    mutationFn: (cardTypeId: number) =>
      deleteCreditCardType({ cardTypeId, selectedMonth }),
    onSuccess: (data: CreditCardRewardsData) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
  const importVectorMintMutation = useMutation({
    mutationFn: () => importVectorMintCardCatalog({ selectedMonth }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data.rewards);
    },
  });
  const isCurrentSnapshot =
    rewardsQuery.data?.selected_month === selectedMonth;

  return {
    data: isCurrentSnapshot ? rewardsQuery.data || null : null,
    error: rewardsQuery.error,
    isAvailable: rewardsQuery.isLoading || rewardsQuery.isSuccess,
    isCreatingCardType: createCardTypeMutation.isPending,
    isDeletingCardType: deleteCardTypeMutation.isPending,
    isLoading: rewardsQuery.isLoading,
    isImportingVectorMintCards: importVectorMintMutation.isPending,
    isOptimizationLoading: optimizationQuery.isFetching,
    isUpdating: assignmentMutation.isPending,
    isUpdatingCardType: updateCardTypeMutation.isPending,
    isUpdatingPerkCompletion: perkCompletionMutation.isPending,
    optimizationData: optimizationQuery.data || null,
    optimizationError: optimizationQuery.error,
    createCardType: createCardTypeMutation.mutateAsync,
    deleteCardType: deleteCardTypeMutation.mutateAsync,
    loadOptimization: optimizationQuery.refetch,
    importVectorMintCards: importVectorMintMutation.mutateAsync,
    updateAccountType: assignmentMutation.mutate,
    updateCardType: updateCardTypeMutation.mutateAsync,
    updatePerkCompletion: perkCompletionMutation.mutate,
  };
};
