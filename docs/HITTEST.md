# Axiom Hit Testing

Hit testing replaces the browser's DOM event system. The canvas is a single bitmap element — there is no per-node event target. Axiom resolves the interactive node under a pointer coordinate through explicit geometry math.

## Traversal Order

Nodes are checked **last-to-first** in the `nodes` array. The last node in the array is rendered on top and is checked first for hits. Within a node, **children are checked before the parent** — children sit on top of their parent visually.

```
nodes: [background, card, button]
         ↑ checked last     ↑ checked first
```

## `interactive` Flag

Only nodes with `interactive: true` participate in hit testing. Non-interactive nodes are transparent to the hit test — the traversal continues through them to lower nodes. Children of a non-interactive node are still checked.

## Per-Type Geometry

| Node type | Hit geometry                                     | Notes                                                           |
| --------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `rect`    | AABB: `(x, y, width, height)`                    | Inclusive on all edges                                          |
| `circle`  | Distance test from center `(x, y)` with `radius` | Inclusive on edge                                               |
| `group`   | AABB using `clipWidth` × `clipHeight`            | Only hittable when both are set                                 |
| `text`    | AABB: `(x, y, maxWidth, lineHeight)`             | Only hittable when both `maxWidth` **and** `lineHeight` are set |
| `line`    | Not hittable                                     | Use an interactive rect overlay for line click targets          |

## Text Node Hit Testing

Text nodes are hittable only when `maxWidth` and `lineHeight` are explicitly declared. The hit box is a single-row rectangle `(x, y, maxWidth, lineHeight)`.

```json
{
  "type": "text",
  "id": "label",
  "x": 20,
  "y": 10,
  "content": "Click me",
  "font": "16px Inter",
  "fill": "#fff",
  "interactive": true,
  "maxWidth": 120,
  "lineHeight": 24
}
```

For multi-line text where the full block height must be hittable, wrap the text in a transparent interactive `rect`:

```json
{
  "type": "rect",
  "id": "label-hit",
  "x": 20,
  "y": 10,
  "width": 120,
  "height": 96,
  "interactive": true,
  "children": [
    {
      "type": "text",
      "id": "label-text",
      "x": 0,
      "y": 0,
      "content": "...",
      "font": "16px Inter",
      "fill": "#fff",
      "maxWidth": 120,
      "lineHeight": 24
    }
  ]
}
```

## Spring Offsets

Spring displacements (`dx`, `dy`) are applied to node positions before the geometric test. If a node is spring-animated to `(+30, +10)`, its hit zone moves with it. The hit test always reflects the visually rendered position.

## Coordinate System

All hit test coordinates are in CSS pixels (the same space as `node.x` and `node.y`). Device pixel ratio scaling is handled by the Runtime before calling `hitTest` — you do not need to account for DPR when registering event handlers.

## Group Clipping and Hit Testing

A group with `clipWidth`/`clipHeight` clips its children visually and is itself hittable within those bounds (when `interactive: true`). A group without clip dimensions is a pure container — never directly hittable, though its children remain hittable as normal.

## Debugging Hit Zones

If a node is not responding to mouse events:

1. Confirm `interactive: true` is set on that node (not just a parent).
2. Check that no higher-z (later in array) opaque `interactive` node covers the same area.
3. If the node is spring-displaced, remember the hit zone moves with it — the original coordinates are no longer active.
4. For `text` nodes: confirm both `maxWidth` and `lineHeight` are set.
5. For `group` nodes: confirm `clipWidth` and `clipHeight` are both set.

Render a temporary `rect` at the same coordinates as the expected hit zone (with a semi-transparent fill) to visualise it.
