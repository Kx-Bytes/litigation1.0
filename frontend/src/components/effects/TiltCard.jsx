import { useRef, useState } from 'react'

/**
 * Wraps children in a 3-D perspective tilt container.
 * On hover: tilts toward the cursor + renders a glare sheen.
 */
export default function TiltCard({
  children,
  className = '',
  intensity = 12,    // max tilt degrees
  glareMax  = 0.18,  // max glare opacity
}) {
  const ref = useRef(null)
  const [style,  setStyle]  = useState({})
  const [glare,  setGlare]  = useState({ x: 50, y: 50, opacity: 0 })
  const rafId = useRef(null)

  function onMouseMove(e) {
    if (!ref.current) return
    const rect   = ref.current.getBoundingClientRect()
    const relX   = (e.clientX - rect.left) / rect.width   // 0‥1
    const relY   = (e.clientY - rect.top)  / rect.height  // 0‥1
    const rotX   = (0.5 - relY) * intensity
    const rotY   = (relX - 0.5) * intensity

    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      setStyle({
        transform: `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02,1.02,1.02)`,
        transition: 'none',
      })
      setGlare({ x: relX * 100, y: relY * 100, opacity: glareMax })
    })
  }

  function onMouseLeave() {
    cancelAnimationFrame(rafId.current)
    setStyle({
      transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      transition: 'transform 0.55s cubic-bezier(.23,1,.32,1)',
    })
    setGlare(g => ({ ...g, opacity: 0 }))
  }

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ ...style, transformStyle: 'preserve-3d' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Glare layer */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[inherit] pointer-events-none overflow-hidden"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}), transparent 60%)`,
          opacity: 1,
          transition: glare.opacity === 0 ? 'opacity 0.55s ease' : 'none',
          borderRadius: 'inherit',
        }}
      />
      {children}
    </div>
  )
}
