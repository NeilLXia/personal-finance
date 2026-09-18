-- Intentionally inert.
--
-- This migration used to INSERT a hard-coded 'primary@example.com' /
-- 'demo@example.com' user pair into every environment. That is seed data, not
-- schema, and nothing in the app references those rows (real users come from
-- Google sign-in; demo users are per-session 'demo+<uuid>@example.com'). Databases
-- that already applied it keep the rows harmlessly; fresh databases get nothing
-- here. Demo setup now lives in an explicit script: `npm run db:seed-demo`.
SELECT 1;
