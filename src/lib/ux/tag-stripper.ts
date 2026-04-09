const LLM_TAG_PATTERN =
  /<\s*\/?\s*(?:think|thinking|thought|final)\b[^>]*>[\s\S]*?<\s*\/\s*(?:think|thinking|thought|final)\s*>/gi

const SELF_CLOSING_TAG_PATTERN =
  /<\s*(?:think|thinking|thought|final)\b[^>]*\/\s*>/gi

const UNCLOSED_TAG_PATTERN =
  /<\s*(?:think|thinking|thought|final)\b[^>]*>[\s\S]*$/gi

const MARKDOWN_THINKING_BLOCK =
  /^>\s*\[!(?:thinking|thought|note)\].*(?:\n(?:>.*)?)*\n?/gm

const CONSECUTIVE_BLANK_LINES = /\n{3,}/g

export function stripLLMTags(text: string): string {
  const cleaned = text
    .replace(LLM_TAG_PATTERN, '')
    .replace(SELF_CLOSING_TAG_PATTERN, '')
    .replace(UNCLOSED_TAG_PATTERN, '')
    .replace(MARKDOWN_THINKING_BLOCK, '')
    .replace(CONSECUTIVE_BLANK_LINES, '\n\n')
    .trim()

  return cleaned
}
