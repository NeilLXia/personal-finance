'use strict';

const db = require('../db/connection');

const createStaleCardTypeChildError = (childType) => {
  const error = new Error(
    `Credit card ${childType} was not found for this card type.`,
  );
  error.code = 'STALE_CREDIT_CARD_TYPE_CHILD';
  error.status = 409;
  return error;
};

const findRewardCatalog = async () => {
  const [cardTypes, earningRewards, perkAwards] = await Promise.all([
    db.query(
      `
        SELECT *
        FROM credit_card_types
        ORDER BY name ASC
      `,
    ),
    db.query(
      `
        SELECT *
        FROM credit_card_earning_rewards
        ORDER BY category ASC, id ASC
      `,
    ),
    db.query(
      `
        SELECT *
        FROM credit_card_perk_awards
        ORDER BY name ASC, id ASC
      `,
    ),
  ]);

  return {
    cardTypes: cardTypes.rows,
    earningRewards: earningRewards.rows,
    perkAwards: perkAwards.rows,
  };
};

const findCreditAccountsByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT
        accounts.id,
        accounts.name,
        accounts.mask,
        accounts.official_name,
        accounts.subtype,
        accounts.type,
        plaid_items.institution_name,
        credit_card_account_types.credit_card_type_id,
        credit_card_account_types.effective_month
      FROM accounts
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      LEFT JOIN credit_card_account_types
        ON credit_card_account_types.account_id = accounts.id
      WHERE
        accounts.user_id = $1
        AND accounts.type = 'credit'
        AND plaid_items.is_active = TRUE
      ORDER BY plaid_items.institution_name ASC, accounts.name ASC
    `,
    [userId],
  );

  return rows;
};

const findCreditAccountByIdForUser = async ({ accountId, userId }) => {
  const { rows } = await db.query(
    `
      SELECT accounts.*
      FROM accounts
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        accounts.id = $1
        AND accounts.user_id = $2
        AND accounts.type = 'credit'
        AND plaid_items.is_active = TRUE
    `,
    [accountId, userId],
  );

  return rows[0] || null;
};

const findCreditAccountWithTypeByIdForUser = async ({ accountId, userId }) => {
  const { rows } = await db.query(
    `
      SELECT
        accounts.id,
        credit_card_account_types.credit_card_type_id,
        credit_card_account_types.effective_month
      FROM accounts
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      LEFT JOIN credit_card_account_types
        ON credit_card_account_types.account_id = accounts.id
      WHERE
        accounts.id = $1
        AND accounts.user_id = $2
        AND accounts.type = 'credit'
        AND plaid_items.is_active = TRUE
    `,
    [accountId, userId],
  );

  return rows[0] || null;
};

const findPerkAwardById = async (perkAwardId) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM credit_card_perk_awards
      WHERE id = $1
    `,
    [perkAwardId],
  );

  return rows[0] || null;
};

const findCreditCardTypeById = async (creditCardTypeId) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM credit_card_types
      WHERE id = $1
    `,
    [creditCardTypeId],
  );

  return rows[0] || null;
};

const createCardTypeWithRewards = async ({
  name,
  annualFee,
  earningRewards,
  perkAwards,
}) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
        INSERT INTO credit_card_types (
          name,
          annual_fee
        )
        VALUES ($1, $2)
        RETURNING *
      `,
      [name, annualFee],
    );
    const cardType = rows[0];

    for (const reward of earningRewards) {
      await client.query(
        `
          INSERT INTO credit_card_earning_rewards (
            credit_card_type_id,
            category,
            reward_percent,
            keywords
          )
          VALUES ($1, $2, $3, $4)
        `,
        [cardType.id, reward.category, reward.rewardPercent, reward.keywords],
      );
    }

    for (const award of perkAwards) {
      await client.query(
        `
          INSERT INTO credit_card_perk_awards (
            credit_card_type_id,
            name,
            dollar_value,
            completion_amount,
            frequency_count,
            frequency_period,
            auto_complete
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          cardType.id,
          award.name,
          award.dollarValue,
          award.completionAmount,
          award.frequencyCount,
          award.frequencyPeriod,
          award.autoComplete,
        ],
      );
    }

    await client.query('COMMIT');
    return cardType;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateCardTypeWithRewards = async ({
  cardTypeId,
  name,
  annualFee,
  earningRewards,
  perkAwards,
}) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
        UPDATE credit_card_types
        SET name = $1, annual_fee = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
      [name, annualFee, cardTypeId],
    );
    const cardType = rows[0];

    const keptEarningRewardIds = [];

    for (const reward of earningRewards) {
      if (reward.id) {
        const updated = await client.query(
          `
            UPDATE credit_card_earning_rewards
            SET category = $1, reward_percent = $2, keywords = $3, updated_at = NOW()
            WHERE id = $4 AND credit_card_type_id = $5
          `,
          [
            reward.category,
            reward.rewardPercent,
            reward.keywords,
            reward.id,
            cardTypeId,
          ],
        );
        if (updated.rowCount !== 1) {
          throw createStaleCardTypeChildError('earning reward');
        }
        keptEarningRewardIds.push(reward.id);
      } else {
        const inserted = await client.query(
          `
            INSERT INTO credit_card_earning_rewards (
              credit_card_type_id,
              category,
              reward_percent,
              keywords
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `,
          [cardTypeId, reward.category, reward.rewardPercent, reward.keywords],
        );
        keptEarningRewardIds.push(inserted.rows[0].id);
      }
    }

    await client.query(
      `
        DELETE FROM credit_card_earning_rewards
        WHERE credit_card_type_id = $1 AND id != ALL($2::bigint[])
      `,
      [cardTypeId, keptEarningRewardIds],
    );

    const keptPerkAwardIds = [];

    for (const award of perkAwards) {
      if (award.id) {
        const updated = await client.query(
          `
            UPDATE credit_card_perk_awards
            SET
              name = $1,
              dollar_value = $2,
              frequency_count = $3,
              frequency_period = $4,
              auto_complete = $5,
              updated_at = NOW()
            WHERE id = $6 AND credit_card_type_id = $7
          `,
          [
            award.name,
            award.dollarValue,
            award.frequencyCount,
            award.frequencyPeriod,
            award.autoComplete,
            award.id,
            cardTypeId,
          ],
        );
        if (updated.rowCount !== 1) {
          throw createStaleCardTypeChildError('perk');
        }
        keptPerkAwardIds.push(award.id);
      } else {
        const inserted = await client.query(
          `
            INSERT INTO credit_card_perk_awards (
              credit_card_type_id,
              name,
              dollar_value,
              completion_amount,
              frequency_count,
              frequency_period,
              auto_complete
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `,
          [
            cardTypeId,
            award.name,
            award.dollarValue,
            award.completionAmount,
            award.frequencyCount,
            award.frequencyPeriod,
            award.autoComplete,
          ],
        );
        keptPerkAwardIds.push(inserted.rows[0].id);
      }
    }

    await client.query(
      `
        DELETE FROM credit_card_perk_awards
        WHERE credit_card_type_id = $1 AND id != ALL($2::bigint[])
      `,
      [cardTypeId, keptPerkAwardIds],
    );

    await client.query('COMMIT');
    return cardType;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const deleteCardType = async (cardTypeId) => {
  const { rows } = await db.query(
    `
      DELETE FROM credit_card_types
      WHERE id = $1
      RETURNING *
    `,
    [cardTypeId],
  );

  return rows[0] || null;
};

const upsertAccountType = async ({
  accountId,
  creditCardTypeId,
  effectiveMonth,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO credit_card_account_types (
        account_id,
        credit_card_type_id,
        effective_month
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (account_id) DO UPDATE
      SET
        credit_card_type_id = EXCLUDED.credit_card_type_id,
        effective_month = EXCLUDED.effective_month,
        updated_at = NOW()
      RETURNING *
    `,
    [accountId, creditCardTypeId, effectiveMonth],
  );

  return rows[0];
};

const deleteAccountType = async (accountId) => {
  const { rows } = await db.query(
    `
      DELETE FROM credit_card_account_types
      WHERE account_id = $1
      RETURNING *
    `,
    [accountId],
  );

  return rows[0] || null;
};

const findPerkCompletionsForAccountCycles = async (accountCycles) => {
  if (accountCycles.length === 0) {
    return [];
  }

  const values = accountCycles
    .map((_, index) => `($${index * 2 + 1}::bigint, $${index * 2 + 2}::date)`)
    .join(', ');
  const params = accountCycles.flatMap((entry) => [
    entry.accountId,
    entry.cycleStart,
  ]);

  const { rows } = await db.query(
    `
      SELECT account_id, perk_award_id, occurrence_index
      FROM credit_card_perk_completions
      WHERE (account_id, cycle_start) IN (${values})
    `,
    params,
  );

  return rows;
};

const setPerkCompletion = async ({
  accountId,
  perkAwardId,
  cycleStart,
  occurrenceIndex,
}) => {
  await db.query(
    `
      INSERT INTO credit_card_perk_completions (
        account_id,
        perk_award_id,
        cycle_start,
        occurrence_index
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (account_id, perk_award_id, cycle_start, occurrence_index)
      DO NOTHING
    `,
    [accountId, perkAwardId, cycleStart, occurrenceIndex],
  );
};

const deletePerkCompletion = async ({
  accountId,
  perkAwardId,
  cycleStart,
  occurrenceIndex,
}) => {
  await db.query(
    `
      DELETE FROM credit_card_perk_completions
      WHERE
        account_id = $1
        AND perk_award_id = $2
        AND cycle_start = $3
        AND occurrence_index = $4
    `,
    [accountId, perkAwardId, cycleStart, occurrenceIndex],
  );
};

module.exports = {
  createCardTypeWithRewards,
  deleteAccountType,
  deleteCardType,
  deletePerkCompletion,
  findCreditAccountByIdForUser,
  findCreditAccountsByUserId,
  findCreditAccountWithTypeByIdForUser,
  findCreditCardTypeById,
  findPerkAwardById,
  findPerkCompletionsForAccountCycles,
  findRewardCatalog,
  setPerkCompletion,
  updateCardTypeWithRewards,
  upsertAccountType,
};
