/**
 * Axiom Physics Engine
 *
 * Implements Hooke's law spring dynamics using semi-implicit Euler integration.
 *
 * The governing equation:
 *   F = -k * (position - target) - b * velocity
 *   a = F / mass
 *   velocity += a * dt
 *   position += velocity * dt
 *
 * This produces motion that:
 *   - Accelerates toward the target (spring force)
 *   - Naturally decelerates and optionally overshoots (damping)
 *   - Settles precisely at the target
 *
 * CSS easing curves (ease-in-out, cubic-bezier) are approximations.
 * Springs are physically correct. They compose, chain, and respond to
 * interruption naturally — changing the target mid-animation produces
 * smooth continuous motion, not a jarring restart.
 */

import type { SpringConfig } from './types.js'

const SETTLE_VELOCITY = 0.01 // px/s — below this, consider velocity zero
const SETTLE_DISTANCE = 0.01 // px — below this, snap to target

export class Spring {
  stiffness: number
  damping: number
  mass: number
  position: number
  velocity: number
  target: number

  constructor(config: SpringConfig = { stiffness: 200, damping: 20 }) {
    this.stiffness = config.stiffness
    this.damping = config.damping
    this.mass = config.mass ?? 1
    this.position = 0
    this.velocity = 0
    this.target = 0
  }

  configure(config: SpringConfig): void {
    this.stiffness = config.stiffness
    this.damping = config.damping
    this.mass = config.mass ?? this.mass
  }

  setTarget(target: number): void {
    this.target = target
  }

  // Teleport to position without animation
  snap(position: number): void {
    this.position = position
    this.velocity = 0
    this.target = position
  }

  // Returns true if the spring is still in motion
  step(dt: number): boolean {
    const displacement = this.position - this.target
    const springForce = -this.stiffness * displacement
    const dampingForce = -this.damping * this.velocity
    const acceleration = (springForce + dampingForce) / this.mass

    this.velocity += acceleration * dt
    this.position += this.velocity * dt

    const settled =
      Math.abs(this.velocity) < SETTLE_VELOCITY &&
      Math.abs(this.position - this.target) < SETTLE_DISTANCE

    if (settled) {
      this.position = this.target
      this.velocity = 0
      return false
    }

    return true
  }

  get isSettled(): boolean {
    return (
      Math.abs(this.velocity) < SETTLE_VELOCITY &&
      Math.abs(this.position - this.target) < SETTLE_DISTANCE
    )
  }
}

/**
 * A 2-dimensional spring. Useful for animating position (x, y together).
 */
export class Spring2D {
  x: Spring
  y: Spring

  constructor(config: SpringConfig = { stiffness: 200, damping: 20 }) {
    this.x = new Spring(config)
    this.y = new Spring(config)
  }

  configure(config: SpringConfig): void {
    this.x.configure(config)
    this.y.configure(config)
  }

  setTarget(x: number, y: number): void {
    this.x.setTarget(x)
    this.y.setTarget(y)
  }

  snap(x: number, y: number): void {
    this.x.snap(x)
    this.y.snap(y)
  }

  step(dt: number): boolean {
    return this.x.step(dt) || this.y.step(dt)
  }

  get isSettled(): boolean {
    return this.x.isSettled && this.y.isSettled
  }
}

/**
 * Manages the spring state for a single scene node.
 * A node can have its x and y positions independently spring-animated.
 */
export type NodeSpring = {
  dx: Spring
  dy: Spring
  config: SpringConfig
}

export function createNodeSpring(config: SpringConfig): NodeSpring {
  return {
    dx: new Spring(config),
    dy: new Spring(config),
    config,
  }
}
