/**
 * Axiom — entry. Default: book demo. Query: ?demo=editorial | ?demo=dense | ?demo=water
 */

import { BookDemo } from './book-demo.js'
import { EditorialDemo } from './demos/editorial-demo.js'
import { DenseGridDemo } from './demos/dense-grid-demo.js'
import { WaterClockDemo } from './demos/water-clock-demo.js'

type Demo = { start(): void; destroy(): void }

const canvas = document.getElementById('c') as HTMLCanvasElement

function setupCanvas(): void {
  const dpr = window.devicePixelRatio ?? 1
  const vw = window.innerWidth
  const vh = window.innerHeight

  canvas.width = vw * dpr
  canvas.height = vh * dpr
  canvas.style.width = `${vw}px`
  canvas.style.height = `${vh}px`

  canvas.getContext('2d')!.scale(dpr, dpr)
}

function createDemo(): Demo {
  const mode = new URLSearchParams(window.location.search).get('demo') ?? 'book'
  if (mode === 'editorial') return new EditorialDemo(canvas)
  if (mode === 'dense') return new DenseGridDemo(canvas)
  if (mode === 'water') return new WaterClockDemo(canvas)
  return new BookDemo(canvas)
}

setupCanvas()

let demo = createDemo()
demo.start()

window.addEventListener('resize', () => {
  demo.destroy()
  setupCanvas()
  demo = createDemo()
  demo.start()
})
