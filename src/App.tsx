import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Phaser from 'phaser'
import { ArrowRight, BriefcaseBusiness, MessageCircle, Play, Sparkles, X } from 'lucide-react'
import { OfficeScene } from './game/OfficeScene'
import { AGENT_STATE_LABELS } from './types/office'
import { isAgentActionEvent } from './shared/agentEvent.mjs'
import type { AgentInfo, AgentRole, AgentSelectedEvent, AgentStateChangedEvent, OfficeErrorEvent } from './types/office'

const ROLE_LABELS: Record<AgentRole, string> = {
  manager: 'Manager',
  po: 'Product Owner',
  dev_back: 'Développeur back-end',
  dev_front: 'Développeur front-end',
  qa: 'Assurance qualité',
}

interface ManagerDialogProps {
  onClose: () => void
  onStart: () => void
}

function ManagerDialog({ onClose, onStart }: ManagerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [message, setMessage] = useState('')
  const [submittedMessage, setSubmittedMessage] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    dialog?.querySelector('textarea')?.focus()
    return () => dialog?.close()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = message.trim()
    if (trimmed) setSubmittedMessage(trimmed)
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(100%-2rem,30rem)] rounded-3xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-300">
              <MessageCircle size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-rose-300 uppercase">Discussion</p>
              <h2 id="dialog-title" className="mt-1 text-xl font-bold">Parler au Manager</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/70 p-4 text-sm leading-6 text-slate-200">
          <p className="mb-1 text-xs font-bold tracking-wide text-rose-300 uppercase">Manager</p>
          {submittedMessage
            ? 'Bien reçu ! Je vais transmettre votre demande à l’équipe. Prêt à lancer le cycle ?'
            : 'Bonjour ! Quel projet souhaitez-vous confier à notre équipe ?'}
        </div>

        {submittedMessage ? (
          <div className="mt-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Votre demande</p>
            <p className="mt-2 max-h-32 overflow-y-auto rounded-xl bg-slate-950/60 p-3 text-sm break-words whitespace-pre-wrap text-slate-200">{submittedMessage}</p>
            <p className="mt-3 text-xs leading-5 text-slate-400">Réponse prédéfinie : le cycle illustre un scénario de travail et ne traite pas encore votre demande.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setSubmittedMessage('')} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-400">Modifier</button>
              <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400">
                Valider et lancer <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5">
            <label htmlFor="manager-message" className="text-sm font-semibold text-slate-200">Votre message</label>
            <textarea
              id="manager-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Décrivez votre idée..."
              maxLength={1000}
              rows={4}
              autoFocus
              required
              className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
            />
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={!message.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
                Envoyer <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}

function App() {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const cycleRunningRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [cycleRunning, setCycleRunning] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [liveLog, setLiveLog] = useState('Le studio se prépare à accueillir son équipe.')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const parent = gameContainerRef.current
    if (!parent) return

    let disposed = false
    const onAgentSelected = ({ agent }: AgentSelectedEvent) => {
      if (agent.role === 'manager') {
        if (!cycleRunningRef.current) {
          setSelectedAgent(null)
          setDialogOpen(true)
        }
      } else {
        setSelectedAgent(agent)
      }
    }
    const onAgentStateChanged = ({ agent }: AgentStateChangedEvent) => {
      setSelectedAgent((selected) => selected?.role === agent.role ? agent : selected)
    }
    const onCycleReady = () => {
      cycleRunningRef.current = false
      setCycleRunning(false)
    }
    const onOfficeError = ({ message }: OfficeErrorEvent) => {
      cycleRunningRef.current = false
      setCycleRunning(false)
      setLiveLog(message)
    }

    class ReactOfficeScene extends OfficeScene {
      create(): void {
        super.create()
        if (disposed) return
        this.events.on('agent-selected', onAgentSelected)
        this.events.on('agent-state-changed', onAgentStateChanged)
        this.events.on('work-cycle-ready', onCycleReady)
        this.events.on('office-error', onOfficeError)
        sceneRef.current = this
        setReady(true)
        setLiveLog('L’équipe est prête. À vous de jouer !')
      }
    }

    const scene = new ReactOfficeScene()
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: 800,
      height: 600,
      pixelArt: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
    })

    // The HUD can move the canvas without a resize, invalidating Phaser's input bounds.
    const updateCanvasBounds = () => game.scale.updateBounds()
    parent.addEventListener('mousemove', updateCanvasBounds, true)
    parent.addEventListener('mousedown', updateCanvasBounds, true)
    parent.addEventListener('touchstart', updateCanvasBounds, true)

    return () => {
      disposed = true
      parent.removeEventListener('mousemove', updateCanvasBounds, true)
      parent.removeEventListener('mousedown', updateCanvasBounds, true)
      parent.removeEventListener('touchstart', updateCanvasBounds, true)
      scene.events?.off('agent-selected', onAgentSelected)
      scene.events?.off('agent-state-changed', onAgentStateChanged)
      scene.events?.off('work-cycle-ready', onCycleReady)
      scene.events?.off('office-error', onOfficeError)
      sceneRef.current = null
      cycleRunningRef.current = false
      game.destroy(true)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let disposed = false
    let socket: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let retryDelay = 2000
    let warned = false
    const connect = () => {
      const url = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`
      try {
        socket = new WebSocket(url)
      } catch (error) {
        console.error('Configuration WebSocket invalide :', error)
        setLiveLog('URL WebSocket invalide : le mode local reste disponible.')
        return
      }
      socket.onopen = () => {
        if (!disposed) {
          setConnected(true)
          retryDelay = 2000
          warned = false
        }
      }
      socket.onmessage = (message) => {
        try {
          const event: unknown = JSON.parse(String(message.data))
          if (!isAgentActionEvent(event)) {
            console.warn('Événement WebSocket invalide', event)
            return
          }
          const scene = sceneRef.current
          if (!scene) {
            console.warn('Événement reçu alors que la scène est indisponible', event)
            return
          }
          scene.applyAgentAction(event)
          setLiveLog(`Action externe : ${event.role} — ${event.action}.`)
        } catch (error) {
          console.error('Événement WebSocket impossible à traiter :', error)
          setLiveLog('Impossible de traiter un événement WebSocket.')
        }
      }
      socket.onerror = () => {
        if (!disposed && !warned) {
          console.warn('Connexion WebSocket indisponible.')
          warned = true
        }
      }
      socket.onclose = () => {
        if (!disposed) {
          setConnected(false)
          retry = setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30000)
        }
      }
    }
    connect()
    return () => {
      disposed = true
      if (retry) clearTimeout(retry)
      socket?.close()
    }
  }, [ready])

  function startCycle() {
    const scene = sceneRef.current
    if (!scene || cycleRunningRef.current) {
      setLiveLog(scene ? 'Un cycle est déjà en cours.' : 'Le studio n’est pas encore prêt.')
      return
    }
    cycleRunningRef.current = true
    setCycleRunning(true)
    setLiveLog('L’équipe rejoint ses postes...')
    try {
      scene.simulateWorkCycle(setLiveLog)
      setDialogOpen(false)
    } catch (error) {
      cycleRunningRef.current = false
      setCycleRunning(false)
      const detail = error instanceof Error ? error.message : String(error)
      setLiveLog(`Impossible de démarrer le cycle : ${detail}`)
    }
  }

  const controlsDisabled = !ready || cycleRunning

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"><BriefcaseBusiness size={21} aria-hidden="true" /></div>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-indigo-300 uppercase">Votre studio virtuel</p>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">AI Office Tycoon</h1>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 sm:max-w-md">
            <span className="relative flex size-2.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" /><span className="relative size-2.5 rounded-full bg-emerald-400" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">En direct</p>
              <p role="status" aria-live="polite" className="text-sm text-slate-200">{liveLog}</p>
              <p role="status" className="mt-1 text-xs text-slate-400">{connected ? 'Connecté' : 'Mode Hors-ligne'}</p>
            </div>
          </div>
        </header>

        <section aria-label="Bureau virtuel" className="flex flex-1 flex-col items-center justify-center py-7">
          <div className="mb-4 flex w-full max-w-[800px] items-center justify-between gap-4">
            <div><p className="text-xs font-bold tracking-[0.18em] text-indigo-300 uppercase">Vue du studio</p><h2 className="mt-1 text-lg font-semibold">La vie au bureau</h2></div>
            <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-400">5 agents</span>
          </div>
          <div className="w-full max-w-[800px] overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-800 shadow-2xl shadow-black/30">
            <div ref={gameContainerRef} className="aspect-[4/3] w-full" aria-label="Bureau interactif : sélectionnez un agent pour obtenir des informations ou parler au Manager." />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">Astuce : cliquez sur un agent pour découvrir son rôle et son statut, ou sur le Manager pour lui parler.</p>
          {selectedAgent && (
            <aside aria-label="Informations sur l’agent" className="mt-4 w-full max-w-[800px] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: `#${selectedAgent.color.toString(16).padStart(6, '0')}` }} />
                  <div>
                    <h3 className="font-semibold">{selectedAgent.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">Rôle : {ROLE_LABELS[selectedAgent.role]}</p>
                    <p aria-live="polite" className="mt-1 text-sm text-slate-200">Statut : {AGENT_STATE_LABELS[selectedAgent.state]}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedAgent(null)} aria-label="Fermer la carte de l’agent" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"><X size={18} aria-hidden="true" /></button>
              </div>
            </aside>
          )}
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-amber-300" aria-hidden="true" /> À vous de décider</p><p className="mt-1 text-xs text-slate-400">Donnez une idée à l’équipe ou lancez une simulation.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" disabled={controlsDisabled} onClick={() => { setSelectedAgent(null); setDialogOpen(true) }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle size={17} aria-hidden="true" /> Parler au Manager</button>
            <button type="button" disabled={controlsDisabled} onClick={startCycle} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"><Play size={17} fill="currentColor" aria-hidden="true" /> Simuler un Cycle Complet</button>
          </div>
        </footer>
      </div>
      {dialogOpen && <ManagerDialog onClose={() => setDialogOpen(false)} onStart={startCycle} />}
    </main>
  )
}

export default App
