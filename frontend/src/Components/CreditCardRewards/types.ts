export type CreditCardEarningReward = {
  id: number;
  category: string;
  reward_percent: number;
  keywords: string | null;
  status?: "included" | "needs_review" | "excluded";
  source?: "manual" | "vectormint" | string;
  source_description?: string | null;
  status_reason?: string | null;
  match_strategy?: string | null;
};

export type CreditCardEarningRewardTotal = {
  earning_reward_id: number;
  amount: number;
};

export type CreditCardEarningRewardTransaction = {
  id: number;
  amount: number;
  date: string;
  manual_date: string | null;
  name: string;
  merchant_name: string | null;
  category: string | null;
  manual_category: string | null;
  display_category: string | null;
};

export type CreditCardRewardOptimizerTransaction =
  CreditCardEarningRewardTransaction & {
    account_id: number;
    account_label: string;
  };

export type CreditCardEarningRewardBreakdown = {
  earning_reward_id: number;
  amount: number;
  transactions: CreditCardEarningRewardTransaction[];
};

export type CreditCardPerkAward = {
  id: number;
  name: string;
  dollar_value: number;
  completion_amount: number;
  frequency_count: number;
  frequency_period: "per_year" | "per_quarter" | "per_month";
  auto_complete: boolean;
  status?: "included" | "needs_review" | "excluded";
  source?: "manual" | "vectormint" | string;
  source_description?: string | null;
  status_reason?: string | null;
  match_strategy?: string | null;
};

export type CreditCardType = {
  id: number;
  name: string;
  annual_fee: number;
  status?: "active" | "in_review";
  source?: "manual" | "vectormint" | string;
  review_reason?: string | null;
  external_source?: string | null;
  external_card_id?: string | null;
  earning_rewards: CreditCardEarningReward[];
  perk_awards: CreditCardPerkAward[];
};

export type CreditCardPerkCompletion = {
  perk_award_id: number;
  occurrence_index: number;
};

export type CreditCardRewardsAccount = {
  id: number;
  name: string;
  mask: string | null;
  official_name: string | null;
  subtype: string | null;
  type: string | null;
  institution_name: string | null;
  credit_card_type_id: number | null;
  credit_card_type: CreditCardType | null;
  effective_month: string | null;
  perk_completions: CreditCardPerkCompletion[];
  earning_reward_totals: CreditCardEarningRewardTotal[];
  earning_reward_breakdowns?: CreditCardEarningRewardBreakdown[];
};

export type CreditCardRewardOptimizationTransactionFinding = {
  transaction: CreditCardRewardOptimizerTransaction;
  actual_card_type_id: number;
  actual_card_name: string;
  actual_reward_category: string | null;
  actual_reward_percent: number;
  actual_reward_value: number;
  recommended_card_type_id: number;
  recommended_card_name: string;
  recommended_reward_category: string | null;
  recommended_reward_percent: number;
  optimized_reward_value: number;
  missed_reward_value: number;
};

export type CreditCardRewardOptimizationGroup = {
  group_type: "category" | "vendor";
  group_label: string;
  actual_card_type_id: number;
  actual_card_name: string;
  recommended_card_type_id: number;
  recommended_card_name: string;
  transaction_count: number;
  total_spend: number;
  actual_reward_value: number;
  optimized_reward_value: number;
  missed_reward_value: number;
  largest_missed_reward_value: number;
  priority_score: number;
  transactions: CreditCardRewardOptimizationTransactionFinding[];
};

export type CreditCardRewardOptimization = {
  period_start: string;
  period_end: string;
  actual_reward_value: number;
  optimized_reward_value: number;
  missed_reward_value: number;
  recommendation_groups: CreditCardRewardOptimizationGroup[];
};

export type CreditCardRewardCardRecommendationTransaction = {
  transaction: CreditCardRewardOptimizerTransaction;
  baseline_card_type_id: number | null;
  baseline_card_name: string | null;
  baseline_reward_value: number;
  candidate_reward_category: string | null;
  candidate_reward_percent: number;
  candidate_reward_value: number;
  additional_reward_value: number;
};

export type CreditCardRewardCardRecommendationCategory = {
  category: string;
  candidate_reward_category: string;
  candidate_reward_percent: number;
  total_spend: number;
  current_reward_value: number;
  expected_reward_value: number;
  additional_reward_value: number;
  transaction_count: number;
};

export type CreditCardRewardCardRecommendation = {
  card_type_id: number;
  card_type_name: string;
  annual_fee: number;
  transaction_count: number;
  total_spend: number;
  projected_reward_value: number;
  additional_reward_value: number;
  net_annual_value: number;
  top_categories: CreditCardRewardCardRecommendationCategory[];
  category_breakdown: CreditCardRewardCardRecommendationCategory[];
  transactions: CreditCardRewardCardRecommendationTransaction[];
};

export type CreditCardNewCardRecommendations = {
  period_start: string;
  period_end: string;
  best_overall: CreditCardRewardCardRecommendation | null;
  best_no_annual_fee: CreditCardRewardCardRecommendation | null;
  recommendations: CreditCardRewardCardRecommendation[];
};

export type CreditCardRewardsData = {
  selected_month: string;
  accounts: CreditCardRewardsAccount[];
  card_types: CreditCardType[];
  optimization?: CreditCardRewardOptimization;
  card_recommendations?: CreditCardNewCardRecommendations;
};

export type CreditCardRewardOptimizationData = {
  optimization: CreditCardRewardOptimization;
  card_recommendations: CreditCardNewCardRecommendations;
};

export type CreateCreditCardEarningRewardInput = {
  id?: number;
  category: string;
  reward_percent: number;
  keywords?: string | null;
  status?: "included" | "needs_review" | "excluded";
  source?: string;
  source_description?: string | null;
  status_reason?: string | null;
  match_strategy?: string | null;
};

export type CreateCreditCardPerkAwardInput = {
  id?: number;
  name: string;
  dollar_value: number;
  frequency_count: number;
  frequency_period: "per_year" | "per_quarter" | "per_month";
  auto_complete: boolean;
  status?: "included" | "needs_review" | "excluded";
  source?: string;
  source_description?: string | null;
  status_reason?: string | null;
  match_strategy?: string | null;
};

export type CreateCreditCardTypeInput = {
  name: string;
  annual_fee: number;
  earning_rewards: CreateCreditCardEarningRewardInput[];
  perk_awards: CreateCreditCardPerkAwardInput[];
};

export type VectorMintImportSummary = {
  fetched_count: number;
  matched_count: number;
  created_review_count: number;
  updated_count: number;
  unchanged_count: number;
  benefits_added_count: number;
  benefits_updated_count: number;
  benefits_preserved_count: number;
  review_required_count: number;
  warnings: string[];
};

export type VectorMintImportResult = {
  import_summary: VectorMintImportSummary;
  rewards: CreditCardRewardsData;
};
