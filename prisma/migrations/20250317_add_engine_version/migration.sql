-- Add engine version tracking and session end reason to game logs
ALTER TABLE "game_session_logs" ADD COLUMN "end_reason" TEXT;
ALTER TABLE "game_session_logs" ADD COLUMN "engine_version" TEXT NOT NULL DEFAULT '1';
CREATE INDEX "game_session_logs_engine_version_idx" ON "game_session_logs"("engine_version");

-- Tag all existing sessions as v1 (pre-optimization)
UPDATE "game_session_logs" SET "engine_version" = '1' WHERE "engine_version" = '1';
