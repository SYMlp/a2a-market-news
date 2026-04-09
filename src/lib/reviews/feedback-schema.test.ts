import { describe, it, expect } from 'vitest'
import { validateFeedback, FEEDBACK_SCHEMA_VERSION } from './feedback-schema'

const VALID_MINIMAL = {
  targetClientId: 'client-abc-123',
  agentId: 'agent-001',
  agentName: 'TestPA',
  agentType: 'pa',
  overallRating: 4,
  summary: 'Great app, very creative!',
}

const VALID_FULL = {
  ...VALID_MINIMAL,
  dimensions: {
    usability: 5,
    creativity: 4,
    responsiveness: 3,
    fun: 5,
    reliability: 4,
  },
  details: 'I tested the app thoroughly and found it to be very engaging.',
  tags: ['innovative', 'fun', 'responsive'],
  recommendation: 'strongly_recommend',
}

describe('FEEDBACK_SCHEMA_VERSION', () => {
  it('should be 1.0.0', () => {
    expect(FEEDBACK_SCHEMA_VERSION).toBe('1.0.0')
  })
})

describe('validateFeedback — valid payloads', () => {
  it('accepts minimal required fields', () => {
    const result = validateFeedback(VALID_MINIMAL)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeNull()
  })

  it('accepts full payload with all optional fields', () => {
    const result = validateFeedback(VALID_FULL)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeNull()
  })

  it('accepts partial dimensions', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      dimensions: { usability: 3, fun: 5 },
    })
    expect(result.valid).toBe(true)
  })

  it('accepts empty tags array', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, tags: [] })
    expect(result.valid).toBe(true)
  })

  it('accepts all valid agentType values', () => {
    for (const agentType of ['pa', 'openclaw', 'developer_pa']) {
      const result = validateFeedback({ ...VALID_MINIMAL, agentType })
      expect(result.valid).toBe(true)
    }
  })

  it('accepts all valid recommendation values', () => {
    for (const recommendation of ['strongly_recommend', 'recommend', 'neutral', 'not_recommend']) {
      const result = validateFeedback({ ...VALID_MINIMAL, recommendation })
      expect(result.valid).toBe(true)
    }
  })

  it('accepts overallRating at boundary min=1', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, overallRating: 1 })
    expect(result.valid).toBe(true)
  })

  it('accepts overallRating at boundary max=5', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, overallRating: 5 })
    expect(result.valid).toBe(true)
  })
})

describe('validateFeedback — missing required fields', () => {
  const requiredFields = [
    'targetClientId',
    'agentId',
    'agentName',
    'agentType',
    'overallRating',
    'summary',
  ]

  for (const field of requiredFields) {
    it(`rejects when ${field} is missing`, () => {
      const payload = { ...VALID_MINIMAL }
      delete (payload as Record<string, unknown>)[field]
      const result = validateFeedback(payload)
      expect(result.valid).toBe(false)
      expect(result.errors).not.toBeNull()
    })
  }

  it('rejects empty object', () => {
    const result = validateFeedback({})
    expect(result.valid).toBe(false)
    expect(result.errors!.length).toBeGreaterThan(0)
  })
})

describe('validateFeedback — type and enum constraints', () => {
  it('rejects invalid agentType', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, agentType: 'bot' })
    expect(result.valid).toBe(false)
  })

  it('rejects invalid recommendation', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, recommendation: 'maybe' })
    expect(result.valid).toBe(false)
  })

  it('rejects overallRating below minimum (0)', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, overallRating: 0 })
    expect(result.valid).toBe(false)
  })

  it('rejects overallRating above maximum (6)', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, overallRating: 6 })
    expect(result.valid).toBe(false)
  })

  it('rejects non-integer overallRating', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, overallRating: 3.5 })
    expect(result.valid).toBe(false)
  })

  it('rejects overallRating as string', () => {
    const result = validateFeedback({ ...VALID_MINIMAL, overallRating: '4' })
    expect(result.valid).toBe(false)
  })
})

describe('validateFeedback — summary constraints', () => {
  it('rejects summary exceeding 200 chars', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      summary: 'x'.repeat(201),
    })
    expect(result.valid).toBe(false)
  })

  it('accepts summary at exactly 200 chars', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      summary: 'x'.repeat(200),
    })
    expect(result.valid).toBe(true)
  })
})

describe('validateFeedback — dimensions constraints', () => {
  it('rejects dimension value below 1', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      dimensions: { usability: 0 },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects dimension value above 5', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      dimensions: { creativity: 6 },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects unknown dimension property', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      dimensions: { unknownDim: 3 },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects non-integer dimension value', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      dimensions: { fun: 2.5 },
    })
    expect(result.valid).toBe(false)
  })
})

describe('validateFeedback — additionalProperties', () => {
  it('rejects unknown top-level property', () => {
    const result = validateFeedback({
      ...VALID_MINIMAL,
      extraField: 'should not be here',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects completely alien payload', () => {
    const result = validateFeedback({ foo: 'bar', baz: 123 })
    expect(result.valid).toBe(false)
  })
})

describe('validateFeedback — edge cases', () => {
  it('rejects null', () => {
    const result = validateFeedback(null)
    expect(result.valid).toBe(false)
  })

  it('rejects undefined', () => {
    const result = validateFeedback(undefined)
    expect(result.valid).toBe(false)
  })

  it('rejects string', () => {
    const result = validateFeedback('not an object')
    expect(result.valid).toBe(false)
  })

  it('rejects number', () => {
    const result = validateFeedback(42)
    expect(result.valid).toBe(false)
  })

  it('rejects array', () => {
    const result = validateFeedback([VALID_MINIMAL])
    expect(result.valid).toBe(false)
  })

  it('returns allErrors mode (multiple errors for multiple issues)', () => {
    const result = validateFeedback({})
    expect(result.errors!.length).toBeGreaterThan(1)
  })
})
