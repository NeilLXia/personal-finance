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
  getDemoExpirationDate,
  createDemoEmail,
  createDemoSeedIds,
  monthlyExpenses,
  budgetTargets,
} = require('./fixtures');

const upsertUser = async ({ email = demoEmail, expiresAt = null } = {}) => {
  const { rows } = await db.query(
    `
      INSERT INTO users (email, name, is_demo, account_type, demo_expires_at)
      VALUES ($1, 'Demo User', TRUE, 'user', $2)
      ON CONFLICT (email) DO UPDATE
      SET
        name = EXCLUDED.name,
        is_demo = TRUE,
        account_type = 'user',
        demo_expires_at = EXCLUDED.demo_expires_at,
        updated_at = NOW()
      RETURNING *
    `,
    [email, expiresAt],
  );

  return rows[0];
};

const buildValuesClause = ({ rows, columns, startIndex = 1 }) => {
  const values = [];
  const placeholders = rows
    .map((row, rowIndex) => {
      const rowPlaceholders = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${startIndex + rowIndex * columns.length + columnIndex}`;
      });

      return `(${rowPlaceholders.join(', ')})`;
    })
    .join(', ');

  return { values, placeholders };
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

const insertBalanceSnapshots = async (snapshots) => {
  if (snapshots.length === 0) {
    return;
  }

  const values = [];
  const placeholders = snapshots
    .map((snapshot, index) => {
      const offset = index * 4;
      values.push(
        snapshot.accountId,
        snapshot.balanceDate,
        snapshot.balanceCurrent,
        snapshot.balanceLimit,
      );

      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 3}, $${offset + 4}, 'USD')`;
    })
    .join(', ');

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
      VALUES ${placeholders}
      ON CONFLICT (account_id, balance_date) DO UPDATE
      SET
        balance_current = EXCLUDED.balance_current,
        balance_available = EXCLUDED.balance_available,
        balance_limit = EXCLUDED.balance_limit,
        iso_currency_code = EXCLUDED.iso_currency_code
    `,
    values,
  );
};

// Raw because demo transactions carry a seeded manual_category, which the normal
// transactions model does not accept on write.
const insertTransactions = async (transactions) => {
  if (transactions.length === 0) {
    return new Map();
  }

  const columns = [
    'accountId',
    'plaidTransactionId',
    'amount',
    'category',
    'date',
    'merchantName',
    'name',
    'manualCategory',
    'pending',
  ];
  const { placeholders, values } = buildValuesClause({
    rows: transactions,
    columns,
  });
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
      VALUES ${placeholders}
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
      RETURNING id, plaid_transaction_id
    `,
    values,
  );

  return new Map(
    rows.map((transaction) => [transaction.plaid_transaction_id, transaction.id]),
  );
};

const buildPayslipRow = ({
  userId,
  incomeTransactionId,
  payPeriodBegin,
  payPeriodEnd,
  checkDate,
  checkNumber,
}) => ({
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

const insertPayslips = async (payslips) => {
  if (payslips.length === 0) {
    return;
  }

  const columns = [
    'userId',
    'uploadId',
    'payslipIdentifier',
    'employeeName',
    'employerName',
    'employeeId',
    'payPeriodBegin',
    'payPeriodEnd',
    'checkDate',
    'checkNumber',
    'hoursWorked',
    'grossPay',
    'preTaxDeductions',
    'pretax401k',
    'pretax401kBonusDeferral',
    'pretaxDental',
    'pretaxFsaHealthcare',
    'pretaxHsa',
    'pretaxMedical',
    'associateTaxes',
    'socialSecurityTax',
    'medicareTax',
    'federalWithholdingTax',
    'stateTax',
    'caDisabilityInsuranceTax',
    'postTaxDeductions',
    'posttax401kRoth',
    'posttax401kBonusDeferralRoth',
    'netPay',
    'incomeTransactionId',
  ];
  const { placeholders, values } = buildValuesClause({ rows: payslips, columns });

  await db.query(
    `
      INSERT INTO payslips (
        user_id,
        upload_id,
        payslip_identifier,
        employee_name,
        employer_name,
        employee_id,
        pay_period_begin,
        pay_period_end,
        check_date,
        check_number,
        hours_worked,
        gross_pay,
        pre_tax_deductions,
        pretax_401k,
        pretax_401k_bonus_deferral,
        pretax_dental,
        pretax_fsa_healthcare,
        pretax_hsa,
        pretax_medical,
        associate_taxes,
        social_security_tax,
        medicare_tax,
        federal_withholding_tax,
        state_tax,
        ca_disability_insurance_tax,
        post_tax_deductions,
        posttax_401k_roth,
        posttax_401k_bonus_deferral_roth,
        net_pay,
        income_transaction_id
      )
      VALUES ${placeholders}
      ON CONFLICT (user_id, payslip_identifier)
      DO UPDATE
      SET
        upload_id = EXCLUDED.upload_id,
        employee_name = EXCLUDED.employee_name,
        employer_name = EXCLUDED.employer_name,
        check_number = EXCLUDED.check_number,
        hours_worked = EXCLUDED.hours_worked,
        gross_pay = EXCLUDED.gross_pay,
        pre_tax_deductions = EXCLUDED.pre_tax_deductions,
        pretax_401k = EXCLUDED.pretax_401k,
        pretax_401k_bonus_deferral = EXCLUDED.pretax_401k_bonus_deferral,
        pretax_dental = EXCLUDED.pretax_dental,
        pretax_fsa_healthcare = EXCLUDED.pretax_fsa_healthcare,
        pretax_hsa = EXCLUDED.pretax_hsa,
        pretax_medical = EXCLUDED.pretax_medical,
        associate_taxes = EXCLUDED.associate_taxes,
        social_security_tax = EXCLUDED.social_security_tax,
        medicare_tax = EXCLUDED.medicare_tax,
        federal_withholding_tax = EXCLUDED.federal_withholding_tax,
        state_tax = EXCLUDED.state_tax,
        ca_disability_insurance_tax = EXCLUDED.ca_disability_insurance_tax,
        post_tax_deductions = EXCLUDED.post_tax_deductions,
        posttax_401k_roth = EXCLUDED.posttax_401k_roth,
        posttax_401k_bonus_deferral_roth = EXCLUDED.posttax_401k_bonus_deferral_roth,
        net_pay = EXCLUDED.net_pay,
        income_transaction_id = EXCLUDED.income_transaction_id,
        updated_at = NOW()
    `,
    values,
  );
};

const seedBalances = async (accounts) => {
  const snapshots = [];

  for (let index = 0; index < 24; index += 1) {
    const date = formatDate(addMonths(monthStart(2025, 0), index));
    snapshots.push({
      accountId: accounts.checking.id,
      balanceDate: date,
      balanceCurrent: 8200 + index * 235 + (index % 3) * 120,
    });
    snapshots.push({
      accountId: accounts.credit.id,
      balanceDate: date,
      balanceCurrent: 1450 + (index % 6) * 210,
      balanceLimit: 18000,
    });
    snapshots.push({
      accountId: accounts.brokerage.id,
      balanceDate: date,
      balanceCurrent: 38250 + index * 740 + (index % 4) * 430,
    });
    snapshots.push({
      accountId: accounts.retirement.id,
      balanceDate: date,
      balanceCurrent: 96500 + index * 1225 + (index % 5) * 560,
    });
  }

  await insertBalanceSnapshots(snapshots);
};

const seedTransactions = async (accounts, userId, seedIds) => {
  const transactions = [];
  const payslipSpecs = [];

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
    const firstIncomeTransactionId = `${seedIds.transactions.prefix}-${monthKey}-pay-1`;
    const secondIncomeTransactionId = `${seedIds.transactions.prefix}-${monthKey}-pay-2`;

    transactions.push({
      accountId: accounts.checking.id,
      plaidTransactionId: firstIncomeTransactionId,
      amount: -3500,
      category: 'Payroll',
      date: firstPayday,
      merchantName: 'Acme Analytics',
      name: 'Payroll deposit',
      manualCategory: 'Income',
      pending: false,
    });
    transactions.push({
      accountId: accounts.checking.id,
      plaidTransactionId: secondIncomeTransactionId,
      amount: -3500,
      category: 'Payroll',
      date: secondPayday,
      merchantName: 'Acme Analytics',
      name: 'Payroll deposit',
      manualCategory: 'Income',
      pending: false,
    });
    payslipSpecs.push({
      plaidTransactionId: firstIncomeTransactionId,
      payPeriodBegin: firstPeriodBegin,
      payPeriodEnd: firstPeriodEnd,
      checkDate: firstPayday,
      checkNumber: `${seedIds.transactions.prefix}-${monthKey}-1`,
    });
    payslipSpecs.push({
      plaidTransactionId: secondIncomeTransactionId,
      payPeriodBegin: secondPeriodBegin,
      payPeriodEnd: secondPeriodEnd,
      checkDate: secondPayday,
      checkNumber: `${seedIds.transactions.prefix}-${monthKey}-2`,
    });
    transactions.push({
      accountId: accounts.brokerage.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-brokerage-contribution`,
      amount: -1430,
      category: 'Financial Planning and Investments',
      date: formatDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 9))),
      merchantName: 'Fidelity',
      name: 'Brokerage contribution',
      manualCategory: 'Savings',
      pending: false,
    });
    transactions.push({
      accountId: accounts.retirement.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-401k-contribution`,
      amount: -1000,
      category: 'Financial Planning and Investments',
      date: firstPayday,
      merchantName: 'Acme 401k Plan',
      name: '401k contribution',
      manualCategory: 'Savings',
      pending: false,
    });

    for (const [key, amount, category, merchantName, name, manualCategory] of monthlyExpenses) {
      transactions.push({
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
        pending: false,
      });
    }

    transactions.push({
      accountId: accounts.credit.id,
      plaidTransactionId: `${seedIds.transactions.prefix}-${monthKey}-credit-payment`,
      amount: -1125,
      category: 'Credit Card',
      date: formatDate(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 18))),
      merchantName: 'Plaid Sandbox Demo Bank',
      name: 'Credit card payment',
      manualCategory: 'Transfers',
      pending: false,
    });
  }

  const transactionIdByPlaidId = await insertTransactions(transactions);
  const payslips = payslipSpecs.map((payslip) =>
    buildPayslipRow({
      userId,
      incomeTransactionId: transactionIdByPlaidId.get(payslip.plaidTransactionId),
      payPeriodBegin: payslip.payPeriodBegin,
      payPeriodEnd: payslip.payPeriodEnd,
      checkDate: payslip.checkDate,
      checkNumber: payslip.checkNumber,
    }),
  );

  await insertPayslips(payslips);
};

const seedBudgetTargets = async (userId) => {
  const rows = budgetTargets.map(
    ([category, targetPercent, netTargetPercent, grossTargetPercent]) => ({
      userId,
      category,
      categoryKey: category.toLowerCase(),
      targetPercent,
      netTargetPercent,
      grossTargetPercent,
    }),
  );

  if (rows.length === 0) {
    return;
  }

  const columns = [
    'userId',
    'category',
    'categoryKey',
    'targetPercent',
    'netTargetPercent',
    'grossTargetPercent',
  ];
  const { placeholders, values } = buildValuesClause({ rows, columns });

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
      VALUES ${placeholders}
      ON CONFLICT (user_id, category_key) DO UPDATE
      SET
        category = EXCLUDED.category,
        target_percent = EXCLUDED.target_percent,
        net_target_percent = EXCLUDED.net_target_percent,
        gross_target_percent = EXCLUDED.gross_target_percent,
        updated_at = NOW()
    `,
    values,
  );
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
  const historyRows = [];

  for (let index = 0; index < 24; index += 1) {
    const valuationMonth = formatDate(addMonths(monthStart(2025, 0), index));
    historyRows.push({
      propertyId: property.id,
      valuationMonth,
      estimatedValue: 635000 + index * 1850,
      loanBalance: 410000 - index * 720,
      priceRangeLow: 612000 + index * 1700,
      priceRangeHigh: 658000 + index * 1980,
      rawResponse: JSON.stringify({ source: 'demo' }),
    });
  }

  if (historyRows.length > 0) {
    const columns = [
      'propertyId',
      'valuationMonth',
      'estimatedValue',
      'loanBalance',
      'priceRangeLow',
      'priceRangeHigh',
      'rawResponse',
    ];
    const { placeholders, values } = buildValuesClause({
      rows: historyRows,
      columns,
    });

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
        VALUES ${placeholders}
        ON CONFLICT (property_id, valuation_month) DO UPDATE
        SET
          estimated_value = EXCLUDED.estimated_value,
          loan_balance = EXCLUDED.loan_balance,
          price_range_low = EXCLUDED.price_range_low,
          price_range_high = EXCLUDED.price_range_high,
          raw_response = EXCLUDED.raw_response
      `,
      values,
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
  const [checking, credit, brokerage, retirement] = await Promise.all([
    saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.checking,
      name: 'Demo Checking',
      mask: '0001',
      subtype: 'checking',
      type: 'depository',
      balanceCurrent: 13955,
    }),
    saveDemoAccount({
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
    saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.brokerage,
      name: 'Demo Brokerage',
      mask: '8055',
      subtype: 'brokerage',
      type: 'investment',
      balanceCurrent: 56420,
    }),
    saveDemoAccount({
      userId: user.id,
      plaidItemId: seedIds.plaidItemId,
      plaidAccountId: seedIds.accounts.retirement,
      name: 'Demo 401k',
      mask: '7331',
      subtype: '401k',
      type: 'investment',
      balanceCurrent: 127950,
    }),
  ]);
  const accounts = {
    checking,
    credit,
    brokerage,
    retirement,
  };

  await Promise.all([
    seedBalances(accounts),
    seedTransactions(accounts, user.id, seedIds),
    seedBudgetTargets(user.id),
    seedProperty(user.id),
  ]);

  return user;
};

const resetDemoData = () => seedDemoData({ reset: true });

const createDemoSessionData = () =>
  seedDemoData({
    email: createDemoEmail(),
  });

module.exports = {
  seedDemoData,
  resetDemoData,
  createDemoSessionData,
};
