/**
 * Extract and parse JSON from a string that may be wrapped in markdown
 * code fences (```json ... ```) as returned by some LLM APIs.
 */
export function parseJSONLoose(raw: string): unknown {
  const trimmed = raw.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // Strip markdown code fences: ```json\n{...}\n``` or ```\n{...}\n```
    const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenced) {
      return JSON.parse(fenced[1].trim())
    }

    // Last resort: find first { ... } or [ ... ] in the string
    const objMatch = trimmed.match(/(\{[\s\S]*\})/)
    const arrMatch = trimmed.match(/(\[[\s\S]*\])/)
    const candidate = objMatch?.[1] ?? arrMatch?.[1]
    if (candidate) {
      return JSON.parse(candidate)
    }

    throw new SyntaxError(`No valid JSON found in: ${trimmed.slice(0, 120)}`)
  }
}
