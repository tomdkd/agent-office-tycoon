import Phaser from 'phaser'
import type { FurnitureKind } from './officeLayout'

const ASSET_KEYS = { interiors: 'limezu-interiors', room: 'limezu-room' } as const
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/Interiors/16x16/`

type Crop = readonly [number, number, number, number]
const CROPS: Record<FurnitureKind | 'chair' | 'window' | 'glass', Crop> = {
  desk: [32, 576, 32, 24],
  plant: [168, 704, 24, 32],
  server: [192, 640, 16, 32],
  kanban: [208, 608, 32, 24],
  coffee: [48, 48, 16, 32],
  pingpong: [168, 616, 28, 16],
  couch: [16, 1152, 48, 32],
  water: [224, 800, 16, 32],
  chair: [80, 336, 16, 32],
  window: [112, 384, 32, 32],
  glass: [32, 448, 32, 32],
}

export function preloadOfficeTextures(scene: Phaser.Scene): void {
  scene.load.image(ASSET_KEYS.interiors, `${ASSET_BASE}Interiors_free_16x16.png`)
  scene.load.image(ASSET_KEYS.room, `${ASSET_BASE}Room_Builder_free_16x16.png`)
}

export function prepareOfficeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ASSET_KEYS.interiors) || !scene.textures.exists(ASSET_KEYS.room)) {
    throw new Error('Les planches de textures du bureau ne sont pas disponibles.')
  }
  const interiors = scene.textures.get(ASSET_KEYS.interiors)
  const room = scene.textures.get(ASSET_KEYS.room)
  for (const [kind, [x, y, width, height]] of Object.entries(CROPS)) {
    if (!interiors.has(kind)) interiors.add(kind, 0, x, y, width, height)
  }
  if (!room.has('floor')) room.add('floor', 0, 176, 128, 16, 16)
  if (!room.has('wall')) room.add('wall', 0, 0, 96, 16, 16)
}

export function addOfficeImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: keyof typeof CROPS,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ASSET_KEYS.interiors, frame)
}

export function addRoomImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: 'floor' | 'wall',
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ASSET_KEYS.room, frame)
}
