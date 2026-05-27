import { useState } from 'react'

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

export function useWeek() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek())

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const prevWeek = () => setWeekStart(d => {
    const n = new Date(d)
    n.setDate(n.getDate() - 7)
    return n
  })

  const nextWeek = () => setWeekStart(d => {
    const n = new Date(d)
    n.setDate(n.getDate() + 7)
    return n
  })

  const goToCurrentWeek = () => setWeekStart(getMondayOfWeek())

  const isCurrentWeek = getMondayOfWeek().toISOString().split('T')[0] === weekStartStr

  return {
    weekStart,
    weekStartStr,
    weekEnd,
    weekEndStr,
    setWeekStart,
    prevWeek,
    nextWeek,
    goToCurrentWeek,
    isCurrentWeek
  }
}
