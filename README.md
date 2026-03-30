# Axiom

**Mathematical UI. Physics-first. LLM-authored.**

Axiom is a canvas-based UI rendering platform where every element has an exact coordinate, every animation is a spring equation, and the entire interface is described as pure data. No CSS. No DOM layout. No component tree.

```bash
cd axiom && npm install && npm run dev
```

---

## The problem with the current stack

The web's rendering pipeline was designed for documents. CSS describes rules; the browser discovers positions. React manages DOM mutations. TypeScript types the JavaScript. Webpack bundles it all. Each layer is an escape hatch from the previous layer's problems.

By the time a button appears on screen it has passed through:

```
JSX → JavaScript → Reconciler → DOM mutation
CSS cascade → Computed styles → Layout engine → Box positions
Paint → Composite → GPU
```

The layout engine is a black box. You write `display: flex; align-items: center` and hope the browser interprets it the way you imagine. You find out if you were wrong by opening DevTools.

---

## The Axiom approach

```
Natural language description
         ↓
    LLM generates
         ↓
    Scene JSON  ← explicit coordinates, spring configs, interactions
         ↓
  Axiom Runtime
    ├─ Expression resolver
    ├─ Hit test engine (replaces DOM event bubbling)
    └─ Spring physics (replaces CSS transitions)
         ↓
  Canvas 2D / WebGL
         ↓
      Pixels
```

**A scene is pure JSON.** Every element has an explicit x, y, width, height. No rules. No inheritance. No cascade. The browser's role is reduced to: run JavaScript, receive mouse events, draw a canvas.

**Springs replace transitions.** CSS `transition: transform 0.3s ease-out` is a cubic-bezier approximation of motion. A spring is `F = -kx - bv` — real physics. Springs compose, chain, and respond to interruption naturally. Change the target mid-animation: smooth continuation. CSS: jarring restart.

**LLMs are the intended author.** Coordinate math is mechanical. An LLM can reason: "the card is 64px tall, so vertically centered is at y = 32". It can calculate that three cards of width 300px with 28px gaps need `(viewport.width - (300*3 + 28*2)) / 2` left margin. Humans find this tedious. LLMs find it trivial.

The inversion: instead of a human writing CSS rules and a browser discovering positions, an LLM writes positions and the browser just draws them.

---

## Project structure

```
axiom/
├── src/
│   ├── types.ts      Scene type definitions — the contract LLMs write to
│   ├── physics.ts    Spring engine (Hooke's law, Euler integration)
│   ├── renderer.ts   Canvas 2D renderer (stateless, pure draw calls)
│   ├── hittest.ts    Geometric hit testing (replaces DOM event bubbling)
│   ├── runtime.ts    Orchestrator: RAF loop, springs, input events
│   └── main.ts       Demo scene
├── docs/
│   ├── LLM_PRIMER.md     How to generate Axiom scenes (read this first)
│   ├── SCENE_FORMAT.md   Complete type reference
│   ├── PHYSICS.md        Spring parameter guide
│   └── BOOK_EXAMPLE.md   Tactile page-flip book implementation plan
└── index.html            Single canvas element + minimal reset CSS
```

---

## What the demo shows

Three cards on a dark background. Each card springs upward 10px on hover — the shadow deepens automatically because the renderer receives the spring displacement and adjusts shadow offset accordingly. On mousedown, the card dips back to -4px (pressed feel), then springs to -10px on release.

No CSS transition. No `animation` keyframe. The motion is described by two numbers: `stiffness: 320, damping: 24`.

---

## Roadmap

- **v0** (current): Scene format, Canvas 2D renderer, spring physics, hit testing
- **v1**: Expression evaluator (viewport-relative coordinates in JSON), constraint solver
- **v2**: WebGPU renderer, WGSL shader effects (glass, glow, noise)
- **v3**: Page-flip book implementation, gesture physics (drag with momentum)
- **v4**: LLM integration layer — natural language → scene JSON pipeline
- **v5**: Visual inspector (humans read what the LLM generated)
- **v6**: Accessibility tree generation alongside the visual scene
