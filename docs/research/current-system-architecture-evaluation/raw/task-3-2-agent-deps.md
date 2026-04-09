# Task 3.2 Raw: Agent Space Module Import Graph

## engine/ imports

session, types, template, match, ontology, session-context, conversation-guard, game-loop, ai-classifier, fc-dispatcher, precondition-eval, scene-loader
session-context → ontology, session, behavior-engine, precondition-eval
game-loop → scenes, template, match, session-context, ontology, session, conversation-guard, behavior-engine
fc-dispatcher → ontology, session-context

## gm/ imports

engine (re-exports), scenes, function-call-executor, route-utils
function-call-executor → engine/fc-dispatcher

## npc/ imports

engine/template, engine/game-loop, engine/ontology, engine/types

## component-runtime/ imports

engine/types, gm/route-utils, gamification, prisma, registration, notification

## behavior-engine/ imports

engine/types, component-runtime (subflow-adapter)

## subflow/ imports

engine/types, engine/session

## pa/ imports

engine/types

## Cycle check

No obvious cycles. engine is the hub. gm, npc, component-runtime, behavior-engine, subflow, pa all depend on engine. component-runtime also depends on gm (route-utils), gamification.
