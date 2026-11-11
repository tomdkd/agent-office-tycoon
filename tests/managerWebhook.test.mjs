import test from 'node:test'
import assert from 'node:assert/strict'
import { sendManagerMessage } from '../src/managerWebhook.ts'

test('envoie le contrat et extrait la réponse du Manager', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ response: 'Bonjour\néquipe' }))
  const result = await sendManagerMessage(' https://example.test/webhook ', 'session-1', 'Salut', new AbortController().signal)
  assert.equal(result, 'Bonjour\néquipe')
  const [url, options] = fetch.mock.calls[0].arguments
  assert.equal(url, 'https://example.test/webhook')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(options.body), { sessionId: 'session-1', message: 'Salut' })
})

test('signale la configuration absente, les erreurs HTTP et les réponses invalides', async (t) => {
  const signal = new AbortController().signal
  await assert.rejects(sendManagerMessage('  ', 'id', 'test', signal), /VITE_MANAGER_WEBHOOK_URL/)
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }))
  await assert.rejects(sendManagerMessage('/webhook', 'id', 'test', signal), /HTTP 500/)
  fetch.mock.mockImplementation(async () => new Response('pas du JSON'))
  await assert.rejects(sendManagerMessage('/webhook', 'id', 'test', signal), /JSON valide/)
  fetch.mock.mockImplementation(async () => Response.json({ response: 42 }))
  await assert.rejects(sendManagerMessage('/webhook', 'id', 'test', signal), /response.*textuelle/)
  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(sendManagerMessage('/webhook', 'id', 'test', signal), /Erreur réseau.*Failed to fetch/)
})

test('interrompt les requêtes expirées ou annulées', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
    else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  await assert.rejects(sendManagerMessage('/webhook', 'id', 'test', new AbortController().signal, 10), /0.01 secondes/)
  const controller = new AbortController()
  const pending = sendManagerMessage('/webhook', 'id', 'test', controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})

test('le timeout par défaut expire à 180 000 ms', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let aborted = false
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      aborted = true
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  }))
  const pending = sendManagerMessage('/webhook', 'id', 'test', new AbortController().signal)
  const rejection = assert.rejects(pending, /180 secondes/)
  t.mock.timers.tick(179_999)
  assert.equal(aborted, false)
  t.mock.timers.tick(1)
  assert.equal(aborted, true)
  await rejection
})
