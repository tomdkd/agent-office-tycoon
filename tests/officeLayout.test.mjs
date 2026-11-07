import assert from 'node:assert/strict'
import { test } from 'node:test'
import EasyStar from 'easystarjs'
import {
  AGENT_DESKS,
  createCollisionGrid,
  FURNITURE,
  furnitureTiles,
  FURNITURE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  GRID_ORIGIN,
  gridToScreen,
  INTERACTION_POSITIONS,
  MANAGER_DOOR,
  PARTITIONS,
  TILE_SIZE,
} from '../src/game/officeLayout.ts'

function findPath(grid, from, to) {
  const search = new EasyStar.js()
  search.setGrid(grid)
  search.setAcceptableTiles([0])
  search.enableSync()
  search.setIterationsPerCalculation(GRID_COLS * GRID_ROWS * 4)
  let result
  search.findPath(from.col, from.row, to.col, to.row, (path) => { result = path })
  search.calculate()
  return result
}

test('grid positions are orthogonal and spaced by one tile', () => {
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      assert.deepEqual(gridToScreen(col, row), {
        x: GRID_ORIGIN.x + (col + 0.5) * TILE_SIZE,
        y: GRID_ORIGIN.y + (row + 1) * TILE_SIZE,
      })
    }
  }
})

test('layout blocks every furniture and partition tile and leaves destinations open', () => {
  const grid = createCollisionGrid()
  const occupied = new Set()
  for (const item of FURNITURE) {
    for (const { col, row } of furnitureTiles(item)) {
      assert.ok(col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS)
      assert.equal(grid[row][col], 1)
      const key = `${col},${row}`
      assert.ok(!occupied.has(key), `Overlapping furniture at ${key}`)
      occupied.add(key)
    }
  }
  for (const { col, row } of PARTITIONS) {
    assert.equal(grid[row][col], 1)
    assert.ok(!occupied.has(`${col},${row}`), 'Furniture overlaps a partition')
  }
  for (const { col, row } of [...Object.values(AGENT_DESKS), ...Object.values(INTERACTION_POSITIONS), MANAGER_DOOR]) {
    assert.equal(grid[row][col], 0)
  }
})

test('furniture has the requested collision footprints', () => {
  assert.deepEqual(FURNITURE_SIZE.desk, { cols: 2, rows: 1 })
  assert.deepEqual(FURNITURE_SIZE.pingpong, { cols: 3, rows: 2 })
  assert.deepEqual(FURNITURE_SIZE.couch, { cols: 2, rows: 1 })
  assert.equal(FURNITURE.filter((item) => item.kind === 'desk').length, 5)
})

test('all work and break destinations are connected without crossing obstacles', () => {
  const grid = createCollisionGrid()
  const destinations = [...Object.values(AGENT_DESKS), ...Object.values(INTERACTION_POSITIONS)]
  for (const from of destinations) {
    for (const to of destinations) {
      const path = findPath(grid, from, to)
      assert.ok(path, `No path from ${JSON.stringify(from)} to ${JSON.stringify(to)}`)
      for (let i = 0; i < path.length; i += 1) {
        const point = path[i]
        assert.equal(grid[point.y][point.x], 0)
        if (i > 0) assert.equal(Math.abs(point.x - path[i - 1].x) + Math.abs(point.y - path[i - 1].y), 1)
      }
    }
  }
})

test('the only route from the Manager office to the open space uses the door', () => {
  const grid = createCollisionGrid()
  const path = findPath(grid, AGENT_DESKS.manager, INTERACTION_POSITIONS.po)
  assert.ok(path?.some(({ x, y }) => x === MANAGER_DOOR.col && y === MANAGER_DOOR.row))
  grid[MANAGER_DOOR.row][MANAGER_DOOR.col] = 1
  assert.equal(findPath(grid, AGENT_DESKS.manager, INTERACTION_POSITIONS.po), null)
})
