import { useCallback, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { ErrorToast } from './ErrorToast'
import { ManagerChat } from './ManagerChat'
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
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const showError = useCallback((message: string) => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message }))
  }, [])
  const closeToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    const parent = gameContainerRef.current
    if (!parent) return

    let disposed = false
    const onAgentSelected = ({ agent }: AgentSelectedEvent) => {
      if (agent.role === 'manager') {
        setSelectedAgent(null)
        setDialogOpen(true)
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
      width: parent.clientWidth,
      height: parent.clientHeight,
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE },
      scene,
    })

    return () => {
      disposed = true
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
    } catch (error) {
      cycleRunningRef.current = false
      setCycleRunning(false)
      const detail = error instanceof Error ? error.message : String(error)
      setLiveLog(`Impossible de démarrer le cycle : ${detail}`)
    }
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <div ref={gameContainerRef} className="fixed inset-0 h-full w-full" aria-label="Bureau interactif : sélectionnez un agent pour obtenir des informations ou parler au Manager." />

      <header className="pointer-events-none fixed inset-x-3 top-3 z-10 flex items-start justify-between gap-2 sm:inset-x-6 sm:top-6">
        <div className="pixel-panel pointer-events-auto flex items-center gap-3 p-2 sm:p-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center border-2 border-[#29303a] bg-[#c87355] text-2xl text-[#fff3ce]">▣</span>
          <div><p className="hidden text-lg leading-none text-[#92513c] sm:block">Votre studio virtuel</p><h1 className="pixel-title max-w-36 text-[9px] leading-4 sm:max-w-none sm:text-[11px]">AI Office Tycoon</h1></div>
        </div>
        <div className="pixel-panel pointer-events-auto max-w-[50%] px-3 py-1 sm:max-w-sm">
          <p role="status" aria-live="polite" className="text-lg leading-5 sm:text-xl">{liveLog}</p>
          <p role="status" className="text-lg leading-5 text-[#92513c]"><span aria-hidden="true">{connected ? '■ ' : '□ '}</span>{connected ? 'Connecté' : 'Mode Hors-ligne'}</p>
        </div>
      </header>

      {selectedAgent && (
        <aside aria-label="Informations sur l’agent" className="pixel-panel fixed top-24 left-3 z-20 w-[min(20rem,calc(100vw-1.5rem))] p-4 sm:left-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="size-4 shrink-0 border-2 border-[#29303a]" style={{ backgroundColor: `#${selectedAgent.color.toString(16).padStart(6, '0')}` }} />
              <div><h2 className="pixel-title text-[10px] leading-5">{selectedAgent.name}</h2><p className="mt-1 text-xl leading-5">Rôle : {ROLE_LABELS[selectedAgent.role]}</p><p aria-live="polite" className="mt-1 text-xl leading-5">Statut : {AGENT_STATE_LABELS[selectedAgent.state]}</p></div>
            </div>
            <button type="button" onClick={() => setSelectedAgent(null)} aria-label="Fermer la carte de l’agent" className="pixel-icon-button size-8 shrink-0 text-2xl leading-none"><span aria-hidden="true">×</span></button>
          </div>
        </aside>
      )}

      <div className="fixed bottom-3 left-3 z-20 flex max-w-[calc(100vw-1.5rem)] flex-wrap gap-2 sm:bottom-6 sm:left-6">
        <button type="button" disabled={!ready} onClick={() => { setSelectedAgent(null); setDialogOpen(true) }} className="pixel-button inline-flex items-center gap-2 px-3 py-2 text-xl leading-5"><span aria-hidden="true">▣</span> Parler au Manager</button>
        <button type="button" disabled={!ready || cycleRunning} onClick={startCycle} className="pixel-button inline-flex items-center gap-2 px-3 py-2 text-xl leading-5"><span aria-hidden="true">▶</span> Simuler un Cycle Complet</button>
      </div>

      <ManagerChat open={dialogOpen} onClose={() => setDialogOpen(false)} onError={showError} />
      {toast && <ErrorToast key={toast.id} message={toast.message} onClose={closeToast} />}
    </main>
  )
}

export default App
