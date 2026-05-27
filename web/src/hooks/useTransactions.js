import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useTransactions(weekStartStr) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(() => {
    if (!weekStartStr) return
    setLoading(true)
    api.get(`/transactions?week_start=${weekStartStr}`)
      .then(data => {
        setTransactions(data)
        setError(null)
      })
      .catch(e => setError(e))
      .finally(() => setLoading(false))
  }, [weekStartStr])

  useEffect(() => { refetch() }, [refetch])

  const updateTransaction = useCallback(async (id, fields) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t))
    try {
      await api.patch(`/transactions/${id}`, fields)
      refetch()
    } catch {
      refetch()
    }
  }, [refetch])

  return { transactions, loading, error, refetch, updateTransaction }
}
