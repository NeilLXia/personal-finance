'use strict';

require('dotenv').config({ quiet: true });

const fs = require('fs');
const db = require('../src/db/connection');

const csvPath = process.argv[2];
const userId = Number(process.argv[3] || 1);

const accountByHeader = {
  'Fidelity brokerage **3959': { institution: 'Fidelity', mask: '3959' },
  'Charles Schwab checking **5998': { institution: 'Charles Schwab', mask: '5998' },
  'Fidelity 401k **7566': { institution: 'Fidelity', mask: '7566' },
  'Fidelity 401k **8360': { institution: 'Fidelity', mask: '8360' },
  'Fidelity 401k **1162': { institution: 'Fidelity', mask: '1162' },
  'Fidelity roth **3570': { institution: 'Fidelity', mask: '3570' },
  'Fidelity ira **1884': { institution: 'Fidelity', mask: '1884' },
  'Fidelity hsa **1608': { institution: 'Fidelity', mask: '1608' },
};

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

const parseDate = (value) => {
  const [month, day, year] = value.split('/').map(Number);

  if (!month || !day || year === undefined) {
    throw new Error(`Invalid date: ${value}`);
  }

  const fullYear = year < 100 ? 2000 + year : year;
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseAmount = (value) => Number(value.replace(/,/g, '').trim());

const main = async () => {
  if (!csvPath) {
    throw new Error(
      'Usage: node scripts/importAccountBalanceHistory.js /path/to/file.csv [user_id]',
    );
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`Invalid user_id: ${process.argv[3]}`);
  }

  const { rows: accounts } = await db.query(
    `
      SELECT
        accounts.id,
        accounts.mask,
        accounts.name,
        accounts.subtype,
        accounts.type,
        plaid_items.institution_name
      FROM accounts
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        accounts.user_id = $1
        AND
        plaid_items.is_active = TRUE
        AND plaid_items.plaid_environment = 'production'
    `,
    [userId],
  );

  const idByHeader = {};
  const uncertain = [];

  Object.entries(accountByHeader).forEach(([header, expected]) => {
    const matches = accounts.filter(
      (account) =>
        account.mask === expected.mask &&
        account.institution_name === expected.institution,
    );

    if (matches.length === 1) {
      idByHeader[header] = matches[0].id;
      return;
    }

    uncertain.push({ header, expected, matches });
  });

  if (uncertain.length > 0) {
    return {
      status: 'not_inserted_uncertain_matches',
      uncertain,
    };
  }

  const text = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]);
  const unknownHeaders = headers
    .slice(1)
    .filter((header) => !Object.prototype.hasOwnProperty.call(idByHeader, header));

  if (unknownHeaders.length > 0) {
    return {
      status: 'not_inserted_unknown_headers',
      unknownHeaders,
    };
  }

  const client = await db.getClient();
  let attempted = 0;
  let inserted = 0;
  let skippedExisting = 0;
  const byAccount = {};

  try {
    await client.query('BEGIN');

    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line);
      const balanceDate = parseDate(cells[0]);

      for (let columnIndex = 1; columnIndex < headers.length; columnIndex += 1) {
        const rawAmount = (cells[columnIndex] || '').trim();

        if (!rawAmount) {
          continue;
        }

        const accountId = idByHeader[headers[columnIndex]];
        const amount = parseAmount(rawAmount);

        if (!Number.isFinite(amount)) {
          throw new Error(`Invalid amount: ${rawAmount} for ${headers[columnIndex]}`);
        }

        attempted += 1;
        byAccount[headers[columnIndex]] =
          (byAccount[headers[columnIndex]] || 0) + 1;

        const result = await client.query(
          `
            INSERT INTO account_balance_history (
              account_id,
              balance_date,
              balance_available,
              balance_current,
              balance_limit,
              iso_currency_code,
              unofficial_currency_code
            )
            VALUES ($1, $2, NULL, $3, NULL, 'USD', NULL)
            ON CONFLICT (account_id, balance_date) DO NOTHING
            RETURNING id
          `,
          [accountId, balanceDate, amount],
        );

        if (result.rowCount === 1) {
          inserted += 1;
        } else {
          skippedExisting += 1;
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
    status: 'inserted',
    user_id: userId,
    attempted,
    inserted,
    skipped_existing: skippedExisting,
    byAccount,
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
