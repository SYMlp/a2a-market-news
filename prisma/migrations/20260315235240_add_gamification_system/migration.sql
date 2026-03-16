-- CreateTable
CREATE TABLE "achievement_defs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "is_repeatable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "achievement_unlocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "achievement_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "week_key" TEXT,
    "metadata" JSONB,
    "unlocked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "achievement_unlocks_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievement_defs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hall_of_fame_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week_key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "stats" JSONB NOT NULL,
    "badges" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "pa_visitors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "interests" JSONB,
    "tags" JSONB,
    "feedback_count" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_visit_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "client_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pa_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitor_id" TEXT NOT NULL,
    "target_app_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reply_content" TEXT,
    "replied_by" TEXT,
    "replied_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pa_questions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "pa_visitors" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "achievement_defs_key_key" ON "achievement_defs"("key");

-- CreateIndex
CREATE INDEX "achievement_unlocks_agent_id_idx" ON "achievement_unlocks"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_unlocks_achievement_id_agent_id_week_key_key" ON "achievement_unlocks"("achievement_id", "agent_id", "week_key");

-- CreateIndex
CREATE INDEX "hall_of_fame_entries_agent_id_idx" ON "hall_of_fame_entries"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "hall_of_fame_entries_week_key_category_rank_key" ON "hall_of_fame_entries"("week_key", "category", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "pa_visitors_agent_id_key" ON "pa_visitors"("agent_id");

-- CreateIndex
CREATE INDEX "pa_questions_target_app_id_idx" ON "pa_questions"("target_app_id");

-- CreateIndex
CREATE INDEX "pa_questions_visitor_id_idx" ON "pa_questions"("visitor_id");
