import { useState, useEffect } from 'react'

const STORAGE_KEY = 'openpaws_query_history'
const MAX_HISTORY = 20

export function useQueryHistory() {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  }, [history])

  function addEntry(query, result) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      query,
      result,
    }
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY))
  }

  function clearHistory() {
    setHistory([])
  }

  function removeEntry(id) {
    setHistory(prev => prev.filter(e => e.id !== id))
  }

  return { history, addEntry, clearHistory, removeEntry }
}
