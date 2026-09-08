'use strict';

const db = require('../../db/connection');
const models = require('../../models');
const { clearDemoUserData } = require('./cleanup');
const {
  demoEmail,
  formatDate,
  addMonths,
  monthStart,
  monthEnd,
  createDemoEmail,
  getDemoExpirationDate,
  createDemoSeedIds,
  monthlyExpenses,
  budgetTargets,
} = require('./fixtures');

const upsertUser = async ({ email = demoEmail, expiresAt = null } = {}) => {
  const { rows } = await db.query(
    `
      INSERT INTO users (email, name, is_demo, demo_expires_at)
      VALUES ($1, 'Demo User', TRUE, $2)
      ON CONFLICT (email) DO UPDATE
      SET
        name = EXCLUDED.name,
        is_demo = TRUE,
        demo_expires_at = EXCLUDED.demo_expires_at,
        updated_at = NOW()
      RETURNING *
    `,
    [email, expiresAt],
  );

  return rows[0];
};

// plaid_items / accounts go through the normal models so demo data picks up the
// same token encryption and owner-conflict guard as a real Plaid link.
const saveDemoPlaidItem = ({ userId, plaidItemId }) =>
  models.plaidItems.upsert({
    userId,
    plaidItemId,
    accessToken: 'access-sandbox-demo-2025-2026',
    plaidEnvironment: 'sandbox',
    institutionId: 'ins_demo_sandbox',
    institutionName: 'Plaid Sandbox Demo Bank',
  });

const saveDemoAccount = ({
  userId,
  plaidItemId,
  plaidAccountId,
  name,
  mask,
  subtype,
  type,
  balanceCurrent,
  balanceLimit = null,
}) =>
  models.accounts.upsert({
    userId,
    plaidItemId,
    plaidAccountId,
    name,
    mask,
    officialName: null,
    subtype,
    type,
    balanceAvailable: balanceCurrent,
    balanceCurrent,
    balanceLimit,
    isoCurrencyCode: 'USD',
    unofficialCurrencyCode: null,
  });

const upsertBalanceSnapshot = async ({
  accountId,
  balanceDate,
  balanceCurrent,
  balanceLimit = null,
}) => {
  await db.query(
    `
      INSERT INTO account_balance_history (
        account_id,
        balance_date,
        balance_current,
        balance_available,
        balance_limit,
        iso_currency_code
      )
      VALUES ($1, $2, $3, $3, $4, 'USD')
      ON CONFLICT (account_id, balance_date) DO UPDATE
      SET
        balance_current = EXCLUDED.balance_current,
        balance_available = EXCLUDED.balance_available,
        balance_limit = EXCLUDED.balance_limit,
        iso_currency_code = EXCLUDED.iso_currency_code
    `,
    [accountId, balanceDate, balanceCurrent, balanceLimit],
  );
};

// Raw because demo transactions carry a seeded manual_category, which the normal
// transactions model does not accept on write.
const upsertTransaction = async ({
  accountId,
  plaidTransactionId,
  amount,
  category,
  date,
  merchantName,
  name,
  manualCategory = null,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO transactions (
        account_id,
        plaid_transaction_id,
        amount,
        category,
        date,
        merchant_name,
        name,
        manual_category,
        pending
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
      ON CONFLICT (plaid_transaction_id) DO UPDATE
      SET
        account_id = EXCLUDED.account_id,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        date = EXCLUDED.date,
        merchant_name = EXCLUDED.merchant_name,
        name = EXCLUDED.name,
        manual_category = EXCLUDED.manual_category,
        pending = FALSE,
        updated_at = NOW()
      RETURNING *
    `,
    [
      accountId,
      plaidTransactionId,
      amount,
      category,
      date,
      merchantName,
      name,
      manualCategory,
    ],
  );

  return rows[0];
};

const seedPayslip = ({
  userId,
  incomeTransactionId,
  payPeriodBegin,
  payPeriodEnd,
  checkDate,
  checkNumber,
}) =>
  models.payslips.upsert({
    userId,
    uploadId: null,
    payslipIdentifier: [
      'DEMO-EMP-2025',
      payPeriodBegin,
      payPeriodEnd,
      checkDate,
      checkNumber,
    ].join('|'),
    employeeName: 'Demo User',
    employerName: 'Acme Analytics',
    employeeId: 'DEMO-EMP-2025',
    payPeriodBegin,
    payPeriodEnd,
    checkDate,
    checkNumber,
    hoursWorked: 80,
    grossPay: 5000,
    preTaxDeductions: 500,
    pretax401k: 425,
    pretax401kBonusDeferral: 0,
    pretaxDental: 25,
    pretaxFsaHealthcare: 0,
    pretaxHsa: 0,
    pretaxMedical: 50,
    associateTaxes: 875,
    socialSecurityTax: 310,
    medicareTax: 72.5,
    federalWithholdingTax: 350,
    stateTax: 112.5,
    caDisabilityInsuranceTax: 30,
    postTaxDeductions: 125,
    posttax401kRoth: 125,
    posttax401kBonusDeferralRoth: 0,
    netPay: 3500,
    incomeTransactionId,
  });

const seedBalances = async (accounts) => {
  for (let index = 0; index < 24; index += 1) {
    const date = formatDate(addMonths(monthStart(2025, 0), index));
    await upsertBalanceSnapshot({
      accountId: accounts.checking.id,
      balanceDate: date,
      balanceCurrent: 8200 + index * 235 + (index % 3) * 120,
    });
    await upsertBalanceSnapshot({
      accountId: accounts.credit.id,
      balanceDate: date,
      balanceCurrent: 1450 + (index % 6) * 210,
      balanceLimit: 18000,
    });
    await upsertBalanceSnapshot({
      accountId: accounts.brokerage.id,
      balanceDate: date,
      balanceCurrent: 38250 + index * 740 + (index % 4) * 430,
    });
    await upsertBalanceSnapshot({
      accountId: accounts.retirement.id,
      balanceDate: date,
      balanceCurrent: 96500 + index * 1225 + (index % 5) * 560,
    });
  }
};

const seedTransactions = async (accounts, userId, seedIds) => {
  for (let index = 0; index < 24; index += 1) {
    const month = addMonths(monthStart(2025, 0), index);
    const monthKey = formatDate(month).slice(0, 7);
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const firstPayday = formatDate(new Date(Date.UTC(year, monthIndex, 15)));
    const secondPayday = formatDate(new Date(Date.UTC(year, monthIndex, 28)));
    const firstPeriodBegin = formatDate(new Date(Date.UTC(year, monthIndex, 1)));
    const firstPeriodEnd = formatDate(new Date(Date.UTC(year, monthIndex, 15)));
    const secondPeriodBegin = formatDate(new Date(Date.UTC(year, monthIndex, 16)));
    const secondPeriodEnd = formatDate(monthEnd(year, monthIndex));

    const firstIncomeTransaction = await upsertTransaction({
      accountId: accounts.checking.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-pay-1`,
      amount: -3500,
      category: 'Payroll',
      date: firstPayday,
      merchantName: 'Acme Analytics',
      name: 'Payroll deposit',
      manualCategory: 'Income',
    });
    const secondIncomeTransaction = await upsertTransaction({
      accountId: accounts.checking.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-pay-2`,
      amount: -3500,
      category: 'Payroll',
      date: secondPayday,
      merchantName: 'Acme Analytics',
      name: 'Payroll deposit',
      manualCategory: 'Income',
    });
    await seedPayslip({
      userId,
      incomeTransactionId: firstIncomeTransaction.id,
      payPeriodBegin: firstPeriodBegin,
      payPeriodEnd: firstPeriodEnd,
      checkDate: firstPayday,
      checkNumber: `${seedIds.transactions.prefix}-${monthKey}-1`,
    });
    await seedPayslip({
      userId,
      incomeTransactionId: secondIncomeTransaction.id,
      payPeriodBegin: secondPeriodBegin,
      payPeriodEnd: secondPeriodEnd,
      checkDate: secondPayday,
      checkNumber: `${seedIds.transactions.prefix}-${monthKey}-2`,
    });
    await upsertTransaction({
      accountId: accounts.brokerage.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-brokerage-contribution`,
      amount: -1430,
      category: 'Financial Planning and Investments',
      date: formatDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 9))),
      merchantName: 'Fidelity',
      name: 'Brokerage contribution',
      manualCategory: 'Savings',
    });
    await upsertTransaction({
      accountId: accounts.retirement.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-401k-contribution`,
      amount: -1000,
      category: 'Financial Planning and Investments',
      date: firstPayday,
      merchantName: 'Acme 401k Plan',
      name: '401k contribution',
      manualCategory: 'Savings',
    });

    for (const [key, amount, category, merchantName, name, manualCategory] of monthlyExpenses) {
      await upsertTransaction({
        accountId: ['shopping', 'travel', 'entertainment'].includes(key)
          ? accounts.credit.id
          : accounts.checking.id,
        plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-${key}`,
        amount,
        category,
        date: formatDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 3 + monthlyExpenses.findIndex((expense) => expense[0] === key)))),
        merchantName,
        name,
        manualCategory,
      });
    }

    await upsertTransaction({
      accountId: accounts.credit.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-credit-payment`,
      amount: -1125,
      category: 'Credit Card',
      date: formatDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 18))),
      merchantName: 'Plaid Sandbox Demo Bank',
      name: 'Credit card payment',
      manualCategory: 'Transfers',
    });
  }
};

const seedBudgetTargets = async (userId) => {
  for (const [category, targetPercent, netTargetPercent, grossTargetPercent] of budgetTargets) {
    await db.query(
      `
        INSERT INTO budget_targets (
          user_id,
          category,
          category_key,
          target_percent,
          net_target_percent,
          gross_target_percent
        )
        VALUES ($1, $2, LOWER($2), $3, $4, $5)
        ON CONFLICT (user_id, category_key) DO UPDATE
        SET
          category = EXCLUDED.category,
          target_percent = EXCLUDED.target_percent,
          net_target_percent = EXCLUDED.net_target_percent,
          gross_target_percent = EXCLUDED.gross_target_percent,
          updated_at = NOW()
      `,
      [userId, category, targetPercent, netTargetPercent, grossTargetPercent],
    );
  }
};

const seedProperty = async (userId) => {
  const { rows } = await db.query(
    `
      INSERT INTO properties (
        user_id,
        address,
        loan_original_amount,
        loan_annual_interest_rate,
        loan_monthly_payment,
        loan_balance_start_month
      )
      VALUES ($1, '123 Demo Street, Oakland, CA', 420000, 4.125, 2140, '2025-01-01')
      ON CONFLICT (user_id, address) DO UPDATE
      SET
        loan_original_amount = EXCLUDED.loan_original_amount,
        loan_annual_interest_rate = EXCLUDED.loan_annual_interest_rate,
        loan_monthly_payment = EXCLUDED.loan_monthly_payment,
        loan_balance_start_month = EXCLUDED.loan_balance_start_month,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `,
    [userId],
  );
  const property = rows[0];

  for (let index = 0; index < 24; index += 1) {
    const valuationMonth = formatDate(addMonths(monthStart(2025, 0), index));
    await db.query(
      `
        INSERT INTO property_value_history (
          property_id,
          valuation_month,
          estimated_value,
          loan_balance,
          price_range_low,
          price_range_high,
          raw_response
        )
        VALUES ($1, $2, $3, $4, $5, $6, '{"source":"demo"}'::jsonb)
        ON CONFLICT (property_id, valuation_month) DO UPDATE
        SET
          estimated_value = EXCLUDED.estimated_value,
          loan_balance = EXCLUDED.loan_balance,
          price_range_low = EXCLUDED.price_range_low,
          price_range_high = EXCLUDED.price_range_high,
          raw_response = EXCLUDED.raw_response
      `,
      [
        property.id,
        valuationMonth,
        635000 + index * 1850,
        410000 - index * 720,
        612000 + index * 1700,
        658000 + index * 1980,
      ],
    );
  }
};

const seedDemoData = async ({ reset = false, email = demoEmail } = {}) => {
  const user = await upsertUser({
    email,
    expiresAt: getDemoExpirationDate(),
  });
  const seedIds = createDemoSeedIds(user.id);

  if (reset) {
    await clearDemoUserData(user.id);
  }

  await saveDemoPlaidItem({
    userId: user.id,
    plaidItemId: seedIds.plaidItemId,
  });
  const accounts = {
    checking: await saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.checking,
      name: 'Demo Checking',
      mask: '0001',
      subtype: 'checking',
      type: 'depository',
      balanceCurrent: 13955,
    }),
    credit: await saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.credit,
      name: 'Demo Rewards Card',
      mask: '4102',
      subtype: 'credit card',
      type: 'credit',
      balanceCurrent: 1985,
      balanceLimit: 18000,
    }),
    brokerage: await saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.brokerage,
      name: 'Demo Brokerage',
      mask: '8055',
      subtype: 'brokerage',
      type: 'investment',
      balanceCurrent: 56420,
    }),
    retirement: await saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.retirement,
      name: 'Demo 401k',
      mask: '7331',
      subtype: '401k',
      type: 'investment',
      balanceCurrent: 127950,
    }),
  };

  await seedBalances(accounts);
  await seedTransactions(accounts, user.id, seedIds);
  await seedBudgetTargets(user.id);
  await seedProperty(user.id);

  return user;
};

const resetDemoData = () => seedDemoData({ reset: true });

const createDemoSessionData = () =>
  seedDemoData({
    reset: true,
    email: createDemoEmail(),
  });

module.exports = {
  seedDemoData,
  resetDemoData,
  createDemoSessionData,
};
