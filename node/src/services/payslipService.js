'use strict';

const { PDFParse } = require('pdf-parse');
const models = require('../models');
const { getCurrentUser } = require('./authService');
const { plaidEnv } = require('./plaid/client');

const pageSeparatorPattern = /\n--- PAGE \d+ OF \d+ ---\n/g;

const parseMoney = (value) => {
  if (!value) {
    return null;
  }

  const parsedValue = Number(String(value).replace(/[$,]/g, ''));
  return Number.isNaN(parsedValue) ? null : parsedValue;
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const [month, day, year] = value.split('/').map(Number);

  if (!month || !day || !year) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const extractEmployeeName = (pageText) => {
  const addressLineMatch = pageText.match(/\n([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})\s+\d+\s+[A-Za-z]/);
  return addressLineMatch?.[1] || null;
};

const extractEmployerName = (pageText) => {
  const firstLine = pageText.trim().split('\n')[0] || '';
  const affiliateMatch = firstLine.match(/^(.*?)\s+An Affiliate\b/);

  if (affiliateMatch) {
    return affiliateMatch[1].trim();
  }

  const addressMatch = firstLine.match(/^(.*?)\s+\d+\s+[A-Za-z]/);
  return addressMatch?.[1]?.trim() || null;
};

const extractTaxAmount = (pageText, labelPattern) => {
  const match = pageText.match(
    new RegExp(`^${labelPattern}\\s+([\\d,.]+)\\s+[\\d,.]+$`, 'im'),
  );

  return parseMoney(match?.[1]);
};

const extractPayrollSection = (pageText, sectionTitle) => {
  const sectionPattern = new RegExp(
    `${sectionTitle}\\s*\\nDescription Amount YTD\\s*\\n([\\s\\S]*?)(?=\\n(?:Associate Taxes|Pre Tax Deductions|Post Tax Deductions|Employer Paid Benefits|Taxable Wages|Earnings \\d|Federal State Absence Plans|Payment Information)\\b)`,
    'i',
  );
  const match = pageText.match(sectionPattern);

  return match?.[1] || '';
};

const extractSectionCurrentAmount = (sectionText, labelPattern) => {
  const match = sectionText.match(
    new RegExp(`^${labelPattern}\\s+([\\d,.]+)\\s+[\\d,.]+$`, 'im'),
  );

  return parseMoney(match?.[1]);
};

const buildPayslipIdentifier = ({
  employeeId,
  payPeriodBegin,
  payPeriodEnd,
  checkDate,
  checkNumber,
}) =>
  [
    employeeId || '',
    payPeriodBegin || '',
    payPeriodEnd || '',
    checkDate || '',
    checkNumber || '',
  ].join('|');

const parsePayslipPage = ({
  pageText,
}) => {
  const cleanedText = pageText.replace(/\t/g, ' ').replace(/[ ]+/g, ' ').trim();
  const summaryMatch = cleanedText.match(
    /Current\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/,
  );
  const payPeriodMatch = cleanedText.match(
    /(\d{4,})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+([A-Za-z0-9-]+))?\s+Hours Worked/,
  );

  if (!summaryMatch || !payPeriodMatch) {
    return null;
  }

  const preTaxSection = extractPayrollSection(pageText, 'Pre Tax Deductions');
  const postTaxSection = extractPayrollSection(pageText, 'Post Tax Deductions');
  const payslipFields = {
    employeeName: extractEmployeeName(pageText),
    employerName: extractEmployerName(pageText),
    employeeId: payPeriodMatch[1],
    payPeriodBegin: parseDate(payPeriodMatch[2]),
    payPeriodEnd: parseDate(payPeriodMatch[3]),
    checkDate: parseDate(payPeriodMatch[4]),
    checkNumber: payPeriodMatch[5] || null,
    hoursWorked: parseMoney(summaryMatch[1]),
    grossPay: parseMoney(summaryMatch[2]),
    preTaxDeductions: parseMoney(summaryMatch[3]),
    pretax401k: extractSectionCurrentAmount(preTaxSection, '401K'),
    pretax401kBonusDeferral: extractSectionCurrentAmount(
      preTaxSection,
      '401K Bonus Deferral',
    ),
    pretaxDental: extractSectionCurrentAmount(preTaxSection, 'Dental'),
    pretaxFsaHealthcare: extractSectionCurrentAmount(preTaxSection, 'FSA Healthcare'),
    pretaxHsa: extractSectionCurrentAmount(
      preTaxSection,
      'Health Savings Account Fidelity - EE',
    ),
    pretaxMedical: extractSectionCurrentAmount(preTaxSection, 'Medical'),
    associateTaxes: parseMoney(summaryMatch[4]),
    socialSecurityTax: extractTaxAmount(pageText, 'Social Security'),
    medicareTax: extractTaxAmount(pageText, 'Medicare'),
    federalWithholdingTax: extractTaxAmount(pageText, 'Federal Withholding'),
    stateTax: extractTaxAmount(pageText, 'State Tax(?:\\s+-\\s+[A-Z]{2})?'),
    caDisabilityInsuranceTax: extractTaxAmount(
      pageText,
      'CA State Disability Insurance(?:\\s+-\\s+CASDI)?',
    ),
    postTaxDeductions: parseMoney(summaryMatch[5]),
    posttax401kRoth: extractSectionCurrentAmount(postTaxSection, '401K Roth'),
    posttax401kBonusDeferralRoth: extractSectionCurrentAmount(
      postTaxSection,
      '401K Bonus Deferral Roth',
    ),
    netPay: parseMoney(summaryMatch[6]),
  };

  return {
    ...payslipFields,
    payslipIdentifier: buildPayslipIdentifier(payslipFields),
  };
};

const extractPayslipsFromPdf = async (buffer) => {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText({
      pageJoiner: '\n--- PAGE page_number OF total_number ---\n',
    });
    const pages = result.text
      .split(pageSeparatorPattern)
      .map((pageText) => pageText.trim())
      .filter(Boolean);

    return {
      pageCount: result.total,
      payslips: pages
        .map((pageText) =>
          parsePayslipPage({
            pageText,
          }),
        )
        .filter(Boolean),
    };
  } finally {
    await parser.destroy();
  }
};

const listPayslips = async () => {
  const user = await getCurrentUser();

  return {
    payslips: await models.payslips.findByUserId(user.id),
  };
};

const uploadPayslipPdf = async ({
  originalFilename,
  buffer,
}) => {
  if (!buffer) {
    const error = new Error('A payslip PDF is required');
    error.status = 400;
    throw error;
  }

  const user = await getCurrentUser();
  const parsedPdf = await extractPayslipsFromPdf(buffer);
  const upload = await models.payslips.createUpload({
    userId: user.id,
    originalFilename,
    pageCount: parsedPdf.pageCount,
  });
  const savedPayslips = await Promise.all(
    parsedPdf.payslips.map(async (payslip) => {
      const matchingIncomeTransaction =
        payslip.checkDate && payslip.netPay
          ? await models.transactions.findIncomeMatchForPayslip({
              userId: user.id,
              plaidEnvironment: plaidEnv,
              checkDate: payslip.checkDate,
              netPay: payslip.netPay,
            })
          : null;

      return models.payslips.upsert({
        ...payslip,
        incomeTransactionId: matchingIncomeTransaction?.id || null,
        userId: user.id,
        uploadId: upload.id,
      });
    }),
  );
  const updatedUpload = await models.payslips.updateUploadCounts({
    id: upload.id,
    userId: user.id,
    importedCount: savedPayslips.length,
    skippedCount: Math.max(parsedPdf.pageCount - savedPayslips.length, 0),
  });

  return {
    upload: updatedUpload,
    payslips: savedPayslips,
  };
};

module.exports = {
  extractPayslipsFromPdf,
  listPayslips,
  uploadPayslipPdf,
};
