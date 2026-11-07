import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { createOfficeServer } from '../server/index.js'
import { isAgentActionEvent } from '../src/shared/agentEvent.mjs'

const { server, shutdown } = createOfficeServer(process.cwd())
let base

before(async () => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => shutdown())

test('health, static files and SPA fallback', async () => {
  const health = await fetch(`${base}/api/health`)
  assert.deepEqual(await health.json(), { status: 'ok' })
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await fetch(`${base}/src/main.tsx`)).status, 200)
  const compressed = await fetch(`${base}/src/App.tsx`, { headers: { 'accept-encoding': 'gzip' } })
  assert.equal(compressed.headers.get('content-encoding'), 'gzip')
  assert.equal((await fetch(`${base}/dashboard`)).status, 200)
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404)
  assert.equal((await fetch(`${base}/api/unknown`)).status, 404)
})

test('broadcasts valid events to all connected clients', async () => {
  const clients = [new WebSocket(base.replace('http:', 'ws:') + '/ws'), new WebSocket(base.replace('http:', 'ws:') + '/ws')]
  try {
    await Promise.all(clients.map((client) => once(client, 'open')))
    const messages = clients.map((client) => once(client, 'message'))
    const event = { type: 'agent-action', role: 'qa', action: 'test' }
    const response = await fetch(`${base}/api/events`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event),
    })
    assert.equal(response.status, 202)
    for (const [message] of await Promise.all(messages)) assert.deepEqual(JSON.parse(message.toString()), event)
  } finally {
    for (const client of clients) client.terminate()
  }
})

test('rejects invalid requests and accepts valid events without clients', async () => {
  const post = (body, contentType = 'application/json') => fetch(`${base}/api/events`, {
    method: 'POST', headers: { 'content-type': contentType }, body,
  })
  assert.equal((await post('{')).status, 400)
  assert.equal((await post('hello', 'text/plain')).status, 415)
  assert.equal((await post(JSON.stringify({ type: 'agent-action', role: 'qa', action: 'hack' }))).status, 400)
  assert.equal((await post(JSON.stringify({ type: 'agent-action', role: 'qa', action: 'test', extra: true }))).status, 400)
  assert.equal((await post(JSON.stringify({ payload: 'x'.repeat(9000) }))).status, 413)
  assert.equal((await post(JSON.stringify({ type: 'agent-action', role: 'manager', action: 'work' }))).status, 202)
})

test('protocol accepts only known roles and actions', () => {
  for (const role of ['manager', 'po', 'dev_back', 'dev_front', 'qa']) {
    for (const action of ['work', 'test', 'talk', 'break']) {
      assert.equal(isAgentActionEvent({ type: 'agent-action', role, action }), true)
    }
  }
  for (const invalid of [null, [], {}, { type: 'agent-action', role: 'other', action: 'work' }, { type: 'agent-action', role: 'qa', action: 42 }]) {
    assert.equal(isAgentActionEvent(invalid), false)
  }
})
