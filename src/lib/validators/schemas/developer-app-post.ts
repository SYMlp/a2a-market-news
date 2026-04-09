/** POST /api/developer/apps — register a new app */
export const developerAppPostSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['name', 'description', 'circleType'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    circleType: { type: 'string', minLength: 1 },
    website: { type: 'string' },
    logo: { type: 'string' },
    clientId: { type: 'string' },
    persona: {},
    metadata: {},
    shortPrompt: { type: 'string' },
    detailedPrompt: { type: 'string' },
    systemSummary: { type: 'string' },
  },
  additionalProperties: true,
} as const
