import { describe, it, expect } from 'vitest'
import { Spring, Spring2D, createNodeSpring } from './physics.js'

// Helper: advance a spring by N frames at a fixed timestep
function stepN(spring: Spring, frames: number, dt = 1 / 60): void {
  for (let i = 0; i < frames; i++) spring.step(dt)
}

// Helper: run until settled (max 10 s at 60fps = 600 frames)
function stepUntilSettled(spring: Spring, maxFrames = 600, dt = 1 / 60): boolean {
  for (let i = 0; i < maxFrames; i++) {
    if (!spring.step(dt)) return true
  }
  return false
}

describe('Spring', () => {
  it('initialises at rest', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    expect(s.position).toBe(0)
    expect(s.velocity).toBe(0)
    expect(s.target).toBe(0)
    expect(s.isSettled).toBe(true)
  })

  it('snap() teleports without animation', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    s.snap(42)
    expect(s.position).toBe(42)
    expect(s.velocity).toBe(0)
    expect(s.target).toBe(42)
    expect(s.isSettled).toBe(true)
    // step() should immediately return false (already settled)
    expect(s.step(1 / 60)).toBe(false)
  })

  it('moves toward target after setTarget()', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    s.setTarget(100)
    stepN(s, 5)
    expect(s.position).toBeGreaterThan(0)
    expect(s.position).toBeLessThan(100)
  })

  it('eventually settles at target', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    s.setTarget(50)
    const settled = stepUntilSettled(s)
    expect(settled).toBe(true)
    expect(s.position).toBe(50)
    expect(s.velocity).toBe(0)
    expect(s.isSettled).toBe(true)
  })

  it('step() returns false once settled', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    s.setTarget(10)
    let lastResult = true
    for (let i = 0; i < 600; i++) {
      lastResult = s.step(1 / 60)
      if (!lastResult) break
    }
    expect(lastResult).toBe(false)
    // subsequent steps should also return false
    expect(s.step(1 / 60)).toBe(false)
  })

  it('preserves velocity when target changes mid-animation', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    s.setTarget(100)
    stepN(s, 10) // build up velocity
    const velocityBefore = s.velocity
    expect(velocityBefore).toBeGreaterThan(0)

    // Redirect target; velocity must survive
    s.setTarget(0)
    const velocityAfter = s.velocity
    expect(velocityAfter).toBe(velocityBefore) // setTarget doesn't zero velocity
  })

  it('underdamped spring overshoots target', () => {
    // damping=10 with stiffness=200 is underdamped → expect overshoot
    const s = new Spring({ stiffness: 200, damping: 10 })
    s.setTarget(50)
    let maxPos = 0
    for (let i = 0; i < 600; i++) {
      s.step(1 / 60)
      if (s.position > maxPos) maxPos = s.position
      if (s.isSettled) break
    }
    expect(maxPos).toBeGreaterThan(50)
  })

  it('overdamped spring does not overshoot', () => {
    // critically damped: damping >= 2*sqrt(stiffness*mass), here 2*sqrt(200)≈28.3
    const s = new Spring({ stiffness: 200, damping: 40 })
    s.setTarget(50)
    let maxPos = 0
    for (let i = 0; i < 600; i++) {
      s.step(1 / 60)
      if (s.position > maxPos) maxPos = s.position
      if (s.isSettled) break
    }
    expect(maxPos).toBeLessThanOrEqual(50 + 0.01)
  })

  it('configure() updates spring parameters', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    s.configure({ stiffness: 400, damping: 28 })
    expect(s.stiffness).toBe(400)
    expect(s.damping).toBe(28)
  })

  it('mass defaults to 1 when not provided', () => {
    const s = new Spring({ stiffness: 200, damping: 20 })
    expect(s.mass).toBe(1)
  })

  it('mass option is respected', () => {
    const s = new Spring({ stiffness: 100, damping: 14, mass: 2 })
    expect(s.mass).toBe(2)
  })
})

describe('Spring2D', () => {
  it('initialises both axes at rest', () => {
    const s = new Spring2D({ stiffness: 200, damping: 20 })
    expect(s.x.position).toBe(0)
    expect(s.y.position).toBe(0)
    expect(s.isSettled).toBe(true)
  })

  it('setTarget() animates both axes independently', () => {
    const s = new Spring2D({ stiffness: 200, damping: 20 })
    s.setTarget(80, 40)
    for (let i = 0; i < 5; i++) s.step(1 / 60)
    expect(s.x.position).toBeGreaterThan(0)
    expect(s.y.position).toBeGreaterThan(0)
  })

  it('snap() teleports both axes', () => {
    const s = new Spring2D({ stiffness: 200, damping: 20 })
    s.snap(10, 20)
    expect(s.x.position).toBe(10)
    expect(s.y.position).toBe(20)
    expect(s.isSettled).toBe(true)
  })

  it('step() returns true while either axis is still moving', () => {
    const s = new Spring2D({ stiffness: 200, damping: 20 })
    s.setTarget(100, 0) // only x axis moves
    const moving = s.step(1 / 60)
    expect(moving).toBe(true)
  })

  it('eventually settles at target on both axes', () => {
    const s = new Spring2D({ stiffness: 200, damping: 20 })
    s.setTarget(30, 70)
    let settled = false
    for (let i = 0; i < 600; i++) {
      if (!s.step(1 / 60)) {
        settled = true
        break
      }
    }
    expect(settled).toBe(true)
    expect(s.x.position).toBe(30)
    expect(s.y.position).toBe(70)
  })
})

describe('createNodeSpring', () => {
  it('returns a NodeSpring with two independent Spring instances', () => {
    const config = { stiffness: 300, damping: 24 }
    const ns = createNodeSpring(config)
    expect(ns.dx).toBeInstanceOf(Spring)
    expect(ns.dy).toBeInstanceOf(Spring)
    expect(ns.config).toBe(config)
  })

  it('dx and dy are independent springs', () => {
    const ns = createNodeSpring({ stiffness: 200, damping: 20 })
    ns.dx.setTarget(50)
    stepN(ns.dx, 5)
    // dy should be unaffected
    expect(ns.dy.position).toBe(0)
    expect(ns.dx.position).toBeGreaterThan(0)
  })
})
