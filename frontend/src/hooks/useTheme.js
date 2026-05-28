import { useLayoutEffect, useState } from 'react'

const STORAGE_KEY = 'openpaws_theme'

function getPreferredTheme() {
  // Local storage wins, then OS preference, then dark.
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }

  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch {
    // ignore
  }

  return 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState(() => getPreferredTheme())

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}

