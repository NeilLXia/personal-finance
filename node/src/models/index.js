'use strict';

module.exports = {
  users: require('./userModel'),
  plaidItems: require('./plaidItemModel'),
  accounts: require('./accountModel'),
  accountBalanceHistory: require('./accountBalanceHistoryModel'),
  budgetTargets: require('./budgetTargetModel'),
  categorizationSuggestions: require('./categorizationSuggestionModel'),
  creditCardRewards: require('./creditCardRewardsModel'),
  payslips: require('./payslipModel'),
  properties: require('./propertyModel'),
  transactionCategoryRules: require('./transactionCategoryRuleModel'),
  transactions: require('./transactionModel'),
  dashboardReports: require('./dashboardReportQueries'),
};
