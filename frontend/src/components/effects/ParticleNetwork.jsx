import { useEffect, useRef } from 'react'

const NODE_COUNT = 75
const MAX_DIST = 140
const MOUSE_REPEL_RADIUS = 110
const BASE_SPEED = 0.25
const SPECIAL_EVERY = 9   // every Nth node is a "case" node

function rand(a, b) { return a + Math.random() * (b - a) }

export default function ParticleNetwork({ opacity = 1 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let W = window.innerWidth
    let H = window.innerHeight
    let mouseX = -1000
    let mouseY = -1000
    let animId

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width  = W
      canvas.height = H
    }
    resize()

    // ── Build nodes ──────────────────────────────────────────────────────────
    const nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
      const baseR = rand(1.5, 3.5)
      return {
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-BASE_SPEED, BASE_SPEED),
        vy: rand(-BASE_SPEED, BASE_SPEED),
        baseR,
        r: baseR,
        phase: rand(0, Math.PI * 2),
        hue: rand(215, 285),         // indigo → violet range
        sat: rand(60, 90),
        lit: rand(60, 80),
        alpha: rand(0.45, 0.9),
        special: i % SPECIAL_EVERY === 0,
        ringAlpha: 0,
      }
    })

    function onMouseMove(e) { mouseX = e.clientX; mouseY = e.clientY }
    function onMouseLeave()  { mouseX = -1000;    mouseY = -1000     }
    window.addEventListener('mousemove',  onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('resize',     resize)

    let t = 0

    function frame() {
      t++
      ctx.clearRect(0, 0, W, H)

      // ── Update nodes ─────────────────────────────────────────────────────
      for (const n of nodes) {
        const dx = n.x - mouseX
        const dy = n.y - mouseY
        const d2 = dx * dx + dy * dy
        if (d2 < MOUSE_REPEL_RADIUS * MOUSE_REPEL_RADIUS) {
          const d    = Math.sqrt(d2) || 1
          const force = ((MOUSE_REPEL_RADIUS - d) / MOUSE_REPEL_RADIUS) * 1.2
          n.vx += (dx / d) * force * 0.08
          n.vy += (dy / d) * force * 0.08
        }

        n.vx *= 0.988
        n.vy *= 0.988
        n.x  += n.vx
        n.y  += n.vy

        // Speed cap
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (spd > BASE_SPEED * 4) { n.vx *= BASE_SPEED * 4 / spd; n.vy *= BASE_SPEED * 4 / spd }

        // Soft-bounce walls
        if (n.x < 0)  { n.x = 0;  n.vx =  Math.abs(n.vx) }
        if (n.x > W)  { n.x = W;  n.vx = -Math.abs(n.vx) }
        if (n.y < 0)  { n.y = 0;  n.vy =  Math.abs(n.vy) }
        if (n.y > H)  { n.y = H;  n.vy = -Math.abs(n.vy) }

        // Pulse radius
        n.phase += 0.018
        n.r = n.baseR + Math.sin(n.phase) * 0.6
      }

      // ── Draw edges ───────────────────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b   = nodes[j]
          const ex  = a.x - b.x
          const ey  = a.y - b.y
          const ed  = Math.sqrt(ex * ex + ey * ey)
          if (ed < MAX_DIST) {
            const edgeAlpha = (1 - ed / MAX_DIST) * 0.28
            const hue = (a.hue + b.hue) / 2
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `hsla(${hue},75%,70%,${edgeAlpha})`
            ctx.lineWidth   = 0.9
            ctx.stroke()
          }
        }
      }

      // ── Draw nodes ───────────────────────────────────────────────────────
      for (const n of nodes) {
        // Core dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${n.hue},${n.sat}%,${n.lit}%,${n.alpha})`
        ctx.fill()

        if (n.special) {
          // Animated outer ring
          const ringR = n.r + 4 + Math.sin(n.phase * 1.4) * 1.5
          ctx.beginPath()
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `hsla(${n.hue},80%,75%,${n.alpha * 0.35})`
          ctx.lineWidth = 1
          ctx.stroke()

          // Radial glow
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 7)
          grd.addColorStop(0, `hsla(${n.hue},80%,75%,${n.alpha * 0.22})`)
          grd.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r * 7, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }
      }

      animId = requestAnimationFrame(frame)
    }

    animId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove',  onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('resize',     resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none select-none"
      style={{ opacity, zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
