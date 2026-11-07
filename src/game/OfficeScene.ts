import Phaser from 'phaser'
import { js as EasyStar } from 'easystarjs'
import { AGENT_STATE_LABELS } from '../types/office'
import {
  AGENT_DESKS,
  createCollisionGrid,
  FURNITURE,
  FURNITURE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  GRID_ORIGIN,
  gridToScreen,
  INTERACTION_POSITIONS,
  PARTITIONS,
  TILE_SIZE,
} from './officeLayout'
import type { Furniture, GridPosition } from './officeLayout'
import { addOfficeImage, addRoomImage, prepareOfficeTextures, preloadOfficeTextures } from './officeTextures'
import {
  AGENT_CLOTHING_COLORS,
  SPRITE_DIRECTIONS,
  agentFrame,
  createAgentTexture,
} from './proceduralSprites'
import type { SpriteDirection } from './proceduralSprites'
import type {
  AgentInfo,
  AgentRole,
  AgentState,
  OfficeEventMap,
} from '../types/office'

const OFFICE = {
  colors: {
    text: '#302c35',
    bubble: '#ffffff',
  },
  timing: {
    breakMin: 5000,
    breakMax: 14000,
    breakDurationMin: 2500,
    breakDurationMax: 5000,
    moveSpeed: 110,
    work: 2200,
    conversation: 1800,
    development: 3000,
    testing: 2200,
    success: 1500,
  },
} as const

const AGENTS: ReadonlyArray<Omit<AgentInfo, 'state'>> = [
  { role: 'manager', name: 'Manager', color: AGENT_CLOTHING_COLORS.manager, desk: gridToScreen(AGENT_DESKS.manager.col, AGENT_DESKS.manager.row) },
  { role: 'po', name: 'PO', color: AGENT_CLOTHING_COLORS.po, desk: gridToScreen(AGENT_DESKS.po.col, AGENT_DESKS.po.row) },
  { role: 'dev_back', name: 'Dev Back', color: AGENT_CLOTHING_COLORS.dev_back, desk: gridToScreen(AGENT_DESKS.dev_back.col, AGENT_DESKS.dev_back.row) },
  { role: 'dev_front', name: 'Dev Front', color: AGENT_CLOTHING_COLORS.dev_front, desk: gridToScreen(AGENT_DESKS.dev_front.col, AGENT_DESKS.dev_front.row) },
  { role: 'qa', name: 'QA', color: AGENT_CLOTHING_COLORS.qa, desk: gridToScreen(AGENT_DESKS.qa.col, AGENT_DESKS.qa.row) },
]

const TRANSITIONS: Record<AgentState, readonly AgentState[]> = {
  idle: ['walking', 'working', 'talking', 'testing', 'success'],
  walking: ['idle', 'break', 'talking'],
  break: ['walking', 'idle'],
  working: ['idle', 'walking'],
  talking: ['idle', 'walking'],
  testing: ['idle', 'success'],
  success: ['idle'],
}

interface AgentRuntime {
  info: AgentInfo
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  direction: SpriteDirection
  tile: GridPosition
  movementVersion: number
  status: Phaser.GameObjects.Text
  nextBreakAt: number
  breakEndsAt: number
  movement?: Phaser.Tweens.Tween
}

/**
 * Canvas-only office scene. React can subscribe to OfficeEventMap events on
 * scene.events and launch a cycle through simulateWorkCycle.
 */
export class OfficeScene extends Phaser.Scene {
  private readonly agents = new Map<AgentRole, AgentRuntime>()
  private readonly timers = new Set<Phaser.Time.TimerEvent>()
  private readonly pathfinder = new EasyStar()
  private readonly collisionGrid = createCollisionGrid()
  private cycleRunning = false

  constructor() {
    super({ key: 'OfficeScene' })
  }

  preload(): void {
    preloadOfficeTextures(this)
  }

  create(): void {
    this.pathfinder.setGrid(this.collisionGrid)
    this.pathfinder.setAcceptableTiles([0])
    this.pathfinder.enableSync()
    this.pathfinder.setIterationsPerCalculation(GRID_COLS * GRID_ROWS * 4)
    prepareOfficeTextures(this)
    this.drawOffice()
    for (const definition of AGENTS) {
      this.createAgentAnimations(definition.role)
      this.createAgent(definition)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this)
  }

  update(time: number): void {
    for (const agent of this.agents.values()) {
      agent.container.setDepth(agent.container.y)
    }
    if (this.cycleRunning) return

    for (const agent of this.agents.values()) {
      if (agent.info.state === 'idle' && time >= agent.nextBreakAt) {
        const destination = Phaser.Math.RND.pick([
          INTERACTION_POSITIONS.coffee,
          INTERACTION_POSITIONS.pingpong,
        ])
        this.moveAgent(agent, destination, () => {
          this.setState(agent, 'break')
          agent.breakEndsAt = this.time.now + Phaser.Math.Between(
            OFFICE.timing.breakDurationMin,
            OFFICE.timing.breakDurationMax,
          )
        })
      } else if (agent.info.state === 'break' && time >= agent.breakEndsAt) {
        this.moveAgent(agent, AGENT_DESKS[agent.info.role], () => {
          this.setState(agent, 'idle')
          this.scheduleBreak(agent)
        })
      }
    }
  }

  public simulateWorkCycle(onStepUpdate: (msg: string) => void): void {
    if (!this.sys.isActive()) throw new Error('OfficeScene is not active')
    if (this.cycleRunning) throw new Error('A work cycle is already running')
    this.cycleRunning = true

    const manager = this.getAgent('manager')
    const po = this.getAgent('po')
    const back = this.getAgent('dev_back')
    const front = this.getAgent('dev_front')
    const qa = this.getAgent('qa')

    const report = (message: string): void => {
      this.emitOfficeEvent('work-cycle-step', { message })
      onStepUpdate(message)
    }

    this.returnAgentsToDesks(() => {
      this.setState(manager, 'working')
      report('Le manager prépare la demande.')
      this.after(OFFICE.timing.work, () => {
        this.moveAgent(manager, INTERACTION_POSITIONS.po, () => {
          this.setState(manager, 'talking')
          this.setState(po, 'talking')
          report('Le manager échange avec le PO.')
          this.after(OFFICE.timing.conversation, () => {
            this.setState(po, 'idle')
            this.moveAgent(manager, AGENT_DESKS.manager, () => {
              this.setState(manager, 'idle')
              this.setState(back, 'working')
              this.setState(front, 'working')
              report('Les développeurs codent.')
              this.after(OFFICE.timing.development, () => {
                this.setState(back, 'idle')
                this.setState(front, 'idle')
                this.setState(qa, 'testing')
                report('La QA teste le résultat.')
                this.after(OFFICE.timing.testing, () => {
                  this.setState(qa, 'success')
                  report('Succès : le travail est terminé !')
                  this.emitOfficeEvent('work-cycle-completed', { success: true })
                  this.after(OFFICE.timing.success, () => {
                    this.setState(qa, 'idle')
                    for (const agent of this.agents.values()) this.scheduleBreak(agent)
                    this.cycleRunning = false
                    this.emitOfficeEvent('work-cycle-ready', undefined)
                  })
                })
              })
            })
          })
        })
      })
    })
  }

  private drawOffice(): void {
    this.cameras.main.setBackgroundColor('#263745')
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const { x, y } = gridToScreen(col, row)
        addRoomImage(this, x, y, 'floor')
          .setOrigin(0.5, 1).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(-1000)
      }
    }
    for (let col = 0; col < GRID_COLS; col += 1) {
      const { x } = gridToScreen(col, 0)
      addRoomImage(this, x, GRID_ORIGIN.y, 'wall')
        .setOrigin(0.5, 1).setDisplaySize(TILE_SIZE, 64).setDepth(-999)
    }
    for (const col of [8, 15, 20]) {
      const { x } = gridToScreen(col, 0)
      addOfficeImage(this, x, GRID_ORIGIN.y - 5, 'window')
        .setOrigin(0.5, 1).setDisplaySize(48, 48).setDepth(-998)
    }
    for (const tile of PARTITIONS) {
      const { x, y } = gridToScreen(tile.col, tile.row)
      addRoomImage(this, x, y, 'wall')
        .setOrigin(0.5, 1).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(y)
    }
    for (const furniture of FURNITURE) this.drawFurniture(furniture)
    for (const position of Object.values(AGENT_DESKS)) {
      const { x, y } = gridToScreen(position.col, position.row)
      addOfficeImage(this, x, y, 'chair')
        .setOrigin(0.5, 1).setDisplaySize(19, 26).setDepth(y - 1)
    }
  }

  private drawFurniture(furniture: Furniture): void {
    const sizes: Record<Furniture['kind'], readonly [number, number]> = {
      desk: [64, 48], pingpong: [96, 64], couch: [64, 48], plant: [30, 48],
      server: [27, 54], kanban: [45, 40], coffee: [25, 46], water: [24, 40],
    }
    const [width, height] = sizes[furniture.kind]
    const size = FURNITURE_SIZE[furniture.kind]
    const { x, y } = gridToScreen(furniture.col, furniture.row + size.rows - 1)
    addOfficeImage(this, x + (size.cols - 1) * TILE_SIZE / 2, y, furniture.kind)
      .setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(y)
  }

  private createAgentAnimations(role: AgentRole): void {
    const key = createAgentTexture(this, role)
    for (const direction of SPRITE_DIRECTIONS) {
      const walkKey = `walk_${role}_${direction}`
      const idleKey = `idle_${role}_${direction}`
      if (!this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: [0, 1, 2, 1].map((pose) => ({ key, frame: agentFrame(direction, pose) })),
          frameRate: 8,
          repeat: -1,
        })
      }
      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          frames: [{ key, frame: agentFrame(direction, 1) }],
          frameRate: 1,
        })
      }
    }
  }

  private createAgent(definition: Omit<AgentInfo, 'state'>): void {
    const info: AgentInfo = { ...definition, desk: { ...definition.desk }, state: 'idle' }
    const sprite = this.add.sprite(0, 0, createAgentTexture(this, info.role), agentFrame('down', 1))
      .setOrigin(0.5, 1)
      .setScale(1.25)
      .setInteractive({ useHandCursor: true })
    sprite.play(`idle_${info.role}_down`)
    const name = this.add.text(0, 3, info.name, {
      fontFamily: 'monospace', fontSize: '12px', color: OFFICE.colors.text,
      backgroundColor: OFFICE.colors.bubble, padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 0)
    const status = this.add.text(0, -44, AGENT_STATE_LABELS.idle, {
      fontFamily: 'monospace', fontSize: '11px', color: OFFICE.colors.text,
      backgroundColor: OFFICE.colors.bubble, padding: { x: 4, y: 3 },
    }).setOrigin(0.5, 1)
    const container = this.add.container(info.desk.x, info.desk.y, [sprite, name, status])
      .setDepth(info.desk.y)
    const agent: AgentRuntime = {
      info, container, sprite, direction: 'down', status,
      tile: { ...AGENT_DESKS[info.role] }, movementVersion: 0,
      nextBreakAt: 0, breakEndsAt: 0,
    }
    sprite.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.emitOfficeEvent('agent-selected', { agent: this.snapshot(agent) })
    })
    this.agents.set(info.role, agent)
    this.scheduleBreak(agent)
  }

  private setState(agent: AgentRuntime, state: AgentState): void {
    const previousState = agent.info.state
    if (state === previousState) return
    if (!TRANSITIONS[previousState].includes(state)) {
      throw new Error(`Invalid agent transition: ${previousState} -> ${state}`)
    }
    agent.info.state = state
    agent.status.setText(AGENT_STATE_LABELS[state])
    this.emitOfficeEvent('agent-state-changed', { agent: this.snapshot(agent), previousState })
  }

  private moveAgent(agent: AgentRuntime, destination: GridPosition, onComplete: () => void): void {
    this.setState(agent, 'walking')
    const version = ++agent.movementVersion
    if (this.collisionGrid[destination.row]?.[destination.col] !== 0) {
      this.handlePathFailure(agent, destination)
      return
    }
    this.pathfinder.findPath(agent.tile.col, agent.tile.row, destination.col, destination.row, (path: { x: number; y: number }[] | null) => {
      if (agent.movementVersion !== version) return
      if (!path) {
        this.handlePathFailure(agent, destination)
        return
      }

      // On interruption the sprite returns along its current edge before rerouting.
      const points: GridPosition[] = [
        agent.tile,
        ...path.slice(1).map(({ x, y }) => ({ col: x, row: y })),
      ]
      const advance = (index: number): void => {
        if (agent.movementVersion !== version) return
        if (index >= points.length) {
          agent.sprite.play(`idle_${agent.info.role}_${agent.direction}`)
          onComplete()
          return
        }
        const tile = points[index]
        const target = gridToScreen(tile.col, tile.row)
        const dx = target.x - agent.container.x
        const dy = target.y - agent.container.y
        const distance = Math.hypot(dx, dy)
        if (distance < 0.001) {
          agent.tile = { ...tile }
          advance(index + 1)
          return
        }
        agent.direction = Math.abs(dx) > Math.abs(dy)
          ? (dx < 0 ? 'left' : 'right')
          : (dy < 0 ? 'up' : 'down')
        agent.sprite.play(`walk_${agent.info.role}_${agent.direction}`, true)
        agent.movement = this.tweens.add({
          targets: agent.container,
          x: target.x,
          y: target.y,
          duration: distance / OFFICE.timing.moveSpeed * 1000,
          onComplete: () => {
            if (agent.movementVersion !== version) return
            agent.movement = undefined
            agent.tile = { ...tile }
            advance(index + 1)
          },
        })
      }
      advance(0)
    })
    this.pathfinder.calculate()
  }

  private cancelMovement(agent: AgentRuntime): void {
    agent.movementVersion += 1
    agent.movement?.stop()
    agent.movement = undefined
    agent.sprite.play(`idle_${agent.info.role}_${agent.direction}`)
  }

  private handlePathFailure(agent: AgentRuntime, destination: GridPosition): void {
    for (const timer of this.timers) timer.remove()
    this.timers.clear()
    for (const member of this.agents.values()) {
      this.cancelMovement(member)
      if (member.info.state !== 'idle') this.setState(member, 'idle')
      this.scheduleBreak(member)
    }
    this.cycleRunning = false
    this.emitOfficeEvent('office-error', {
      message: `Chemin introuvable pour ${agent.info.name} vers (${destination.col}, ${destination.row}).`,
    })
  }

  private returnAgentsToDesks(onComplete: () => void): void {
    let remaining = this.agents.size
    for (const agent of this.agents.values()) {
      this.cancelMovement(agent)
      if (agent.info.state !== 'idle') this.setState(agent, 'idle')
      this.moveAgent(agent, AGENT_DESKS[agent.info.role], () => {
        this.setState(agent, 'idle')
        remaining -= 1
        if (remaining === 0) onComplete()
      })
      if (!this.cycleRunning) break
    }
  }

  private scheduleBreak(agent: AgentRuntime): void {
    agent.nextBreakAt = this.time.now + Phaser.Math.Between(OFFICE.timing.breakMin, OFFICE.timing.breakMax)
  }

  private after(delay: number, callback: () => void): void {
    const timer = this.time.delayedCall(delay, () => {
      this.timers.delete(timer)
      callback()
    })
    this.timers.add(timer)
  }

  private getAgent(role: AgentRole): AgentRuntime {
    const agent = this.agents.get(role)
    if (!agent) throw new Error(`Missing office agent: ${role}`)
    return agent
  }

  private snapshot(agent: AgentRuntime): AgentInfo {
    return { ...agent.info, desk: { ...agent.info.desk } }
  }

  private emitOfficeEvent<K extends keyof OfficeEventMap>(event: K, payload: OfficeEventMap[K]): void {
    this.events.emit(event, payload)
  }

  private cleanup(): void {
    for (const timer of this.timers) timer.remove()
    this.timers.clear()
    for (const agent of this.agents.values()) this.cancelMovement(agent)
    this.agents.clear()
    this.cycleRunning = false
  }
}
