# 🏛️ AI Office Tycoon - Architecture Rules

## 1. Stack & Boundaries
- **Stack:** React 19, TypeScript (strict, zero `any`), Tailwind CSS v4, Phaser 3.
- **Phaser:** Gère uniquement le canvas, les assets graphiques et le pathfinding.
- **React:** Gère le HUD, les modales et la logique de dialogue.

## 2. Rendering Rules
- Canvas: viewport-sized, `pixelArt: true`, scale mode `RESIZE`. Keep the 800x600 office centered with a uniform camera zoom on resize.
- NO procedural vector shapes (`graphics.fillRect` / `lineBetween`) for furniture or walls. Use PNG textures exclusively from `public/assets/Interiors/`.
- Depth Sorting: All dynamic objects and characters must run `sprite.setDepth(sprite.y)` in `update()`.

## 3. Room & Character Setup
- Top-Down / 2D perspective matching the `Interiors` tileset.
- Distinct zones:
  - Manager Office (top-left, enclosed by walls with a door opening).
  - Open Space (desks for PO, Devs, QA).
  - Break Area (coffee machine, couch, ping-pong / plants).
- Agents walk tile-by-tile via EasyStar.js avoiding obstacles (walls and desks).