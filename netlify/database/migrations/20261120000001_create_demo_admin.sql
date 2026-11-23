-- Demo account for showing the site: login "admin", password "admin", on the Pro plan, already verified.
-- The password is stored as a scrypt hash, never in plain text. It is the same hash the development login uses.
--
-- WARNING: this login is guessable. Anyone who opens the sign-in page can try admin / admin and get a Pro account.
-- Remove it after the demo with a new migration, for example
--   netlify/database/migrations/<number>_remove_demo_admin.sql  containing:
--   DELETE FROM "User" WHERE "email" = 'admin';
-- Do not edit or delete this file once it has been deployed.
INSERT INTO "User" ("id", "email", "name", "passwordHash", "emailVerifiedAt", "failedLogins", "createdAt", "subscription")
VALUES (
  'demo-admin',
  'admin',
  'Admin',
  'scrypt$16384$8$1$918d99ba46ccc5acc28c189ccaf7ca2a$51c4743c3d317e59ff3908fe593c7133482a853837b651fd5c31ddcceee95281e148a44f552bfdb241fa24d89888a37089a5f8c354eae6cf6c53e874f0659270',
  now(),
  0,
  now(),
  'active'
)
ON CONFLICT ("email") DO NOTHING;
