# Model Selection Guide

## §1 Available Models

The platform supports two LLM models (verified 2026-03-17):

| Model | ID | Latency | Use Case |
|:------|:---|:--------|:---------|
| **Sonnet** | `anthropic/claude-sonnet-4-5` | ~6s | User-facing dialogue quality |
| **Flash** | `google_ai_studio/gemini-2.0-flash` | ~2s | Structured outputs, speed-sensitive loops |

**Strategy**: Sonnet for user-facing dialogue quality; Flash for structured outputs and speed-sensitive loops.

---

## §2 MODEL_FOR Assignment Table

All model assignments are centralized in `src/lib/model-config.ts`. Add new API calls by choosing the appropriate key.

| Key | Model | Rationale |
|:----|:------|:----------|
| `npcDialogue` | Sonnet | NPC responses are user-facing; quality matters |
| `paFormulateAdvisor` | Sonnet | PA formulates from human advice; user sees the result |
| `paFormulateAuto` | Flash | Auto mode: PA responds alone; speed over polish |
| `intentExtract` | Flash | Structured JSON output; Flash is reliable and fast |
| `actionClassify` | Flash | AI classifier in GM; 8s timeout, needs speed |
| `paReview` | Flash | PA action review; internal flow, speed priority |
| `paVote` | Flash | PA voting; internal flow |
| `paDiscuss` | Flash | PA discussion; internal flow |
| `paDiscover` | Flash | PA discovery; internal flow |
| `paDailyReport` | Flash | PA daily report; internal flow |

---

## §3 Mode Configurations

### Advisor Mode (default)

- **Stage 0**: Human (blocking) — types advice
- **Stage 1**: PA formulates (Sonnet) — user sees PA's response
- **Stage 2**: Intent extraction (Flash)
- **Stage 3**: GM engine (Flash classifier → keyword fallback)
- **Stage 4**: NPC response (Sonnet)

### Auto Mode

- **Stage 0**: skip
- **Stage 1**: PA formulates (Flash) — no human input, speed dominant
- **Stage 2**: Intent extraction (Flash)
- **Stage 3**: GM engine (Flash)
- **Stage 4**: NPC response (Sonnet)

### Manual-Direct Mode

- **Stage 0**: Human (blocking) — selects action button
- **Stage 1**: skip — action already known
- **Stage 2**: skip
- **Stage 3**: GM engine
- **Stage 4**: NPC response (Sonnet)

---

## §4 Tuning Guide

Model selection is a **one-line change** per purpose. Edit `src/lib/model-config.ts`:

```ts
export const MODEL_FOR = {
  npcDialogue: MODEL.QUALITY,   // or MODEL.FAST for faster, lower-quality replies
  paFormulateAdvisor: MODEL.QUALITY,
  paFormulateAuto: MODEL.FAST,
  intentExtract: MODEL.FAST,
  actionClassify: MODEL.FAST,
  // ... other keys
} as const satisfies Record<string, ModelId>
```

To change a model globally (e.g. swap Sonnet for Flash):

1. Change the `MODEL` constant values if adding new models
2. Change the corresponding `MODEL_FOR` key value

All API call sites import from `MODEL_FOR`; no scattered model strings.

---

## §5 Fallback Strategy

`FALLBACK_FOR` in `src/lib/model-config.ts` defines automatic model degradation:

```ts
export const FALLBACK_FOR: Partial<Record<ModelId, ModelId>> = {
  [MODEL.QUALITY]: MODEL.FAST,
}
```

**Behavior** (`callSecondMeStream` in `pa-engine.ts`):

1. Primary call with the configured model
2. If the call fails with a **retryable error** (timeout via AbortError, or HTTP 5xx), and a fallback model exists → retry once with the fallback model
3. **Non-retryable errors** (400, 401, 403) pass through immediately — no fallback

**Design rationale**: Sonnet (QUALITY) has higher latency (~6s) and occasional 5xx. When it fails, Flash (FAST) provides a lower-quality but functional response. Flash has no cheaper fallback since it's already the fast/cheap option.

**Timeout**: `STREAM_TIMEOUT_MS = 12_000` (12 seconds). Chosen to give Sonnet enough time for complex responses while not blocking the user too long before fallback kicks in.
