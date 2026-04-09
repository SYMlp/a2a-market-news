# Task 1.3 Raw: Ontology Entity/Edge Coverage

## Manifest entity types (10)

| Entity | Manifest | platform-ontology | operational-ontology | communication-protocol | Code |
|--------|----------|-------------------|----------------------|------------------------|------|
| Scene | ✓ | scenes{} | - | - | ontology.ts, scene-loader |
| NPC | ✓ | scenes[id].npc | - | - | npc-loader, ontology |
| Capability | ✓ | scenes[id].capabilities[] | - | - | ontology |
| FunctionCall | ✓ | - | functionCalls{} | - | fc-dispatcher, ontology |
| DataLoader | ✓ | - | dataLoaders{} | - | route-utils |
| Precondition | ✓ | - | preconditions{} | - | precondition-eval |
| MessageType | ✓ | - | - | messageTypes{} | ontology |
| BehaviorSpec | ✓ | specs/*.yaml | - | - | component-runtime |
| BehaviorPattern | ✓ | - | functionCalls[].behaviorPattern | - | fc-dispatcher |
| PresentationStyle | ✓ | docs | - | - | SpecFormCard, DeckView |

## Manifest edge types (14)

has_npc, has_capability, exits_to, hosts_behavior, fc_in_scene, fc_requires, fc_has_pattern,
loader_bound_to, precondition_unlocks, behavior_implements, behavior_preconditions,
behavior_resolves_via, behavior_uses_data, behavior_presents_with

## Code usage (ontology.ts)

- getOntology() → platform
- getOperationalOntology() → functionCalls, dataLoaders, preconditions
- getCommunicationProtocol() → messageTypes, npcDecisionProtocols
- serializeForNPC, serializeForPA, toEnvelope

## Coverage: 10/10 entity types implemented in code
