-- PA Behavior: paGoal + returnReason on GameTurnLog

ALTER TABLE "game_turn_logs" ADD COLUMN "pa_goal" TEXT;
ALTER TABLE "game_turn_logs" ADD COLUMN "return_reason" TEXT;
