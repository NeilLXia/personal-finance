'use strict';

const db = require('../db/connection');

const createUpload = async ({ userId, originalFilename, pageCount }) => {
  const { rows } = await db.query(
    `
      INSERT INTO payslip_uploads (
        user_id,
        original_filename,
        page_count
      )
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [userId, originalFilename, pageCount],
  );

  return rows[0];
};

const updateUploadCounts = async ({
  id,
  userId,
  importedCount,
  skippedCount,
}) => {
  const { rows } = await db.query(
    `
      UPDATE payslip_uploads
      SET
        imported_count = $2,
        skipped_count = $3
      WHERE id = $1 AND user_id = $4
      RETURNING *
    `,
    [id, importedCount, skippedCount, userId],
  );

  return rows[0];
};

const upsert = async ({
  userId,
  uploadId,
  payslipIdentifier,
  employeeName,
  employerName,
  employeeId,
  payPeriodBegin,
  payPeriodEnd,
  checkDate,
  checkNumber,
  hoursWorked,
  grossPay,
  preTaxDeductions,
  pretax401k,
  pretax401kBonusDeferral,
  pretaxDental,
  pretaxFsaHealthcare,
  pretaxHsa,
  pretaxMedical,
  associateTaxes,
  socialSecurityTax,
  medicareTax,
  federalWithholdingTax,
  stateTax,
  caDisabilityInsuranceTax,
  postTaxDeductions,
  posttax401kRoth,
  posttax401kBonusDeferralRoth,
  netPay,
  incomeTransactionId,
}) => {
  const { rows } = await db.query(
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
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30
      )
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
      RETURNING *
    `,
    [
      userId,
      uploadId,
      payslipIdentifier,
      employeeName,
      employerName,
      employeeId,
      payPeriodBegin,
      payPeriodEnd,
      checkDate,
      checkNumber,
      hoursWorked,
      grossPay,
      preTaxDeductions,
      pretax401k,
      pretax401kBonusDeferral,
      pretaxDental,
      pretaxFsaHealthcare,
      pretaxHsa,
      pretaxMedical,
      associateTaxes,
      socialSecurityTax,
      medicareTax,
      federalWithholdingTax,
      stateTax,
      caDisabilityInsuranceTax,
      postTaxDeductions,
      posttax401kRoth,
      posttax401kBonusDeferralRoth,
      netPay,
      incomeTransactionId,
    ],
  );

  return rows[0];
};

const findByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM payslips
      WHERE user_id = $1
      ORDER BY check_date DESC, pay_period_end DESC
    `,
    [userId],
  );

  return rows;
};

const findByUserIdAndDateRange = async ({ userId, startDate, endDate }) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM payslips
      WHERE user_id = $1
        AND check_date >= $2
        AND check_date <= $3
      ORDER BY check_date DESC, pay_period_end DESC
    `,
    [userId, startDate, endDate],
  );

  return rows;
};

module.exports = {
  createUpload,
  updateUploadCounts,
  upsert,
  findByUserId,
  findByUserIdAndDateRange,
};
