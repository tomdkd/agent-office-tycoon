import Phaser from 'phaser'
import type { AgentRole } from '../types/office'

export type SpriteDirection = 'down' | 'up' | 'left' | 'right'

export const AGENT_CLOTHING_COLORS: Record<AgentRole, number> = {
  manager: 0x79c6eb,
  po: 0xa680d0,
  dev_back: 0x5ca971,
  dev_front: 0xe7bd4f,
  qa: 0xd96a68,
}

export const SPRITE_DIRECTIONS: readonly SpriteDirection[] = ['down', 'up', 'left', 'right']
export const SPRITE_FRAME_WIDTH = 24
export const SPRITE_FRAME_HEIGHT = 32
export const SPRITE_FRAMES_PER_DIRECTION = 3

const PALETTE = {
  outline: '#313344',
  skin: '#e9b995',
  skinShadow: '#c9886e',
  hair: '#593e36',
  trousers: '#4b5574',
  shoes: '#302f41',
  white: '#f4e8d9',
} as const

export function agentTextureKey(role: AgentRole): string {
  return `office_agent_${role}`
}

export function agentFrame(direction: SpriteDirection, pose: number): number {
  return SPRITE_DIRECTIONS.indexOf(direction) * SPRITE_FRAMES_PER_DIRECTION + pose
}

export function createAgentTexture(scene: Phaser.Scene, role: AgentRole): string {
  const key = agentTextureKey(role)
  if (scene.textures.exists(key)) return key

  const texture = scene.textures.createCanvas(
    key,
    SPRITE_FRAME_WIDTH * SPRITE_FRAMES_PER_DIRECTION * SPRITE_DIRECTIONS.length,
    SPRITE_FRAME_HEIGHT,
  )
  if (!texture) throw new Error(`Could not create agent texture: ${key}`)

  const context = texture.getContext()
  context.imageSmoothingEnabled = false
  const shirt = `#${AGENT_CLOTHING_COLORS[role].toString(16).padStart(6, '0')}`

  for (const direction of SPRITE_DIRECTIONS) {
    for (let pose = 0; pose < SPRITE_FRAMES_PER_DIRECTION; pose += 1) {
      const frame = agentFrame(direction, pose)
      const x = frame * SPRITE_FRAME_WIDTH
      context.save()
      context.translate(x, 0)
      drawCharacter(context, direction, pose, shirt)
      context.restore()
      texture.add(frame, 0, x, 0, SPRITE_FRAME_WIDTH, SPRITE_FRAME_HEIGHT)
    }
  }

  texture.setFilter(Phaser.Textures.FilterMode.NEAREST)
  texture.refresh()
  return key
}

function drawCharacter(
  context: CanvasRenderingContext2D,
  direction: SpriteDirection,
  pose: number,
  shirt: string,
): void {
  const bob = pose === 1 ? 0 : 1
  const step = pose - 1
  const fill = (color: string, x: number, y: number, width: number, height: number) => {
    context.fillStyle = color
    context.fillRect(x, y, width, height)
  }

  // Legs move in opposite directions while the body bobs by one pixel.
  fill(PALETTE.outline, 7, 22, 10, 7)
  fill(PALETTE.trousers, 8, 22, 3, 5 + step)
  fill(PALETTE.trousers, 13, 22, 3, 5 - step)
  fill(PALETTE.shoes, 7, 27 + step, 5, 2)
  fill(PALETTE.shoes, 12, 27 - step, 5, 2)

  fill(PALETTE.outline, 6, 13 - bob, 12, 11)
  fill(shirt, 7, 14 - bob, 10, 9)
  fill(PALETTE.skinShadow, 5, 18 - bob, 2, 4)
  fill(PALETTE.skinShadow, 17, 18 - bob, 2, 4)
  fill(PALETTE.outline, 7, 3 - bob, 10, 11)
  fill(PALETTE.skin, 8, 5 - bob, 8, 8)
  fill(PALETTE.hair, 8, 3 - bob, 8, 3)

  if (direction === 'up') {
    fill(PALETTE.hair, 8, 5 - bob, 8, 6)
  } else if (direction === 'down') {
    fill(PALETTE.outline, 9, 8 - bob, 1, 1)
    fill(PALETTE.outline, 14, 8 - bob, 1, 1)
    fill(PALETTE.white, 11, 12 - bob, 2, 2)
  } else {
    const eyeX = direction === 'left' ? 8 : 15
    const hairX = direction === 'left' ? 13 : 8
    fill(PALETTE.hair, hairX, 5 - bob, 3, 4)
    fill(PALETTE.outline, eyeX, 8 - bob, 1, 1)
  }
}
