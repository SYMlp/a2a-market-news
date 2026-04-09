import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'

const ajv = new Ajv({ allErrors: true, strict: false })

const compileCache = new Map<string, ValidateFunction>()

function schemaKey(schema: object): string {
  return JSON.stringify(schema)
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return '请求参数无效'
  return errors
    .map(e => {
      const path = e.instancePath || '(根)'
      return `${path} ${e.message ?? '无效'}`
    })
    .join('；')
}

/**
 * Validates JSON body against a JSON Schema (draft-07 compatible).
 * Returns a Chinese-friendly error line for API responses.
 */
export function parseJsonBody<T>(data: unknown, schema: object): { ok: true; data: T } | { ok: false; message: string } {
  const key = schemaKey(schema)
  let validate = compileCache.get(key)
  if (!validate) {
    validate = ajv.compile(schema)
    compileCache.set(key, validate)
  }
  if (validate(data)) {
    return { ok: true, data: data as T }
  }
  return { ok: false, message: `参数校验失败：${formatAjvErrors(validate.errors)}` }
}
