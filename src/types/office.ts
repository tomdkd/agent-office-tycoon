export type AgentRole = 'manager' | 'po' | 'dev_back' | 'dev_front' | 'qa'

export type AgentState =
  | 'idle'
  | 'walking'
  | 'break'
  | 'working'
  | 'talking'
  | 'testing'
  | 'success'

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  idle: 'Disponible',
  walking: 'En route',
  break: 'En pause',
  working: 'Au travail',
  talking: 'Discussion',
  testing: 'Tests',
  success: 'Succès !',
}

export interface OfficePosition {
  x: number
  y: number
}

export interface AgentInfo {
  role: AgentRole
  name: string
  color: number
  state: AgentState
  desk: OfficePosition
}

export interface AgentSelectedEvent {
  agent: AgentInfo
}

export interface AgentStateChangedEvent {
  agent: AgentInfo
  previousState: AgentState
}

export interface WorkCycleStepEvent {
  message: string
}

export interface WorkCycleCompletedEvent {
  success: true
}

export interface OfficeErrorEvent {
  message: string
}

export interface OfficeEventMap {
  'agent-selected': AgentSelectedEvent
  'agent-state-changed': AgentStateChangedEvent
  'work-cycle-step': WorkCycleStepEvent
  'work-cycle-completed': WorkCycleCompletedEvent
  'work-cycle-ready': undefined
  'office-error': OfficeErrorEvent
}
