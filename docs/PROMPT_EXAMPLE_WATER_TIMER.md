# Example prompt: “Rain Timer” (Axiom + canvas + springs + Pretext)

Use this when you want an LLM to build a **small** canvas-first demo. **Read [HYBRID_UI.md](HYBRID_UI.md)** so you know when canvas-only is appropriate and how to avoid chaotic layouts.

For a **real ripple pool + HUD** (Tier B `fx` module), use **[PROMPT_WATER_CLOCK.md](PROMPT_WATER_CLOCK.md)** instead of overloading this prompt.

Copy everything inside the **Prompt** fence into your model chat.

---

## Prompt (copy from here)

You are implementing a **focus timer** using **Axiom** in this repo. Read first:

- `docs/LLM_PRIMER.md` (especially **draw order and transparency**)
- `docs/SCENE_FORMAT.md`
- `docs/PHYSICS.md`
- `docs/HYBRID_UI.md` (canvas vs DOM — follow canvas-only rules below)

### Product: “Rain Timer”

**Visual goal:** Calm, readable, **one clear focal point** (the countdown). Decorative rain/drops are **supporting**, not competing with controls.

### Non-negotiable layout rules (avoid chaotic UIs)

1. **Decorations vs controls:** Put **ambient drops / rain lines** in either:
   - a **narrow horizontal band** under the title (e.g. fixed y-range, small height), **or**
   - **behind** an **opaque** main panel rect (`rgba` alpha ≥ ~0.92 for interactive chips/buttons).
2. **Do not** scatter 40+ droplets across the **entire** card if you also draw **translucent** preset chips—those drops will **show through** translucent buttons (draw order will look “wrong”). **Opaque** chip/button fills OR confined droplet regions.
3. **Pick one primary duration control** for the first version: **either** ripple dial **or** vertical slider **or** merge droplets—not all three. You may add **presets** (5 / 15 / 25) as small secondary chips.
4. **Z-order:** Remember later array elements paint **on top**. Order: background → clipped decoration group → opaque panel → text → interactive rects → text labels on buttons.
5. **Typography:** Use `textLayout: "pretext"` where text wraps; keep copy **short** so the layout does not fight the timer. **Pretext here is still canvas text** (measurement + line breaks). A **production hybrid** would mirror controls or live regions in **DOM** for accessibility and native forms—see `HYBRID_UI.md`; this exercise stays canvas-first.

### Interaction physics (checklist)

Springs should match **affordance and state**, not decorate blindly.

- **Tappable / active control:** `mouseenter` → small hover lift (negative `dy` via `runtime.spring`); `mouseleave` → return to 0; `cursor: pointer` (or `ew-resize` / `grab` where appropriate).
- **Pressed:** `mousedown` → slight dip; `mouseup` → return toward hover lift.
- **Disabled or no-op** (e.g. presets while running, dial while timer active): **no** hover lift—either skip spring handlers when state forbids interaction, or set `interactive: false` / `cursor: default` for that phase.
- **Timer completes:** one short motion on the **focal node** (e.g. countdown group)—e.g. spring **dy** then settle; avoid endless oscillation.
- **Drag primary control (if any):** while dragging, prefer `grabbing`; optional snap spring when the value updates.

### Core behavior

1. States: `idle` | `running` | `paused` | `done`. Countdown `MM:SS` (optional tenths in last 10s).
2. **Presets:** 5 / 15 / 25 minutes; disabled or no-op while running (state clearly in status text).
3. **Actions:** Start / Pause / Resume / Reset — canvas rects, `interactive: true`, hover springs, `cursor`.
4. **Your single chosen duration control** (dial OR slider OR merge): document interaction in one line of on-screen hint text.

### Water motif (lightweight)

- ≤ **24** small circles **or** short rain segments; animate with `setFrameCallback` or springs. **Cap** work per frame.
- Optional **one** looping drip (reset at top).

### Scene discipline

- `"formatVersion": 1`
- Resolved numeric layout with comments showing math
- Stable ids (`glass-bg`, `chip-15`, …)

### Deliverables

- Demo module + wire `?demo=rain` (or project’s convention).
- Top-of-file comment: how to run.

### Out of scope

- Full React/CSS layout for the timer chrome (canvas exercise). For production a11y, a hybrid DOM timer + canvas decoration would be ideal—see `HYBRID_UI.md`.

---

## Why the old prompt failed (lesson learned)

Asking for **dial + slider + merge + many drops + long hint text** produced **overlapping metaphors** and **translucent controls** over busy decoration—visually chaotic. Tight rules above fix the **decision** an LLM must make: **fewer ornaments, opaque hits, one primary control.**

---

## Related

| Doc                            | Use                                     |
| ------------------------------ | --------------------------------------- |
| [HYBRID_UI.md](HYBRID_UI.md)   | When canvas-only is enough vs DOM shell |
| [LLM_PRIMER.md](LLM_PRIMER.md) | Draw order and transparency             |
