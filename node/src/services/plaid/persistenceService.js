'use strict';

const models = require('../../models');

const saveAccounts = async ({ userId, plaidItemId, accounts, balanceDate = null }) => {
  return Promise.all(
    accounts.map(async (account) => {
      const savedAccount = await models.accounts.upsert({
        userId,
        plaidItemId,
        plaidAccountId: account.account_id,
        name: account.name,
        mask: account.mask,
        officialName: account.official_name,
        subtype: account.subtype,
        type: account.type,
        balanceAvailable: account.balances?.available,
        balanceCurrent: account.balances?.current,
        balanceLimit: account.balances?.limit,
        isoCurrencyCode: account.balances?.iso_currency_code,
        unofficialCurrencyCode: account.balances?.unofficial_currency_code,
      });

      await models.accountBalanceHistory.createDailySnapshot({
        accountId: savedAccount.id,
        balanceDate,
        balanceAvailable: account.balances?.available,
        balanceCurrent: account.balances?.current,
        balanceLimit: account.balances?.limit,
        isoCurrencyCode: account.balances?.iso_currency_code,
        unofficialCurrencyCode: account.balances?.unofficial_currency_code,
      });

      return savedAccount;
    }),
  );
};

const saveTransactions = async ({ transactions }) => {
  return Promise.all(
    transactions.map(async (transaction) => {
      const account = await models.accounts.findByPlaidAccountId(
        transaction.account_id,
      );

      if (!account) {
        return null;
      }

      return models.transactions.upsert({
        accountId: account.id,
        plaidTransactionId: transaction.transaction_id,
        amount: transaction.amount,
        category: transaction.category?.join(', '),
        date: transaction.date,
        merchantName: transaction.merchant_name,
        name: transaction.name,
        pending: transaction.pending,
      });
    }),
  );
};

module.exports = {
  saveAccounts,
  saveTransactions,
};
