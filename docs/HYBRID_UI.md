# When to use Axiom (canvas) vs traditional HTML/CSS

**Scope:** UI layout, motion, and optional **Tier B** CPU ripple ([VISION_AND_LIMITS.md](VISION_AND_LIMITS.md)). Axiom is **not** a full fluid or game engine.

Axiom is optimized for **explicit geometry**, **spring motion**, and **LLM-generated scene data**. It is not a replacement for the whole web platform. Use this page as a **decision model** for hybrid apps.

---

## Where Axiom performs well

| Use case                            | Why canvas + Axiom fits                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| **Custom motion**                   | Springs, continuous layout animation, reflow at animation speed (with Pretext).           |
| **Creative / editorial / data viz** | Dense or unusual layouts where DOM/CSS fight you; single surface, predictable draw order. |
| **Games, instruments, timelines**   | Hit tests as geometry; no cascade surprises.                                              |
| **Generative UI**                   | Finite JSON vocabulary; coordinates are easy for LLMs to emit.                            |
| **“No CSS layout” demos**           | Teaching physics-first UI or avoiding layout thrash for text measurement (Pretext).       |

---

## Where traditional HTML/CSS (or a framework) is usually better

| Use case                | Why DOM wins                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| **Forms**               | `<input>`, validation, autofill, password managers, native keyboards.                                  |
| **Accessibility**       | Screen readers, focus order, ARIA — canvas is a bitmap unless you mirror with a hidden DOM or similar. |
| **SEO**                 | Crawlable text lives in HTML; a full-screen canvas has no intrinsic document structure.                |
| **Long copy**           | Articles, blogs: CSS + semantic HTML is the right tool.                                                |
| **Standard components** | Date pickers, selects, complex tables: battle-tested libraries.                                        |

**Practical split:** Build **chrome and forms in HTML/CSS** (or React), and **embed a canvas** for the custom visualization or physics layer. Or: **full canvas for prototypes / installations**, then add a DOM shell for production accessibility if needed.

---

## Canvas-only: common failure modes (and fixes)

These show up often in LLM-generated Axiom apps (e.g. “Rain Timer” style demos).

### 1. Draw order vs transparency

Later siblings are drawn **on top** (see [LLM_PRIMER.md](LLM_PRIMER.md) — draw order). If a **later** control uses a **semi-transparent** fill, **earlier** decorations (drops, lines) **show through**. That looks like “physics on top of buttons” even when z-order is correct.

**Fix:** Use **opaque** fills for interactive rects (`alpha` near `1`), or put decorations in a **separate group drawn under** an opaque panel, or **clip** decorations to a non-interactive band (see below).

### 2. Decoration clutter

Many particles + multiple alternate controls (dial + slider + merge + presets) **compete for attention**.

**Fix:** One **primary** duration control; keep decorative motion **subtle** and **region-bounded** (e.g. only the header strip).

### 3. Hit targets vs visuals

Small draggable circles near labels need clear stacking: label text **after** circles in the child list so text stays readable.

### 4. Pretext vs canvas wrap

`textLayout: "pretext"` helps **wrapping quality**; it does not fix **layout hierarchy**. Confusing UX is still confusing with Pretext.

---

## Decision checklist

```
Need native forms, a11y, or SEO as first-class?
  Yes → Use HTML/CSS (or hybrid: DOM shell + canvas island).
  No  → Can you describe the UI as explicit rects/circles/text + springs?
          Yes → Axiom is a good fit.
          No  → Reconsider scope or hybrid.
```

---

## Related docs

- [LLM_PRIMER.md](LLM_PRIMER.md) — coordinates, draw order, transparency.
- [PROMPT_EXAMPLE_WATER_TIMER.md](PROMPT_EXAMPLE_WATER_TIMER.md) — revised prompt rules to reduce chaotic layouts.
