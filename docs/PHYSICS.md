# Axiom Physics Reference

## The spring equation

Every animation in Axiom is a spring. The governing equation:

```
F = -k(x - target) - b·v
a = F / m
v += a · dt
x += v · dt
```

Where:
- `k` = stiffness (spring constant)
- `b` = damping coefficient
- `m` = mass
- `x` = current position (displacement from equilibrium)
- `v` = velocity
- `dt` = time step (seconds)

This is Hooke's law with viscous damping, integrated with semi-implicit Euler.

---

## Parameters

### Stiffness (`k`)

How aggressively the spring pulls toward the target.

- Low stiffness (80–150): slow, gentle motion — large surfaces, modals
- Medium stiffness (200–300): standard UI response — cards, panels
- High stiffness (350–600): snappy, responsive — buttons, small elements

High stiffness alone makes motion feel twitchy if damping is not sufficient.

### Damping (`b`)

How quickly oscillation decays. Think of damping as the resistance the element moves through.

- **Underdamped** (b < 2√(k·m)): overshoots and oscillates before settling (bouncy)
- **Critically damped** (b = 2√(k·m)): reaches target as fast as possible without overshoot
- **Overdamped** (b > 2√(k·m)): slowly approaches target without overshoot (sluggish)

For a spring with `k = 320, m = 1`:
- Critical damping: `b = 2 * √320 ≈ 35.8`
- Slightly underdamped (natural feel): `b ≈ 24`
- Noticeably bouncy: `b ≈ 12`

### Mass (`m`)

Controls inertia — how quickly the spring responds to a new target.

- `m = 1` (default): standard response
- `m = 2`: heavier, more inertia — panels that feel physically large
- `m = 0.5`: light, reactive — small UI elements

---

## Preset configurations

```typescript
// Snappy: buttons, small controls
{ stiffness: 460, damping: 30 }

// Default: card hover, standard UI transitions
{ stiffness: 320, damping: 24 }

// Smooth: panels, drawers, content areas
{ stiffness: 200, damping: 20 }

// Gentle: large surfaces, modals opening
{ stiffness: 120, damping: 18 }

// Bouncy: notifications, playful interactions
{ stiffness: 200, damping: 10 }

// Heavy: objects that feel physically substantial
{ stiffness: 100, damping: 14, mass: 2 }
```

---

## How springs differ from CSS transitions

CSS `transition: transform 0.3s ease-out`:
- Duration is fixed. Interrupting mid-animation causes a discontinuity.
- The easing curve is an approximation of physical motion.
- Cannot respond to velocity (dragging an element then releasing).

Spring `{ stiffness: 320, damping: 24 }`:
- Duration is emergent from the physics. Settles when it settles.
- Interruption is seamless — the spring continues from its current velocity.
- Drag-and-release produces natural momentum deceleration.
- Multiple springs compose: hover + press springs sum naturally.

---

## Page-flip physics (v1 implementation plan)

A tactile book page turn requires:

### 1. Fold point tracking
The fold is a vertical line at `x = foldX`, following the user's drag position. As the user drags left from the right edge, `foldX` moves left.

```
foldX = pageRight - dragDistance
```

### 2. Page geometry split
The flipping page is rendered in two sections:
- **Right of fold**: the front face of the page (visible, not yet revealed)
- **Left of fold**: the back face of the page (the underside, mirrored)

### 3. 3D perspective illusion (Canvas 2D)
The left section (flipped portion) is rendered with a horizontal compression that increases as `foldX` approaches the spine. This simulates perspective foreshortening:

```
compressionRatio = (foldX - spineX) / pageWidth   // 0 at spine, 1 at full open
scaleX = compressionRatio                           // compress width as it folds
```

Applied using `ctx.transform(compressionRatio, 0, 0, 1, spineX, 0)` before drawing the back face.

### 4. Fold shadow gradient
A linear gradient across the fold:
- 8px to the right of `foldX`: white/transparent (highlight on the front face edge)
- At `foldX`: no gradient
- 8px to the left of `foldX`: dark/transparent (shadow on the back face)

### 5. Spring release
When the user releases:
- If `foldX < pageWidth * 0.4` (dragged past 40%): spring to `foldX = spineX` (complete the turn)
- Otherwise: spring to `foldX = pageRight` (snap back)

Spring config for page turn: `{ stiffness: 180, damping: 22 }` — smooth, slightly heavy.

### 6. Page stack
Pages are rendered in z-order. The "current" page is at the top. When a flip completes, the page is moved in the stack.

---

## Drag with momentum (v1)

Track velocity during drag:
```
velocity.x = (currentX - lastX) / dt
velocity.y = (currentY - lastY) / dt
```

On release, set a spring with high damping and current velocity as the initial velocity:
```typescript
spring.velocity = releaseVelocity
spring.target   = snapTarget      // nearest snap point
spring.stiffness = 80             // gentle — let momentum carry it
spring.damping   = 16             // moderate friction
```

This produces momentum scroll, flick-to-dismiss, and all the "throw" interactions that make mobile UIs feel physical.

---

## The tactile quality explained

When a CSS button is clicked, it transitions instantly or along a fixed curve. The user's hand knows this isn't right — real physical objects don't behave that way.

When an Axiom button is pressed, a spring with stiffness 460 and damping 30 pulls it 2px downward in ~16ms. The user releases; the spring with the same parameters pulls it back, overshooting by ~0.3px before settling. The total motion takes ~80ms.

That 0.3px overshoot is the difference between "button animation" and "button press". The brain's haptic prediction model expects that behavior. When it receives it, the interaction feels physical rather than digital.

Springs produce this naturally. No keyframes. No hand-tuned cubic-bezier. Just `F = -kx - bv`.
