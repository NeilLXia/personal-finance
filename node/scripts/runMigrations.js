'use strict';

require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { resolveDatabaseSecret } = require('../src/config/databaseSecret');

const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations');

// Arbitrary but fixed key so concurrent deploys serialize on the same advisory
// lock instead of racing to apply the same migration.
const MIGRATION_LOCK_KEY = 4919283746150001;

const applyMigrations = async (db) => {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  const client = await db.getClient();
  let lockAcquired = false;

  try {
    // Session-level advisory lock held on this one connection for the whole
    // run; a second migrator blocks here until the first commits and releases.
    await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version],
      );

      if (applied.rowCount > 0) {
        console.log(`skipping ${version}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        console.log(`applied ${version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (lockAcquired) {
      await client
        .query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY])
        .catch(() => {});
    }
    client.release();
  }
};

const run = async () => {
  await resolveDatabaseSecret();

  // Require only after the secret is in the environment: db/connection builds
  // its pool from process.env at module load.
  const db = require('../src/db/connection');

  try {
    await applyMigrations(db);
  } finally {
    await db.closePool();
  }
};

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
