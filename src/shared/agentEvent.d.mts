import type { AgentRole } from '../types/office'

export type AgentAction = 'work' | 'test' | 'talk' | 'break'

export interface AgentActionEvent {
  type: 'agent-action'
  role: AgentRole
  action: AgentAction
}

export function isAgentActionEvent(value: unknown): value is AgentActionEvent
