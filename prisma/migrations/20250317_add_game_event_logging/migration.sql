-- Game Event Logging: session-level summaries + per-turn detail

CREATE TABLE "game_session_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "agent_name" TEXT,
    "mode" TEXT NOT NULL,
    "start_scene" TEXT NOT NULL,
    "total_turns" INTEGER NOT NULL DEFAULT 0,
    "scenes_visited" JSONB,
    "loops_detected" INTEGER NOT NULL DEFAULT 0,
    "errors_occurred" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_session_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_turn_logs" (
    "id" TEXT NOT NULL,
    "session_log_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "scene_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "input_content" TEXT,
    "original_message" TEXT,
    "action_matched" TEXT,
    "match_method" TEXT,
    "outcome_type" TEXT,
    "function_call_name" TEXT,
    "function_call_status" TEXT,
    "npc_reply" TEXT,
    "transition_from" TEXT,
    "transition_to" TEXT,
    "loop_detected" BOOLEAN NOT NULL DEFAULT false,
    "is_sub_flow" BOOLEAN NOT NULL DEFAULT false,
    "error_occurred" BOOLEAN NOT NULL DEFAULT false,
    "error_detail" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_turn_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_session_logs_session_id_key" ON "game_session_logs"("session_id");
CREATE INDEX "game_session_logs_user_id_idx" ON "game_session_logs"("user_id");
CREATE INDEX "game_session_logs_started_at_idx" ON "game_session_logs"("started_at");

CREATE INDEX "game_turn_logs_session_id_idx" ON "game_turn_logs"("session_id");
CREATE INDEX "game_turn_logs_user_id_idx" ON "game_turn_logs"("user_id");
CREATE INDEX "game_turn_logs_scene_id_idx" ON "game_turn_logs"("scene_id");
CREATE INDEX "game_turn_logs_created_at_idx" ON "game_turn_logs"("created_at");

ALTER TABLE "game_turn_logs" ADD CONSTRAINT "game_turn_logs_session_log_id_fkey"
    FOREIGN KEY ("session_log_id") REFERENCES "game_session_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
