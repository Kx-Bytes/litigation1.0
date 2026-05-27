import { useEffect, useRef } from 'react'

/**
 * Custom cursor: a soft indigo ring that lags behind the pointer
 * plus a crisp dot that snaps instantly.
 * Expands when hovering over interactive elements.
 */
export default function CursorGlow() {
  const ringRef = useRef(null)
  const dotRef  = useRef(null)
  const trailRef = useRef(null)

  useEffect(() => {
    const ring  = ringRef.current
    const dot   = dotRef.current
    const trail = trailRef.current
    if (!ring || !dot) return

    let mx = -200, my = -200
    let rx = -200, ry = -200
    let tx = -200, ty = -200
    let hovering = false
    let clicking = false
    let animId

    function onMove(e) { mx = e.clientX; my = e.clientY }
    function onDown()  { clicking = true  }
    function onUp()    { clicking = false }

    function onOver(e) {
      hovering = !!(e.target.closest('button, a, input, textarea, select, [role="button"], label'))
    }

    window.addEventListener('mousemove',  onMove)
    window.addEventListener('mouseover',  onOver)
    window.addEventListener('mousedown',  onDown)
    window.addEventListener('mouseup',    onUp)

    function animate() {
      // Ring lags behind
      rx += (mx - rx) * 0.11
      ry += (my - ry) * 0.11

      // Trail slightly faster lag
      tx += (mx - tx) * 0.06
      ty += (my - ty) * 0.06

      const ringSize  = hovering ? 44 : clicking ? 20 : 32
      const halfRing  = ringSize / 2

      ring.style.transform = `translate(${rx - halfRing}px, ${ry - halfRing}px)`
      ring.style.width     = `${ringSize}px`
      ring.style.height    = `${ringSize}px`
      ring.style.opacity   = hovering ? '0.9' : '0.6'

      dot.style.transform  = `translate(${mx - 3}px, ${my - 3}px)`
      dot.style.transform  += clicking ? ' scale(0.5)' : ''

      if (trail) {
        trail.style.transform = `translate(${tx - 20}px, ${ty - 20}px)`
      }

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  return (
    <>
      {/* Trailing glow blob */}
      <div
        ref={trailRef}
        className="fixed top-0 left-0 w-10 h-10 rounded-full pointer-events-none select-none"
        style={{
          zIndex: 9997,
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          willChange: 'transform',
        }}
        aria-hidden="true"
      />

      {/* Ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 rounded-full pointer-events-none select-none"
        style={{
          zIndex: 9998,
          border: '1.5px solid rgba(129,140,248,0.7)',
          boxShadow: '0 0 8px rgba(99,102,241,0.3), inset 0 0 6px rgba(99,102,241,0.08)',
          willChange: 'transform, width, height',
          transition: 'width 0.15s ease, height 0.15s ease, opacity 0.15s ease',
        }}
        aria-hidden="true"
      />

      {/* Dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full pointer-events-none select-none"
        style={{
          zIndex: 9999,
          background: 'rgba(165,180,252,1)',
          boxShadow: '0 0 6px 2px rgba(99,102,241,0.6)',
          willChange: 'transform',
          transition: 'transform 0.08s ease',
        }}
        aria-hidden="true"
      />
    </>
  )
}
