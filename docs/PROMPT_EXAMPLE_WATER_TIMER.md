# Example prompt: “Rain Timer” (Axiom + canvas + springs + Pretext)

Use this (or adapt it) when you want an LLM to build a **single-file or small-module** experience that exercises **scene JSON**, **Runtime** (springs + hit tests), **Pretext** (`textLayout: "pretext"`), and optional **`setFrameCallback`** for ambient motion.

Copy everything inside the fence into your model chat as the user message.

---

## Prompt (copy from here)

You are implementing a **focus timer web app** using the **Axiom** stack in this repo. Read these **before writing code**:

- `docs/LLM_PRIMER.md` — how to compute coordinates and emit valid scenes
- `docs/SCENE_FORMAT.md` — node types and fields
- `docs/PHYSICS.md` — spring parameters

### Product: “Rain Timer”

**Theme:** A calm, dark glass pane after rain. **Water drops** sit on the “glass” (canvas). A **large, readable countdown** uses Pretext so labels stay crisp when the layout breathes.

**Core behavior**

1. **Timer state:** `idle` | `running` | `paused` | `done`. Show remaining time as `MM:SS` (and optionally tenths for the last 10 seconds).
2. **Presets:** At least three duration chips (e.g. 5 / 15 / 25 minutes). Tapping a chip selects it when idle; does nothing confusing while running (define behavior clearly—e.g. ignore or require long-press to change).
3. **Primary actions:** `Start` / `Pause` / `Resume` / `Reset` implemented as canvas rects with `interactive: true`, hover springs (`runtime.spring`), and clear cursor hints.
4. **Clever duration setting (pick one or combine subtly):**
   - **Ripple dial:** User presses near the **bottom center** and drags horizontally; the **horizontal distance** maps to duration in a bounded range (e.g. 1–90 minutes) with **haptic-style** spring feedback on the “value” indicator.
   - **Drop merge:** Two small “droplets” (circles) on the glass represent **minutes** and **seconds** banks; **dragging one onto the other** “merges” into a target duration (e.g. sum modulo cap). Use simple geometry + hit tests—no real fluid simulation required; **fake** merge with a spring pulse and particle streaks (small circles or lines) is enough.
   - **Rain intensity = minutes:** A **slider** made of a rect track + draggable knob; the **vertical position of ambient rain** (line segments or particles) maps to chosen minutes (purely visual metaphor—keep performance sane).

5. **Water drops (visual):**
   - **20–60** small semi-transparent circles or rounded rects with subtle **spring bob** (different phases) using `setFrameCallback` or per-node spring offsets.
   - Occasional **drip**: a drop moves **down slowly** with easing or a light spring toward a target y, then resets at the top (loop). This must not tank FPS—batch motion, cap count.

6. **Typography:** Title and body copy use **`textLayout: "pretext"`** with `maxWidth` and `lineHeight` where wrapping matters. Use explicit numeric layout from the primer (centering, padding).

7. **No new dependencies** except what the project already has (`@chenglou/pretext`, Vite, TypeScript). Implement as a **new demo module** (e.g. `src/demos/rain-timer-demo.ts`) and wire it in `src/main.ts` behind `?demo=rain` (or similar).

8. **Scene discipline:** Emit a **`Scene`** with `formatVersion: 1`. Every positioned element must have **resolved numbers** (show your math in comments above the scene object). Use **meaningful ids** (`timer-start`, `glass-bg`, `drop-12`, …).

9. **Polish:** Subtle **radial gradient** background; **shadow** on the main glass card; countdown **scales emotionally**—e.g. gentle spring when transitioning `running` → `done`.

### Deliverables

- The new demo file(s) and the minimal `main.ts` / `index.html` edits to select the demo.
- Short **README snippet** in a comment at the top of the demo file: how to run (`npm run dev`) and URL query.

### Non-goals

- No React/Vue/CSS layout for the main UI (canvas only). A hidden `<input>` for accessibility is optional but not required for this exercise.

---

## Why this prompt works

| Mechanism          | What the app exercises                          |
| ------------------ | ----------------------------------------------- |
| Scene JSON + math  | Presets, dial/slider geometry, countdown layout |
| Springs            | Buttons, knob, droplet merge pulse, hover lift  |
| Pretext            | Wrapped hints, title, adaptive copy             |
| `setFrameCallback` | Ambient drops, rain intensity, drips            |
| Hit testing        | Chips, buttons, draggable knob or droplets      |

---

## Variations

- **Pomodoro focus:** same shell, add a “focus / break” phase strip using two spring-driven tabs.
- **Sound:** leave hooks (`onDone` callback) commented for Web Audio beeps later—keep the first version silent.
