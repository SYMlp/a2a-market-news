-- Schema merge: AppPA + A2AApp -> App
-- Run this migration BEFORE applying the new Prisma schema.
-- Prerequisites: Backup database. Ensure no active writes during migration.

-- 1. Add A2AApp-only columns and OpenClaw fields to app_pas
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "vote_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "score" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "short_prompt" TEXT;
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "detailed_prompt" TEXT;
ALTER TABLE "app_pas" ADD COLUMN IF NOT EXISTS "system_summary" TEXT;

-- 2. Copy data from a2a_apps to app_pas (where linked)
UPDATE "app_pas" ap
SET
  category = COALESCE(a.category, ''),
  view_count = COALESCE(a.view_count, 0),
  vote_count = COALESCE(a.vote_count, 0),
  score = COALESCE(a.score, 0)
FROM "a2a_apps" a
WHERE a.app_pa_id = ap.id;

-- 3. Remap votes.app_id: a2a_apps.id -> app_pas.id
-- Drop FK first (PostgreSQL auto-generated name)
ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "votes_app_id_fkey";
UPDATE "votes" v
SET app_id = a.app_pa_id
FROM "a2a_apps" a
WHERE v.app_id = a.id;

-- 4. Remap ranking_entries.app_id
ALTER TABLE "ranking_entries" DROP CONSTRAINT IF EXISTS "ranking_entries_app_id_fkey";
UPDATE "ranking_entries" re
SET app_id = a.app_pa_id
FROM "a2a_apps" a
WHERE re.app_id = a.id;

-- 5. Remap contest_entries.app_id
ALTER TABLE "contest_entries" DROP CONSTRAINT IF EXISTS "contest_entries_app_id_fkey";
UPDATE "contest_entries" ce
SET app_id = a.app_pa_id
FROM "a2a_apps" a
WHERE ce.app_id = a.id;

-- 6. Drop a2a_apps (users.a2aApps FK will be dropped with it)
ALTER TABLE "a2a_apps" DROP CONSTRAINT IF EXISTS "a2a_apps_app_pa_id_fkey";
ALTER TABLE "a2a_apps" DROP CONSTRAINT IF EXISTS "a2a_apps_developer_id_fkey";
DROP TABLE IF EXISTS "a2a_apps";

-- 7. Rename app_pas -> apps
ALTER TABLE "app_pas" RENAME TO "apps";

-- 8. Rename app_pa_metrics -> app_metrics, app_pa_id -> app_id
ALTER TABLE "app_pa_metrics" DROP CONSTRAINT IF EXISTS "app_pa_metrics_app_pa_id_fkey";
ALTER TABLE "app_pa_metrics" RENAME COLUMN "app_pa_id" TO "app_id";
ALTER TABLE "app_pa_metrics" RENAME TO "app_metrics";
ALTER TABLE "app_metrics" ADD CONSTRAINT "app_metrics_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Rename app_pa_posts -> app_posts, app_pa_id -> app_id
ALTER TABLE "app_pa_posts" DROP CONSTRAINT IF EXISTS "app_pa_posts_app_pa_id_fkey";
ALTER TABLE "app_pa_posts" RENAME COLUMN "app_pa_id" TO "app_id";
ALTER TABLE "app_pa_posts" RENAME TO "app_posts";
ALTER TABLE "app_posts" ADD CONSTRAINT "app_posts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Rename app_pa_comments -> app_comments, app_pa_id -> app_id
ALTER TABLE "app_pa_comments" DROP CONSTRAINT IF EXISTS "app_pa_comments_app_pa_id_fkey";
ALTER TABLE "app_pa_comments" RENAME COLUMN "app_pa_id" TO "app_id";
ALTER TABLE "app_pa_comments" RENAME TO "app_comments";
ALTER TABLE "app_comments" ADD CONSTRAINT "app_comments_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 11. Rename app_feedbacks.app_pa_id -> app_id
ALTER TABLE "app_feedbacks" DROP CONSTRAINT IF EXISTS "app_feedbacks_app_pa_id_fkey";
ALTER TABLE "app_feedbacks" RENAME COLUMN "app_pa_id" TO "app_id";
ALTER TABLE "app_feedbacks" ADD CONSTRAINT "app_feedbacks_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 12. Re-add FKs for votes, ranking_entries, contest_entries -> apps
ALTER TABLE "votes" ADD CONSTRAINT "votes_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. Rename unique constraint on app_metrics (app_pa_id, date) -> (app_id, date)
ALTER TABLE "app_metrics" DROP CONSTRAINT IF EXISTS "app_pa_metrics_app_pa_id_date_key";
ALTER TABLE "app_metrics" DROP CONSTRAINT IF EXISTS "app_metrics_app_id_date_key";
ALTER TABLE "app_metrics" ADD CONSTRAINT "app_metrics_app_id_date_key" UNIQUE ("app_id", "date");
