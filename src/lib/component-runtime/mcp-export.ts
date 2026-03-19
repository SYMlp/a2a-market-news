/**
 * MCP Export — generate MCP tool descriptors from ComponentSpec visibility.agent.export.
 *
 * Converts ComponentSpec actions.confirm.params to MCP inputSchema format.
 * Tools are exposed via tools/list for agent consumption.
 *
 * Architecture: docs/component-spec-architecture.md (P7-1)
 */

import { loadAllSpecs } from './parser'
import type { ComponentSpec, ParamSchema } from './types'

/** MCP tool descriptor (subset of MCP spec) */
export interface McpToolDescriptor {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Convert ComponentSpec actions.confirm.params to JSON Schema (MCP inputSchema format).
 */
function paramsToInputSchema(params: Record<string, ParamSchema>): McpToolDescriptor['inputSchema'] {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, schema] of Object.entries(params)) {
    const prop: Record<string, unknown> = { type: schema.type ?? 'string' }
    if (schema.description) prop.description = schema.description
    if (schema.properties) prop.properties = schema.properties
    if (schema.enum) prop.enum = schema.enum
    properties[key] = prop
    if (schema.required) required.push(key)
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

/**
 * Generate MCP tool name from ComponentSpec.
 * GM.updateAppSettings -> gm_update_app_settings
 */
function specToToolName(spec: ComponentSpec): string {
  const base = spec.functionCall.replace(/^GM\./, '')
  const snake = base.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  return `gm_${snake}`
}

/**
 * Generate tool description from ComponentSpec.
 */
function specToDescription(spec: ComponentSpec): string {
  const header = spec.state?.display?.header ?? spec.functionCall
  const hint = spec.state?.display?.hint
  return [header, hint].filter(Boolean).join('. ')
}

/**
 * Convert a single ComponentSpec to MCP tool descriptor (if visibility.agent.export is true).
 */
export function specToMcpTool(spec: ComponentSpec): McpToolDescriptor | null {
  if (!spec.visibility?.agent?.export) return null

  const params = spec.actions?.confirm?.params
  if (!params || typeof params !== 'object') return null

  return {
    name: specToToolName(spec),
    description: specToDescription(spec) || `Execute ${spec.functionCall}`,
    inputSchema: paramsToInputSchema(params),
  }
}

/**
 * Generate all MCP tool descriptors from ComponentSpecs with visibility.agent.export.
 */
export function getComponentSpecMcpTools(): McpToolDescriptor[] {
  const specs = loadAllSpecs()
  return specs
    .map(s => specToMcpTool(s))
    .filter((t): t is McpToolDescriptor => t != null)
}

/**
 * Reverse-lookup: find the ComponentSpec whose generated MCP tool name matches.
 * Returns the spec if it has visibility.agent.export, null otherwise.
 */
export function resolveSpecForTool(toolName: string): ComponentSpec | null {
  const specs = loadAllSpecs()
  return specs.find(s => s.visibility?.agent?.export && specToToolName(s) === toolName) ?? null
}
