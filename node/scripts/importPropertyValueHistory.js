'use strict';

require('dotenv').config({ quiet: true });

const fs = require('fs');
const moment = require('moment');
const db = require('../src/db/connection');
const { calculateLoanBalance } = require('../src/lib/loanBalance');

const csvPath = process.argv[2];

const parseCsvLine = (line) => {
  const cells = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  cells.push(value);
  return cells;
};

const normalizeText = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const parseMonth = (value) => {
  const parsed = moment(value, ['M/D/YYYY', 'MM/DD/YYYY'], true);

  if (!parsed.isValid()) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed.startOf('month').format('YYYY-MM-DD');
};

const parseAmount = (value) => Number(value.replace(/,/g, '').trim());

const findMatchingProperty = (properties, label) => {
  const normalizedLabel = normalizeText(label);
  const matches = properties.filter((property) =>
    normalizeText(property.address).includes(normalizedLabel),
  );

  return matches.length === 1 ? matches[0] : null;
};

const main = async () => {
  if (!csvPath) {
    throw new Error('Usage: node scripts/importPropertyValueHistory.js /path/to/file.csv');
  }

  const text = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]);
  const propertyLabels = headers.slice(1);

  const { rows: properties } = await db.query(
    `
      SELECT *
      FROM properties
      WHERE is_active = TRUE
      ORDER BY address ASC
    `,
  );

  const propertiesByLabel = {};
  const uncertain = [];

  propertyLabels.forEach((label) => {
    const property = findMatchingProperty(properties, label);

    if (property) {
      propertiesByLabel[label] = property;
      return;
    }

    uncertain.push({
      label,
      active_properties: properties.map((currentProperty) => ({
        id: currentProperty.id,
        address: currentProperty.address,
      })),
    });
  });

  if (uncertain.length > 0) {
    return {
      status: 'not_inserted_uncertain_matches',
      uncertain,
    };
  }

  const client = await db.getClient();
  let attempted = 0;
  let inserted = 0;
  let updated = 0;
  const byProperty = {};

  try {
    await client.query('BEGIN');

    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line);
      const valuationMonth = parseMonth(cells[0]);

      for (let columnIndex = 1; columnIndex < headers.length; columnIndex += 1) {
        const rawValue = (cells[columnIndex] || '').trim();

        if (!rawValue) {
          continue;
        }

        const label = headers[columnIndex];
        const property = propertiesByLabel[label];
        const estimatedValue = parseAmount(rawValue);

        if (!Number.isFinite(estimatedValue)) {
          throw new Error(`Invalid value: ${rawValue} for ${label}`);
        }

        attempted += 1;
        byProperty[label] = (byProperty[label] || 0) + 1;

        const loanBalance = calculateLoanBalance(property, valuationMonth);
        const result = await client.query(
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
            VALUES ($1, $2, $3, $4, NULL, NULL, $5)
            ON CONFLICT (property_id, valuation_month) DO UPDATE
            SET
              estimated_value = EXCLUDED.estimated_value,
              loan_balance = EXCLUDED.loan_balance,
              raw_response = EXCLUDED.raw_response
            RETURNING (xmax = 0) AS inserted
          `,
          [
            property.id,
            valuationMonth,
            estimatedValue,
            loanBalance,
            JSON.stringify({
              source: 'Budgeting Tracker CSV import',
              label,
              original_date: cells[0],
              estimated_value: estimatedValue,
            }),
          ],
        );

        if (result.rows[0].inserted) {
          inserted += 1;
        } else {
          updated += 1;
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    status: 'complete',
    attempted,
    inserted,
    updated,
    byProperty,
  };
};

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
