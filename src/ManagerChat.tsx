import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { sendManagerMessage } from './managerWebhook'

const ISSUE_STATUS_DELAY_MS = 12_000

interface ChatMessage {
  role: 'user' | 'manager'
  text: string
}

interface ManagerChatProps {
  open: boolean
  onClose: () => void
  onError: (message: string) => void
}

export function ManagerChat({ open, onClose, onError }: ManagerChatProps) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingIssue, setCreatingIssue] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const issueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => {
    if (issueTimerRef.current !== null) clearTimeout(issueTimerRef.current)
    requestRef.current?.abort()
    requestRef.current = null
  }, [])

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, messages, loading, creatingIssue])

  function resetSession() {
    if (issueTimerRef.current !== null) clearTimeout(issueTimerRef.current)
    issueTimerRef.current = null
    requestRef.current?.abort()
    requestRef.current = null
    sessionIdRef.current = null
    setLoading(false)
    setCreatingIssue(false)
    setMessages([])
    setMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = message.trim()
    if (!text || requestRef.current) return

    try {
      if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()
    } catch {
      onError('Impossible de créer une session sécurisée pour le chat.')
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    setMessages((current) => [...current, { role: 'user', text }])
    setMessage('')
    setLoading(true)
    setCreatingIssue(false)
    const issueTimer = setTimeout(() => {
      if (requestRef.current === controller) setCreatingIssue(true)
    }, ISSUE_STATUS_DELAY_MS)
    issueTimerRef.current = issueTimer
    try {
      const response = await sendManagerMessage(
        import.meta.env.VITE_MANAGER_WEBHOOK_URL ?? '',
        sessionIdRef.current,
        text,
        controller.signal,
      )
      if (requestRef.current === controller) {
        setMessages((current) => [...current, { role: 'manager', text: response }])
      }
    } catch (error) {
      if (requestRef.current === controller) {
        onError(error instanceof Error ? error.message : `Erreur du webhook : ${String(error)}`)
      }
    } finally {
      clearTimeout(issueTimer)
      if (issueTimerRef.current === issueTimer) issueTimerRef.current = null
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
        setCreatingIssue(false)
      }
    }
  }

  if (!open) return null

  return (
    <section
      aria-labelledby="manager-chat-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      className="pixel-panel fixed right-3 bottom-3 z-30 flex h-[min(36rem,calc(100dvh-1.5rem))] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden sm:right-6 sm:bottom-6"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b-[3px] border-[#29303a] bg-[#d78a64] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center border-2 border-[#29303a] bg-[#f7e8c1] text-2xl">▣</span>
          <div>
            <p className="text-lg leading-4">Discussion</p>
            <h2 id="manager-chat-title" className="pixel-title mt-1 text-[9px] leading-4">Engineering Manager</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={resetSession} title="Nouvelle session" aria-label="Nouvelle session" className="pixel-icon-button size-8 text-2xl leading-none"><span aria-hidden="true">↻</span></button>
          <button type="button" onClick={onClose} aria-label="Fermer le chat" className="pixel-icon-button size-8 text-2xl leading-none"><span aria-hidden="true">×</span></button>
        </div>
      </header>

      <div role="log" aria-label="Conversation avec le Manager" aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-xl leading-6 text-[#66513d]">Bonjour ! Quel projet souhaitez-vous confier à notre équipe ?</p>}
        {messages.map((entry, index) => (
          <div key={index} className={`flex items-end gap-2 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {entry.role === 'manager' && <span aria-label="Engineering Manager" className="flex size-8 shrink-0 items-center justify-center border-2 border-[#29303a] bg-[#c87355] text-lg leading-none text-white">EM</span>}
            <p className={`max-w-[85%] border-2 border-[#29303a] px-3 py-2 text-xl leading-6 break-words whitespace-pre-wrap shadow-[3px_3px_0_#29303a] ${entry.role === 'user' ? 'bg-[#e8ad66]' : 'bg-[#fff8df]'}`}>{entry.text}</p>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2" role="status" aria-label={creatingIssue ? undefined : 'Le Manager écrit'}>
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center border-2 border-[#29303a] bg-[#c87355] text-lg leading-none text-white">EM</span>
            <span className="flex max-w-[85%] flex-wrap items-center gap-2 border-2 border-[#29303a] bg-[#fff8df] px-4 py-3 text-xl leading-6 shadow-[3px_3px_0_#29303a]">
              {creatingIssue && <span>Besoin prêt. Création de l'Issue en cours...</span>}
              <span aria-hidden="true" className="flex gap-1.5">
                <span className="pixel-dot size-1.5 bg-[#29303a]" />
                <span className="pixel-dot size-1.5 bg-[#29303a] [animation-delay:150ms]" />
                <span className="pixel-dot size-1.5 bg-[#29303a] [animation-delay:300ms]" />
              </span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t-[3px] border-[#29303a] p-3">
        <label htmlFor="manager-message" className="sr-only">Votre message</label>
        <textarea id="manager-message" value={message} onChange={(event) => setMessage(event.target.value)} disabled={loading} placeholder="Décrivez votre idée..." maxLength={1000} rows={2} required className="pixel-input w-full resize-none border-2 border-[#29303a] bg-[#fff8df] p-2 text-xl leading-6 text-[#29303a] placeholder:text-[#806b56] disabled:opacity-50" />
        <div className="mt-2 flex justify-end">
          <button type="submit" disabled={loading || !message.trim()} className="pixel-button inline-flex items-center gap-2 px-4 py-1 text-xl leading-6">Envoyer <span aria-hidden="true">▶</span></button>
        </div>
      </form>
    </section>
  )
}
