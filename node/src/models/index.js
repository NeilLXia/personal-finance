'use strict';

module.exports = {
  users: require('./userModel'),
  plaidItems: require('./plaidItemModel'),
  accounts: require('./accountModel'),
  accountBalanceHistory: require('./accountBalanceHistoryModel'),
  budgetTargets: require('./budgetTargetModel'),
  payslips: require('./payslipModel'),
  properties: require('./propertyModel'),
  transactionCategoryRules: require('./transactionCategoryRuleModel'),
  transactions: require('./transactionModel'),
  dashboardReports: require('./dashboardReportQueries'),
};
