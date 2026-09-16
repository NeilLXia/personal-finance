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

const getBenefitStatus = (value) => value || 'included';

const getBenefitSource = (value) => value || 'manual';

const normalizeNullableText = (value) => value || null;

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
          annual_fee,
          status,
          source
        )
        VALUES ($1, $2, 'active', 'manual')
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
            keywords,
            status,
            source,
            source_description,
            status_reason,
            match_strategy,
            source_fingerprint
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          cardType.id,
          reward.category,
          reward.rewardPercent,
          reward.keywords,
          getBenefitStatus(reward.status),
          getBenefitSource(reward.source),
          normalizeNullableText(reward.sourceDescription),
          normalizeNullableText(reward.statusReason),
          normalizeNullableText(reward.matchStrategy),
          normalizeNullableText(reward.sourceFingerprint),
        ],
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
            auto_complete,
            status,
            source,
            source_description,
            status_reason,
            match_strategy,
            source_fingerprint
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          cardType.id,
          award.name,
          award.dollarValue,
          award.completionAmount,
          award.frequencyCount,
          award.frequencyPeriod,
          award.autoComplete,
          getBenefitStatus(award.status),
          getBenefitSource(award.source),
          normalizeNullableText(award.sourceDescription),
          normalizeNullableText(award.statusReason),
          normalizeNullableText(award.matchStrategy),
          normalizeNullableText(award.sourceFingerprint),
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
        SET
          name = $1,
          annual_fee = $2,
          status = 'active',
          review_reason = NULL,
          updated_at = NOW()
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
            SET
              category = $1,
              reward_percent = $2,
              keywords = $3,
              status = $4,
              source = COALESCE($5, source),
              source_description = $6,
              status_reason = $7,
              match_strategy = $8,
              source_fingerprint = COALESCE($9, source_fingerprint),
              updated_at = NOW()
            WHERE id = $10 AND credit_card_type_id = $11
          `,
          [
            reward.category,
            reward.rewardPercent,
            reward.keywords,
            getBenefitStatus(reward.status),
            getBenefitSource(reward.source),
            normalizeNullableText(reward.sourceDescription),
            normalizeNullableText(reward.statusReason),
            normalizeNullableText(reward.matchStrategy),
            normalizeNullableText(reward.sourceFingerprint),
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
              keywords,
              status,
              source,
              source_description,
              status_reason,
              match_strategy,
              source_fingerprint
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `,
          [
            cardTypeId,
            reward.category,
            reward.rewardPercent,
            reward.keywords,
            getBenefitStatus(reward.status),
            getBenefitSource(reward.source),
            normalizeNullableText(reward.sourceDescription),
            normalizeNullableText(reward.statusReason),
            normalizeNullableText(reward.matchStrategy),
            normalizeNullableText(reward.sourceFingerprint),
          ],
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
              status = $6,
              source = COALESCE($7, source),
              source_description = $8,
              status_reason = $9,
              match_strategy = $10,
              source_fingerprint = COALESCE($11, source_fingerprint),
              updated_at = NOW()
            WHERE id = $12 AND credit_card_type_id = $13
          `,
          [
            award.name,
            award.dollarValue,
            award.frequencyCount,
            award.frequencyPeriod,
            award.autoComplete,
            getBenefitStatus(award.status),
            getBenefitSource(award.source),
            normalizeNullableText(award.sourceDescription),
            normalizeNullableText(award.statusReason),
            normalizeNullableText(award.matchStrategy),
            normalizeNullableText(award.sourceFingerprint),
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
              auto_complete,
              status,
              source,
              source_description,
              status_reason,
              match_strategy,
              source_fingerprint
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            getBenefitStatus(award.status),
            getBenefitSource(award.source),
            normalizeNullableText(award.sourceDescription),
            normalizeNullableText(award.statusReason),
            normalizeNullableText(award.matchStrategy),
            normalizeNullableText(award.sourceFingerprint),
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

const normalizeBenefitSignature = (values) =>
  values
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');

const getEarningSignature = (reward) =>
  normalizeBenefitSignature([
    reward.category,
    Number(reward.rewardPercent ?? reward.reward_percent ?? 0),
    reward.keywords,
  ]);

const getPerkSignature = (award) =>
  normalizeBenefitSignature([
    award.name,
    Number(award.dollarValue ?? award.dollar_value ?? 0),
    award.frequencyCount ?? award.frequency_count ?? 1,
    award.frequencyPeriod ?? award.frequency_period ?? 'per_year',
  ]);

const insertImportedEarningReward = async ({ client, cardTypeId, reward }) => {
  await client.query(
    `
      INSERT INTO credit_card_earning_rewards (
        credit_card_type_id,
        category,
        reward_percent,
        keywords,
        status,
        source,
        external_reward_id,
        source_description,
        status_reason,
        match_strategy,
        source_fingerprint
      )
      VALUES ($1, $2, $3, $4, $5, 'vectormint', $6, $7, $8, $9, $10)
      ON CONFLICT (credit_card_type_id, source, external_reward_id)
      WHERE external_reward_id IS NOT NULL
      DO NOTHING
    `,
    [
      cardTypeId,
      reward.category,
      reward.rewardPercent,
      reward.keywords,
      getBenefitStatus(reward.status),
      normalizeNullableText(reward.externalId),
      normalizeNullableText(reward.sourceDescription),
      normalizeNullableText(reward.statusReason),
      normalizeNullableText(reward.matchStrategy),
      normalizeNullableText(reward.sourceFingerprint),
    ],
  );
};

const insertImportedPerkAward = async ({ client, cardTypeId, award }) => {
  await client.query(
    `
      INSERT INTO credit_card_perk_awards (
        credit_card_type_id,
        name,
        dollar_value,
        completion_amount,
        frequency_count,
        frequency_period,
        auto_complete,
        status,
        source,
        external_perk_id,
        source_description,
        status_reason,
        match_strategy,
        source_fingerprint
      )
      VALUES ($1, $2, $3, 0, $4, $5, $6, $7, 'vectormint', $8, $9, $10, $11, $12)
      ON CONFLICT (credit_card_type_id, source, external_perk_id)
      WHERE external_perk_id IS NOT NULL
      DO NOTHING
    `,
    [
      cardTypeId,
      award.name,
      award.dollarValue,
      award.frequencyCount,
      award.frequencyPeriod,
      award.autoComplete,
      getBenefitStatus(award.status),
      normalizeNullableText(award.externalId),
      normalizeNullableText(award.sourceDescription),
      normalizeNullableText(award.statusReason),
      normalizeNullableText(award.matchStrategy),
      normalizeNullableText(award.sourceFingerprint),
    ],
  );
};

const mergeImportedBenefits = async ({
  client,
  cardTypeId,
  earningRewards,
  perkAwards,
  existingEarningRewards = null,
  existingPerkAwards = null,
}) => {
  const existingRewards = {
    rows:
      existingEarningRewards ||
      (
        await client.query(
          'SELECT * FROM credit_card_earning_rewards WHERE credit_card_type_id = $1',
          [cardTypeId],
        )
      ).rows,
  };
  const existingPerks = {
    rows:
      existingPerkAwards ||
      (
        await client.query(
          'SELECT * FROM credit_card_perk_awards WHERE credit_card_type_id = $1',
          [cardTypeId],
        )
      ).rows,
  };
  const summary = {
    benefits_added_count: 0,
    benefits_updated_count: 0,
    benefits_preserved_count: 0,
  };

  for (const reward of earningRewards) {
    const existing =
      existingRewards.rows.find(
        (row) =>
          reward.externalId &&
          row.external_reward_id &&
          row.external_reward_id === reward.externalId,
      ) ||
      existingRewards.rows.find(
        (row) => row.source_fingerprint === reward.sourceFingerprint,
      ) ||
      existingRewards.rows.find(
        (row) => getEarningSignature(row) === getEarningSignature(reward),
      );

    if (!existing) {
      await insertImportedEarningReward({ client, cardTypeId, reward });
      summary.benefits_added_count += 1;
      continue;
    }

    if (existing.source_fingerprint === reward.sourceFingerprint) {
      summary.benefits_preserved_count += 1;
      continue;
    }

    await client.query(
      `
        UPDATE credit_card_earning_rewards
        SET
          category = $1,
          reward_percent = $2,
          keywords = $3,
          source = CASE
            WHEN source = 'manual' AND source_fingerprint IS NULL THEN source
            ELSE COALESCE(NULLIF(source, 'manual'), 'vectormint')
          END,
          external_reward_id = COALESCE(external_reward_id, $4),
          source_description = $5,
          status_reason = $6,
          match_strategy = $7,
          source_fingerprint = $8,
          status = CASE
            WHEN source = 'manual' AND source_fingerprint IS NULL THEN status
            WHEN source_fingerprint IS DISTINCT FROM $8 THEN 'needs_review'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = $9
      `,
      [
        reward.category,
        reward.rewardPercent,
        reward.keywords,
        normalizeNullableText(reward.externalId),
        normalizeNullableText(reward.sourceDescription),
        normalizeNullableText(reward.statusReason),
        normalizeNullableText(reward.matchStrategy),
        normalizeNullableText(reward.sourceFingerprint),
        existing.id,
      ],
    );
    summary.benefits_updated_count += 1;
  }

  for (const award of perkAwards) {
    const existing =
      existingPerks.rows.find(
        (row) =>
          award.externalId &&
          row.external_perk_id &&
          row.external_perk_id === award.externalId,
      ) ||
      existingPerks.rows.find(
        (row) => row.source_fingerprint === award.sourceFingerprint,
      ) ||
      existingPerks.rows.find(
        (row) => getPerkSignature(row) === getPerkSignature(award),
      );

    if (!existing) {
      await insertImportedPerkAward({ client, cardTypeId, award });
      summary.benefits_added_count += 1;
      continue;
    }

    if (existing.source_fingerprint === award.sourceFingerprint) {
      summary.benefits_preserved_count += 1;
      continue;
    }

    await client.query(
      `
        UPDATE credit_card_perk_awards
        SET
          name = $1,
          dollar_value = $2,
          frequency_count = $3,
          frequency_period = $4,
          auto_complete = $5,
          source = CASE
            WHEN source = 'manual' AND source_fingerprint IS NULL THEN source
            ELSE COALESCE(NULLIF(source, 'manual'), 'vectormint')
          END,
          external_perk_id = COALESCE(external_perk_id, $6),
          source_description = $7,
          status_reason = $8,
          match_strategy = $9,
          source_fingerprint = $10,
          status = CASE
            WHEN source = 'manual' AND source_fingerprint IS NULL THEN status
            WHEN source_fingerprint IS DISTINCT FROM $10 THEN 'needs_review'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = $11
      `,
      [
        award.name,
        award.dollarValue,
        award.frequencyCount,
        award.frequencyPeriod,
        award.autoComplete,
        normalizeNullableText(award.externalId),
        normalizeNullableText(award.sourceDescription),
        normalizeNullableText(award.statusReason),
        normalizeNullableText(award.matchStrategy),
        normalizeNullableText(award.sourceFingerprint),
        existing.id,
      ],
    );
    summary.benefits_updated_count += 1;
  }

  return summary;
};

const mergeVectorMintCardCatalog = async ({ cards, matchCardTypeId }) => {
  const client = await db.getClient();
  const summary = {
    fetched_count: cards.length,
    matched_count: 0,
    created_review_count: 0,
    updated_count: 0,
    unchanged_count: 0,
    benefits_added_count: 0,
    benefits_updated_count: 0,
    benefits_preserved_count: 0,
    review_required_count: 0,
    warnings: [],
  };

  try {
    await client.query('BEGIN');

    const existingCards = await client.query(
      `
        SELECT id, external_source, external_card_id, source_fingerprint
        FROM credit_card_types
      `,
    );
    const existingRewards = await client.query(
      'SELECT * FROM credit_card_earning_rewards',
    );
    const existingPerks = await client.query(
      'SELECT * FROM credit_card_perk_awards',
    );
    const cardByExternalId = new Map(
      existingCards.rows
        .filter((row) => row.external_source === 'vectormint' && row.external_card_id)
        .map((row) => [row.external_card_id, row]),
    );
    const rewardsByCardTypeId = new Map();
    const perksByCardTypeId = new Map();

    existingRewards.rows.forEach((row) => {
      const key = String(row.credit_card_type_id);
      const rows = rewardsByCardTypeId.get(key) || [];

      rows.push(row);
      rewardsByCardTypeId.set(key, rows);
    });
    existingPerks.rows.forEach((row) => {
      const key = String(row.credit_card_type_id);
      const rows = perksByCardTypeId.get(key) || [];

      rows.push(row);
      perksByCardTypeId.set(key, rows);
    });

    for (const card of cards) {
      let cardTypeId = matchCardTypeId(card);
      let previousFingerprint = null;

      if (!cardTypeId && card.sourceId) {
        const existingCard = cardByExternalId.get(card.sourceId);
        if (existingCard) {
          cardTypeId = existingCard.id;
          previousFingerprint = existingCard.source_fingerprint;
        }
      }

      if (!cardTypeId) {
        const { rows } = await client.query(
          `
            INSERT INTO credit_card_types (
              name,
              annual_fee,
              status,
              source,
              external_source,
              external_card_id,
              source_description,
              review_reason,
              source_fingerprint,
              last_external_sync_at
            )
            VALUES ($1, $2, 'in_review', 'vectormint', 'vectormint', $3, $4, $5, $6, NOW())
            ON CONFLICT (name) DO NOTHING
            RETURNING *
          `,
          [
            card.name,
            card.annualFee,
            normalizeNullableText(card.sourceId),
            normalizeNullableText(card.raw?.issuer || card.raw?.network),
            'New VectorMint card import needs admin review.',
            normalizeNullableText(card.sourceFingerprint),
          ],
        );

        if (!rows[0]) {
          summary.warnings.push(`Skipped duplicate card name: ${card.name}`);
          continue;
        }

        cardTypeId = rows[0].id;
        previousFingerprint = null;
        rewardsByCardTypeId.set(String(cardTypeId), []);
        perksByCardTypeId.set(String(cardTypeId), []);
        summary.created_review_count += 1;
      } else {
        const { rows } = await client.query(
          `
            UPDATE credit_card_types
            SET
              external_source = COALESCE(external_source, 'vectormint'),
              external_card_id = COALESCE(external_card_id, $1),
              source_fingerprint = $2,
              review_reason = CASE
                WHEN annual_fee IS DISTINCT FROM $3 THEN 'VectorMint annual fee differs from stored card.'
                WHEN source_fingerprint IS DISTINCT FROM $2 THEN review_reason
                ELSE review_reason
              END,
              last_external_sync_at = NOW(),
              updated_at = NOW()
            WHERE id = $4
            RETURNING source_fingerprint
          `,
          [
            normalizeNullableText(card.sourceId),
            normalizeNullableText(card.sourceFingerprint),
            card.annualFee,
            cardTypeId,
          ],
        );
        previousFingerprint = previousFingerprint || rows[0]?.source_fingerprint;
        summary.matched_count += 1;
      }

      const benefitSummary = await mergeImportedBenefits({
        client,
        cardTypeId,
        earningRewards: card.earningRewards,
        perkAwards: card.perkAwards,
        existingEarningRewards: rewardsByCardTypeId.get(String(cardTypeId)) || [],
        existingPerkAwards: perksByCardTypeId.get(String(cardTypeId)) || [],
      });
      summary.benefits_added_count += benefitSummary.benefits_added_count;
      summary.benefits_updated_count += benefitSummary.benefits_updated_count;
      summary.benefits_preserved_count += benefitSummary.benefits_preserved_count;

      if (previousFingerprint === card.sourceFingerprint) {
        summary.unchanged_count += 1;
      } else {
        summary.updated_count += 1;
      }

      if (
        card.earningRewards.some((reward) => reward.status !== 'included') ||
        card.perkAwards.some((award) => award.status !== 'included')
      ) {
        summary.review_required_count += 1;
      }
    }

    await client.query('COMMIT');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
  mergeVectorMintCardCatalog,
  setPerkCompletion,
  updateCardTypeWithRewards,
  upsertAccountType,
};
