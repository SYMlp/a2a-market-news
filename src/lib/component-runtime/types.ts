/**
 * ComponentSpec TypeScript types — mirroring the YAML structure.
 * Schema reference: specs/componentspec.schema.json
 *
 * Architecture: docs/component-spec-architecture.md (P7-1)
 */

// ─── Message template (bi-channel: pa for human, agent for API) ───

export type MessageTemplate = string | { pa: string; agent: string }

// ─── Transition rule (collect/awaitingClientId phase) ───

export interface TransitionRule {
  when: string
  goto?: string
  storeExtracted?: string
  setFlag?: string
  message?: MessageTemplate
  presentCard?: boolean
}

// ─── Extract config (effect-based extraction) ───

export interface ExtractConfig {
  effect: string
  inputField?: string
  outputFields?: string[]
  fallback?: string
}

// ─── Precondition (before executing effect) ───

export interface Precondition {
  check: string
  errorStatus?: number
  errorMessage?: string
}

// ─── Lifecycle ───

export interface LifecycleValidationGate {
  before: string
  effect: string
  onInvalid?: 'retry' | 'abort'
}

/** Cancel/keyword trigger: patterns to match in user message, action to execute */
export interface LifecycleOnKeyword {
  patterns: string[]
  action: string
}

/** Named delays in ms for timeout transitions */
export interface LifecycleDelays {
  confirmTimeout?: number
  processTimeout?: number
  [key: string]: number | undefined
}

export interface Lifecycle {
  steps: string[]
  initial: string
  validationGate?: LifecycleValidationGate
  /** Cancel keyword detection — matches user message, triggers action (e.g. cancel) */
  onKeyword?: LifecycleOnKeyword
  /** Named delays in ms — used for timeout transitions (e.g. confirmTimeout: 60000) */
  delays?: LifecycleDelays
  /** Action to run on scene change (e.g. cancel) */
  onSceneChange?: string
}

// ─── Data source (collect phase) ───

export interface DataSource {
  primary?: string
  fallback?: string
  filter?: string
}

// ─── Collect phase config ───

export interface CollectResolveFromMessage {
  patterns?: Record<string, string>
  defaultIfSingle?: boolean
}

export interface CollectExtractFromMessage {
  patterns?: Record<string, string>
}

export interface CollectClientIdResolution {
  sources?: string[]
}

export interface CollectExtractStatusIntent {
  inactive?: string
  archived?: string
}

export interface CollectTransitionToConfirm {
  when?: string
  presentCard?: boolean
}

export interface Collect {
  emptyMessage?: MessageTemplate
  singleAppAutoSelect?: boolean
  resolveFromMessage?: CollectResolveFromMessage
  extractFromMessage?: CollectExtractFromMessage
  extract?: ExtractConfig
  clientIdResolution?: CollectClientIdResolution
  transitions?: TransitionRule[]
  extractStatusIntent?: CollectExtractStatusIntent
  preferenceMapping?: Record<string, string>
  transitionToConfirm?: CollectTransitionToConfirm
  followUpMessage?: Record<string, string>
}

// ─── AwaitingClientId phase (register multi-step) ───

export interface AwaitingClientId {
  extract?: ExtractConfig
  transitions?: TransitionRule[]
}

// ─── Validation gate (between collect and confirm) ───

export interface ValidationGateOnValid {
  mergeExtracted?: Record<string, string>
  goto?: string
  message?: MessageTemplate
  presentCard?: boolean
}

export interface ValidationGateOnInvalid {
  message?: MessageTemplate
  stay?: boolean
}

export interface ValidationGate {
  effect: string
  inputs?: Record<string, string>
  onValid?: ValidationGateOnValid
  onInvalid?: ValidationGateOnInvalid
}

// ─── Confirm action: params schema ───

export interface ParamSchema {
  type?: string
  required?: boolean
  description?: string
  properties?: Record<string, unknown>
  enum?: string[]
}

// ─── Post-effect (run after primary effect succeeds) ───

export interface PostEffectItem {
  effect: string
  args?: Record<string, unknown>
}

// ─── Confirm action config ───

export interface ConfirmOnSuccess {
  clearSubFlow?: boolean
  message?: MessageTemplate
  returnExtra?: Record<string, string>
}

export interface ConfirmOnError {
  message?: MessageTemplate
  errorStatus?: number
}

export interface ConfirmAction {
  params: Record<string, ParamSchema>
  effect: string
  effectArgs?: Record<string, unknown>
  ownershipCheck?: string
  validation?: string[]
  preconditions?: Precondition[]
  postEffect?: PostEffectItem[]
  onSuccess?: ConfirmOnSuccess
  onError?: ConfirmOnError
}

// ─── Actions ───

export interface Actions {
  confirm: ConfirmAction
}

// ─── Display state (SpecFormCard) ───

export interface FieldOption {
  value: string
  label: string
}

export interface FieldXUi {
  editable?: boolean
  pillLayout?: boolean
  monospace?: boolean
}

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'url' | 'select' | 'readOnly'
  placeholder?: string
  default?: string
  options?: FieldOption[]
  statusLabels?: Record<string, string>
  'x-ui'?: FieldXUi
}

export interface StateDisplay {
  header?: string
  confirmLabel?: string
  confirmLabelPrefix?: string
  hint?: string
}

export interface State {
  display?: StateDisplay
  fields?: FieldDef[]
}

// ─── Visibility (agent export) ───

export interface VisibilityAgent {
  export?: boolean
}

export interface Visibility {
  agent?: VisibilityAgent
}

// ─── Root ComponentSpec ───

export type ComponentSpecId = 'app_settings' | 'profile' | 'app_lifecycle' | 'register'

export interface ComponentSpec {
  id: ComponentSpecId
  functionCall: string
  lifecycle: Lifecycle
  dataSource?: DataSource
  collect?: Collect
  awaitingClientId?: AwaitingClientId
  validationGate?: ValidationGate
  actions: Actions
  state?: State
  visibility?: Visibility
}
