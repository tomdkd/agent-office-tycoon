const REQUEST_TIMEOUT_MS = 180_000

export async function sendManagerMessage(
  url: string,
  sessionId: string,
  message: string,
  signal: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string> {
  if (!url.trim()) throw new Error('VITE_MANAGER_WEBHOOK_URL est absente ou vide.')

  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Le webhook a répondu avec le statut HTTP ${response.status}.`)

    let data: unknown
    try {
      data = await response.json()
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new Error('La réponse du webhook n’est pas un JSON valide.', { cause: error })
    }
    if (typeof data !== 'object' || data === null || !('response' in data) || typeof data.response !== 'string') {
      throw new Error('La réponse du webhook doit contenir une propriété « response » textuelle.')
    }
    return data.response
  } catch (error) {
    if (timedOut) throw new Error(`Le webhook n’a pas répondu dans les ${timeoutMs / 1000} secondes.`, { cause: error })
    if (signal.aborted) throw error
    if (error instanceof TypeError) throw new Error(`Erreur réseau du webhook : ${error.message}`, { cause: error })
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}
