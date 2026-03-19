'use client'

import { useState, useEffect } from 'react'
import type { ComponentSpec, FieldDef } from '@/lib/component-runtime/types'

export type SpecFormCardStatus = 'pending' | 'executing' | 'done'

interface SpecFormCardProps {
  spec: ComponentSpec
  args: Record<string, unknown>
  status: SpecFormCardStatus
  accentRgb: string
  onConfirm: (args: Record<string, unknown>) => void
  onCancel: () => void
}

/** Get field value from args. Values may be in args.changes (app_settings, profile) or args directly. */
function getFieldValue(args: Record<string, unknown>, key: string): string {
  const changes = args.changes as Record<string, string> | undefined
  if (changes && key in changes) return String(changes[key] ?? '')
  const v = args[key]
  return v != null ? String(v) : ''
}

/** Check if confirm params expect a "changes" object for this field. */
function isChangesField(spec: ComponentSpec, key: string): boolean {
  const params = spec.actions.confirm.params
  const changesSchema = params.changes
  if (!changesSchema || changesSchema.type !== 'object') return false
  const props = changesSchema.properties as Record<string, unknown> | undefined
  return props ? key in props : false
}

/** Build confirm payload from form state and initial args. */
function buildConfirmPayload(
  spec: ComponentSpec,
  initialArgs: Record<string, unknown>,
  formValues: Record<string, string>
): Record<string, unknown> {
  const params = spec.actions.confirm.params
  const hasChanges = params.changes && params.changes.type === 'object'
  const hasEditableFields = spec.state?.fields?.some(
    f => f['x-ui']?.editable !== false
  )

  if (!hasEditableFields) {
    return { ...initialArgs }
  }

  const payload: Record<string, unknown> = {}

  if (hasChanges) {
    const changes: Record<string, string> = {}
    for (const [key, val] of Object.entries(formValues)) {
      if (isChangesField(spec, key)) changes[key] = val
    }
    payload.changes = changes
  }

  for (const paramKey of Object.keys(params)) {
    if (paramKey === 'changes') continue
    const fromArgs = initialArgs[paramKey]
    const fromForm = formValues[paramKey]
    payload[paramKey] =
      fromForm !== undefined && fromForm !== ''
        ? fromForm
        : fromArgs
  }

  return payload
}

export default function SpecFormCard({
  spec,
  args: initialArgs,
  status,
  accentRgb,
  onConfirm,
  onCancel,
}: SpecFormCardProps) {
  const display = spec.state?.display
  const fields = spec.state?.fields ?? []
  const editable = status === 'pending'

  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of fields) {
      initial[f.key] = getFieldValue(initialArgs, f.key)
    }
    return initial
  })

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const f of fields) {
      next[f.key] = getFieldValue(initialArgs, f.key)
    }
    setFormValues(prev => {
      let changed = false
      for (const k of Object.keys(next)) {
        if (prev[k] !== next[k]) {
          changed = true
          break
        }
      }
      return changed ? next : prev
    })
  }, [initialArgs, fields])

  const update = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
  }

  const borderColor =
    status === 'done'
      ? 'border-green-400/60'
      : status === 'executing'
        ? 'border-amber-400/60'
        : 'border-white/20'

  const dotColor =
    status === 'done'
      ? 'bg-green-400'
      : status === 'executing'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-white/60'

  const header = display?.header ?? spec.functionCall
  const confirmLabel =
    display?.confirmLabel ??
    (display?.confirmLabelPrefix
      ? `${display.confirmLabelPrefix}${getStatusLabel(spec, formValues)}`
      : '确认')
  const hint = display?.hint

  const isConfirmDisabled = (): boolean => {
    const params = spec.actions.confirm.params
    if (params.changes && params.changes.type === 'object') {
      const changes = Object.keys(formValues).filter(k => isChangesField(spec, k))
      const hasAny = changes.some(k => formValues[k]?.trim())
      if (!hasAny) return true
    }
    const fieldKeys = new Set(fields.map(f => f.key))
    const required = Object.entries(params).filter(
      ([k, s]) => s.required && s.type !== 'object' && fieldKeys.has(k)
    )
    for (const [k] of required) {
      if (!formValues[k]?.trim()) return true
    }
    return false
  }

  const handleConfirm = () => {
    const payload = buildConfirmPayload(spec, initialArgs, formValues)
    onConfirm(payload)
  }

  return (
    <div
      className={`register-card rounded-2xl border backdrop-blur-md overflow-hidden text-xs ${borderColor}`}
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb},0.12), rgba(0,0,0,0.4))`,
        boxShadow: `0 8px 32px rgba(${accentRgb},0.15)`,
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b border-white/10"
        style={{ background: `rgba(${accentRgb},0.1)` }}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <code className="text-white/70 font-mono text-[11px]">
            {header}
            {status === 'done' && (
              <span className="text-green-400 ml-2 font-sans">
                {spec.id === 'register' ? '✓ 已录入' : '✓ 已更新'}
              </span>
            )}
            {status === 'executing' && (
              <span className="text-amber-300 ml-2 font-sans">
                {spec.id === 'register' ? '录入中...' : '更新中...'}
              </span>
            )}
          </code>
        </div>
        {editable && (
          <button
            onClick={onCancel}
            className="text-white/40 hover:text-white/80 text-sm transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-4 py-3.5 space-y-3">
        {fields.map(f => (
          <FieldRow key={f.key} label={f.label}>
            <FieldControl
              field={f}
              value={formValues[f.key] ?? ''}
              editable={editable && (f['x-ui']?.editable ?? true)}
              onChange={(v) => update(f.key, v)}
            />
          </FieldRow>
        ))}
      </div>

      {status === 'pending' && (
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all
              disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.8), rgba(${accentRgb},0.5))`,
              boxShadow: `0 4px 12px rgba(${accentRgb},0.3)`,
            }}
          >
            {confirmLabel}
          </button>
          {hint && (
            <p className="text-center text-[10px] text-white/30 mt-2">{hint}</p>
          )}
        </div>
      )}
    </div>
  )
}

function getStatusLabel(spec: ComponentSpec, formValues: Record<string, string>): string {
  const statusField = spec.state?.fields?.find(
    f => f.type === 'readOnly' && f.statusLabels
  )
  if (!statusField?.statusLabels) return ''
  const val = formValues[statusField.key]
  return statusField.statusLabels[val] ?? val ?? ''
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-white/40 text-[11px] w-16 shrink-0 pt-1.5">{label}</span>
      {children}
    </div>
  )
}

function FieldControl({
  field,
  value,
  editable,
  onChange,
}: {
  field: FieldDef
  value: string
  editable: boolean
  onChange: (v: string) => void
}) {
  const xui = field['x-ui']
  const monospace = xui?.monospace
  const pillLayout = xui?.pillLayout

  if (field.type === 'readOnly') {
    const label =
      field.statusLabels?.[value] ?? value ?? '-'
    return (
      <span className={`text-white text-sm ${monospace ? 'font-mono' : ''}`}>
        {label}
      </span>
    )
  }

  if (field.type === 'select' && field.options) {
    if (editable && pillLayout) {
      return (
        <div className="flex gap-2 flex-wrap">
          {field.options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                (value || field.default) === opt.value
                  ? 'bg-white/20 border-white/40 text-white border shadow-sm'
                  : 'bg-black/20 border border-white/10 text-white/50 hover:border-white/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    }
    if (editable) {
      return (
        <select
          value={value || field.default}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-lg text-white text-sm
            focus:border-white/40 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all"
        >
          {field.options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }
    const opt = field.options.find(o => o.value === (value || field.default))
    return (
      <span className="text-white text-sm">
        {opt?.label ?? value ?? '-'}
      </span>
    )
  }

  if ((field.type === 'text' || field.type === 'url') && editable) {
    return (
      <input
        type={field.type === 'url' ? 'url' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`flex-1 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-lg text-white text-sm
          placeholder:text-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all
          ${monospace ? 'font-mono text-[11px]' : ''}`}
        placeholder={field.placeholder}
      />
    )
  }

  if ((field.type === 'text' || field.type === 'url') && !editable) {
    return (
      <code
        className={`text-white/70 text-[11px] bg-black/20 px-2 py-1 rounded break-all ${
          monospace ? 'font-mono' : ''
        }`}
      >
        {value || '-'}
      </code>
    )
  }

  return <span className="text-white text-sm">{value || '-'}</span>
}
