const roles = new Set(['manager', 'po', 'dev_back', 'dev_front', 'qa'])
const actions = new Set(['work', 'test', 'talk', 'break'])

export function isAgentActionEvent(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === 3 && value.type === 'agent-action' &&
    roles.has(value.role) && actions.has(value.action)
}
