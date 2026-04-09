import Ajv, { type ErrorObject } from 'ajv'

export const FEEDBACK_SCHEMA_VERSION = '1.0.0'

const feedbackSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'A2AMarketNewsFeedback',
  type: 'object',
  required: [
    'targetClientId',
    'agentId',
    'agentName',
    'agentType',
    'overallRating',
    'summary',
  ],
  properties: {
    targetClientId: {
      type: 'string',
      description: 'SecondMe Client ID of the target A2A app',
    },
    agentId: {
      type: 'string',
      description: 'Unique identifier of the feedback agent',
    },
    agentName: {
      type: 'string',
      description: 'Display name of the feedback agent',
    },
    agentType: {
      type: 'string',
      enum: ['pa', 'openclaw', 'developer_pa', 'human'],
    },
    overallRating: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
    },
    dimensions: {
      type: 'object',
      properties: {
        usability: { type: 'integer', minimum: 1, maximum: 5 },
        creativity: { type: 'integer', minimum: 1, maximum: 5 },
        responsiveness: { type: 'integer', minimum: 1, maximum: 5 },
        fun: { type: 'integer', minimum: 1, maximum: 5 },
        reliability: { type: 'integer', minimum: 1, maximum: 5 },
      },
      additionalProperties: false,
    },
    summary: {
      type: 'string',
      maxLength: 200,
    },
    details: {
      type: 'string',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendation: {
      type: 'string',
      enum: ['strongly_recommend', 'recommend', 'neutral', 'not_recommend'],
    },
  },
  additionalProperties: false,
} as const

const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(feedbackSchema)

export interface FeedbackPayload {
  targetClientId: string
  agentId: string
  agentName: string
  agentType: 'pa' | 'openclaw' | 'developer_pa' | 'human'
  overallRating: number
  summary: string
  dimensions?: {
    usability?: number
    creativity?: number
    responsiveness?: number
    fun?: number
    reliability?: number
  }
  details?: string
  tags?: string[]
  recommendation?: 'strongly_recommend' | 'recommend' | 'neutral' | 'not_recommend'
}

export interface ValidationResult {
  valid: boolean
  errors: ErrorObject[] | null
}

export function validateFeedback(data: unknown): ValidationResult {
  const valid = validate(data)
  return {
    valid: valid as boolean,
    errors: valid ? null : (validate.errors ?? null),
  }
}
