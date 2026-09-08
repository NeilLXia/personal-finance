'use strict';

const db = require('../db/connection');

const upsertFromGoogleProfile = async ({
  email,
  name,
  googleSub,
  avatarUrl,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO users (
        email,
        name,
        google_sub,
        avatar_url,
        is_demo,
        demo_expires_at
      )
      VALUES ($1, $2, $3, $4, FALSE, NULL)
      ON CONFLICT (email) DO UPDATE
      SET
        name = COALESCE(EXCLUDED.name, users.name),
        google_sub = COALESCE(users.google_sub, EXCLUDED.google_sub),
        avatar_url = EXCLUDED.avatar_url,
        is_demo = FALSE,
        demo_expires_at = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [email, name, googleSub, avatarUrl],
  );

  return rows[0];
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [
    email,
  ]);
  return rows[0] || null;
};

const list = async () => {
  const { rows } = await db.query('SELECT * FROM users ORDER BY created_at DESC');
  return rows;
};

const isExpiredDemoUser = (user) =>
  Boolean(
    user?.is_demo &&
      user.demo_expires_at &&
      new Date(user.demo_expires_at).getTime() <= Date.now(),
  );

const deleteExpiredDemoUsers = async () => {
  const { rowCount } = await db.query(
    `
      DELETE FROM users
      WHERE is_demo = TRUE
        AND demo_expires_at IS NOT NULL
        AND demo_expires_at <= NOW()
    `,
  );

  return rowCount;
};

module.exports = {
  upsertFromGoogleProfile,
  findById,
  findByEmail,
  isExpiredDemoUser,
  deleteExpiredDemoUsers,
  list,
};
