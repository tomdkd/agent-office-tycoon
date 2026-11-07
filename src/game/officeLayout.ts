import type { AgentRole, OfficePosition } from '../types/office'

export interface GridPosition {
  col: number
  row: number
}

export const TILE_SIZE = 32
export const GRID_COLS = 22
export const GRID_ROWS = 14
export const GRID_ORIGIN: OfficePosition = { x: 48, y: 112 }

export function gridToScreen(col: number, row: number): OfficePosition {
  return {
    x: GRID_ORIGIN.x + (col + 0.5) * TILE_SIZE,
    y: GRID_ORIGIN.y + (row + 1) * TILE_SIZE,
  }
}

export type FurnitureKind = 'desk' | 'plant' | 'server' | 'kanban' | 'coffee' | 'pingpong' | 'couch' | 'water'

export interface Furniture extends GridPosition {
  kind: FurnitureKind
}

export const MANAGER_DOOR: GridPosition = { col: 3, row: 5 }

export const AGENT_DESKS: Record<AgentRole, GridPosition> = {
  manager: { col: 2, row: 2 },
  po: { col: 9, row: 3 },
  dev_back: { col: 13, row: 3 },
  dev_front: { col: 9, row: 8 },
  qa: { col: 13, row: 8 },
}

export const INTERACTION_POSITIONS = {
  po: { col: 8, row: 3 },
  coffee: { col: 17, row: 3 },
  pingpong: { col: 18, row: 9 },
} satisfies Record<string, GridPosition>

export const FURNITURE: readonly Furniture[] = [
  { kind: 'desk', col: 2, row: 1 },
  { kind: 'desk', col: 9, row: 2 },
  { kind: 'desk', col: 13, row: 2 },
  { kind: 'desk', col: 9, row: 7 },
  { kind: 'desk', col: 13, row: 7 },
  { kind: 'server', col: 7, row: 0 },
  { kind: 'kanban', col: 11, row: 0 },
  { kind: 'coffee', col: 18, row: 2 },
  { kind: 'couch', col: 18, row: 5 },
  { kind: 'pingpong', col: 18, row: 7 },
  { kind: 'plant', col: 0, row: 7 },
  { kind: 'plant', col: 21, row: 12 },
]

export const FURNITURE_SIZE: Record<FurnitureKind, Readonly<{ cols: number; rows: number }>> = {
  desk: { cols: 2, rows: 1 },
  pingpong: { cols: 3, rows: 2 },
  couch: { cols: 2, rows: 1 },
  plant: { cols: 1, rows: 1 },
  server: { cols: 1, rows: 1 },
  kanban: { cols: 1, rows: 1 },
  coffee: { cols: 1, rows: 1 },
  water: { cols: 1, rows: 1 },
}

export function furnitureTiles(furniture: Furniture): GridPosition[] {
  const { cols, rows } = FURNITURE_SIZE[furniture.kind]
  return Array.from({ length: cols * rows }, (_, index) => ({
    col: furniture.col + index % cols,
    row: furniture.row + Math.floor(index / cols),
  }))
}

export const PARTITIONS: readonly GridPosition[] = [
  ...Array.from({ length: 6 }, (_, row) => ({ col: 6, row })),
  ...Array.from({ length: 6 }, (_, col) => ({ col, row: 5 }))
    .filter(({ col }) => col !== MANAGER_DOOR.col),
]

export function createCollisionGrid(): number[][] {
  const grid = Array.from({ length: GRID_ROWS }, () => Array<number>(GRID_COLS).fill(0))
  for (const { col, row } of [...PARTITIONS, ...FURNITURE.flatMap(furnitureTiles)]) grid[row][col] = 1
  return grid
}
