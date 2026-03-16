-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secondme_user_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" DATETIME NOT NULL,
    "shades" JSONB,
    "soft_memory" JSONB,
    "is_developer" BOOLEAN NOT NULL DEFAULT false,
    "developer_name" TEXT,
    "callback_url" TEXT,
    "notify_preference" TEXT NOT NULL DEFAULT 'none',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "circles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "app_pas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT,
    "logo" TEXT,
    "circle_id" TEXT NOT NULL,
    "developer_id" TEXT,
    "persona" JSONB,
    "metadata" JSONB,
    "client_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "app_pas_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "app_pas_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_pa_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "app_pa_id" TEXT NOT NULL,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "total_visits" INTEGER NOT NULL DEFAULT 0,
    "avg_session_time" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "new_users_today" INTEGER NOT NULL DEFAULT 0,
    "visits_today" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_pa_metrics_app_pa_id_fkey" FOREIGN KEY ("app_pa_id") REFERENCES "app_pas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_pa_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "app_pa_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metrics" JSONB,
    "circle_id" TEXT,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "app_pa_posts_app_pa_id_fkey" FOREIGN KEY ("app_pa_id") REFERENCES "app_pas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "app_pa_posts_circle_id_fkey" FOREIGN KEY ("circle_id") REFERENCES "circles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_pa_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "app_pa_id" TEXT,
    "user_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_pa_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "app_pa_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "app_pa_comments_app_pa_id_fkey" FOREIGN KEY ("app_pa_id") REFERENCES "app_pas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "app_pa_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "a2a_apps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "website" TEXT,
    "logo" TEXT,
    "app_pa_id" TEXT,
    "developer_id" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "a2a_apps_app_pa_id_fkey" FOREIGN KEY ("app_pa_id") REFERENCES "app_pas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "a2a_apps_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "vote_type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "a2a_apps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "rules" JSONB,
    "prizes" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "contest_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contest_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "highlights" JSONB,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contest_entries_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contest_entries_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "a2a_apps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ranking_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ranking_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "change" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ranking_entries_ranking_id_fkey" FOREIGN KEY ("ranking_id") REFERENCES "rankings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ranking_entries_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "a2a_apps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "related_apps" JSONB,
    "tags" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "market_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "audio_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" DATETIME
);

-- CreateTable
CREATE TABLE "app_feedbacks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target_client_id" TEXT NOT NULL,
    "app_pa_id" TEXT,
    "developer_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct_api',
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_feedbacks_app_pa_id_fkey" FOREIGN KEY ("app_pa_id") REFERENCES "app_pas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "app_feedbacks_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "developer_id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_secondme_user_id_key" ON "users"("secondme_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "circles_name_key" ON "circles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "circles_slug_key" ON "circles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "circles_type_key" ON "circles"("type");

-- CreateIndex
CREATE UNIQUE INDEX "app_pas_client_id_key" ON "app_pas"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_pa_metrics_app_pa_id_date_key" ON "app_pa_metrics"("app_pa_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "a2a_apps_app_pa_id_key" ON "a2a_apps"("app_pa_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_user_id_app_id_key" ON "votes"("user_id", "app_id");

-- CreateIndex
CREATE UNIQUE INDEX "contest_entries_contest_id_app_id_key" ON "contest_entries"("contest_id", "app_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_ranking_id_app_id_key" ON "ranking_entries"("ranking_id", "app_id");

-- CreateIndex
CREATE INDEX "app_feedbacks_target_client_id_idx" ON "app_feedbacks"("target_client_id");

-- CreateIndex
CREATE INDEX "app_feedbacks_developer_id_idx" ON "app_feedbacks"("developer_id");

-- CreateIndex
CREATE INDEX "app_feedbacks_agent_id_idx" ON "app_feedbacks"("agent_id");

-- CreateIndex
CREATE INDEX "notification_logs_developer_id_idx" ON "notification_logs"("developer_id");
