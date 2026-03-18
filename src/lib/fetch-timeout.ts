const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Wrapper around fetch with an AbortController-based timeout.
 * Throws if the request does not complete within `timeoutMs`.
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}
