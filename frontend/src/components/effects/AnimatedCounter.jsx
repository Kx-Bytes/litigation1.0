import { useEffect, useRef, useState } from 'react'

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

/**
 * Count up from 0 to `end` when the element enters the viewport.
 * @param {number}  end       - Target value
 * @param {string}  [suffix]  - Appended string (e.g. '+', '%')
 * @param {number}  [duration]- Animation duration ms
 */
export function useCountUp(end, { suffix = '', duration = 1800 } = {}) {
  const ref       = useRef(null)
  const [val, setVal] = useState(0)
  const played    = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true
          let startTs = null

          function step(ts) {
            if (!startTs) startTs = ts
            const pct      = Math.min((ts - startTs) / duration, 1)
            const eased    = easeOutExpo(pct)
            setVal(Math.round(end * eased))
            if (pct < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return { ref, display: `${val}${suffix}` }
}

/**
 * Drop-in animated counter component.
 */
export default function AnimatedCounter({ value, suffix = '', duration = 1800, className = '' }) {
  const { ref, display } = useCountUp(value, { suffix, duration })
  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}
