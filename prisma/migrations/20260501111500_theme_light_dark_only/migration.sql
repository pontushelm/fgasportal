UPDATE "users"
SET "themePreference" = 'light'
WHERE "themePreference" = 'system';

ALTER TABLE "users"
ALTER COLUMN "themePreference" SET DEFAULT 'light';
