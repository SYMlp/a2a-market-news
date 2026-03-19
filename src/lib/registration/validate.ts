export interface ValidationResult {
  valid: boolean
  appInfo?: { name: string; description: string; circleName: string }
  reason?: string
}

const VALIDATE_TIMEOUT_MS = 8_000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates a SecondMe app clientId by format check + lightweight API probe.
 *
 * Fail-open policy: network errors or ambiguous responses allow registration
 * to proceed — we only block on definitive format violations.
 */
export async function validateSecondMeApp(
  clientId: string,
  accessToken: string,
): Promise<ValidationResult> {
  const trimmed = clientId.trim()

  if (!trimmed) {
    return { valid: false, reason: 'SecondMe ClientId 不能为空' }
  }

  if (!UUID_RE.test(trimmed)) {
    return {
      valid: false,
      reason: `「${trimmed}」不是合法的 ClientId 格式（应为 UUID，如 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）`,
    }
  }

  const apiBase = process.env.SECONDME_API_BASE_URL
  if (!apiBase || !accessToken) {
    return {
      valid: true,
      appInfo: { name: '', description: '', circleName: '' },
      reason: '缺少 API 配置或 Token，已放行',
    }
  }

  try {
    const url = `${apiBase}/api/secondme/chat/session/list?appId=${trimmed}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.code === 0) {
          return {
            valid: true,
            appInfo: { name: '', description: '', circleName: '' },
          }
        }
      }

      return {
        valid: true,
        appInfo: { name: '', description: '', circleName: '' },
        reason: `验证服务返回非标准响应，已放行`,
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    console.error('SecondMe clientId validation error:', error)
    return {
      valid: true,
      appInfo: { name: '', description: '', circleName: '' },
      reason: '无法连接 SecondMe 验证服务，已放行',
    }
  }
}
