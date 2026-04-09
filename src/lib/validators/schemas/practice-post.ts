import { VALID_CATEGORIES } from '@/lib/practices'

/** POST /api/practices — create developer practice */
export const practicePostSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['title', 'content', 'summary', 'category', 'tags'],
  properties: {
    title: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    category: { type: 'string', enum: [...VALID_CATEGORIES] },
    tags: { type: 'array', items: { type: 'string' } },
    keySteps: { type: 'array', items: { type: 'string' } },
    applicableTo: { type: 'string' },
    status: { type: 'string', enum: ['draft', 'published'] },
  },
  additionalProperties: true,
} as const
