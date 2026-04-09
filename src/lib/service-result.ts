/**
 * Shared discriminated union for domain services (thin routes + testable lib).
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

export function err<T = never>(error: string, status: number): ServiceResult<T> {
  return { ok: false, error, status }
}
