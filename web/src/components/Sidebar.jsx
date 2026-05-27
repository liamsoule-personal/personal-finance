import { useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../lib/api'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekRange(weekStart, weekEnd) {
  const sMonth = MONTH_SHORT[weekStart.getMonth()]
  const eMonth = MONTH_SHORT[weekEnd.getMonth()]
  const sDay = weekStart.getDate()
  const eDay = weekEnd.getDate()
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}`
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`
}

function CalendarGrid({ calYear, calMonth, weekStart, setWeekStart }) {
  // Build weeks for this month view
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // First day of month
  const firstDay = new Date(calYear, calMonth, 1)
  // Start from the Monday of that week
  const startMonday = getMondayOfWeek(firstDay)

  const weeks = []
  let cur = new Date(startMonday)

  // Generate up to 6 weeks
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    // Include week if any day is in our month
    if (week.some(d => d.getMonth() === calMonth)) {
      weeks.push(week)
    }
    if (cur.getMonth() > calMonth && cur.getFullYear() >= calYear) break
  }

  const selectedMonday = getMondayOfWeek(weekStart)
  const selectedStr = selectedMonday.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        marginBottom: 2
      }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: '#9CA3AF',
            padding: '2px 0'
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => {
        const weekMonday = week[0]
        const weekMondayStr = weekMonday.toISOString().split('T')[0]
        const isSelected = weekMondayStr === selectedStr

        return (
          <div
            key={wi}
            onClick={() => setWeekStart(new Date(weekMonday))}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              cursor: 'pointer',
              borderRadius: 6,
              marginBottom: 1,
              background: isSelected ? '#1B2B6B' : 'transparent',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => {
              if (!isSelected) e.currentTarget.style.background = '#F0F3FF'
            }}
            onMouseLeave={e => {
              if (!isSelected) e.currentTarget.style.background = 'transparent'
            }}
          >
            {week.map((day, di) => {
              const dayStr = day.toISOString().split('T')[0]
              const isToday = dayStr === todayStr
              const inMonth = day.getMonth() === calMonth

              return (
                <div key={di} style={{
                  textAlign: 'center',
                  padding: '4px 2px',
                  position: 'relative'
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 400,
                    color: isSelected
                      ? '#fff'
                      : inMonth
                        ? isToday ? '#1B2B6B' : '#374151'
                        : '#D1D5DB',
                    display: 'block',
                    lineHeight: 1.4
                  }}>
                    {day.getDate()}
                  </span>
                  {isToday && !isSelected && (
                    <span style={{
                      position: 'absolute',
                      bottom: 1,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#1B2B6B',
                      display: 'block'
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default function Sidebar({
  weekStart, weekStartStr, weekEnd,
  prevWeek, nextWeek, goToCurrentWeek, isCurrentWeek, setWeekStart
}) {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)
  const [syncError, setSyncError] = useState(null)

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      await api.post('/sync', {})
      setLastSynced(new Date())
    } catch (e) {
      setSyncError('Sync failed')
      console.error(e)
    } finally {
      setSyncing(false)
    }
  }, [])

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const weekRange = formatWeekRange(weekStart, weekEnd)

  const navLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    color: isActive ? '#1B2B6B' : '#6B7280',
    background: isActive ? '#EEF2FF' : 'transparent',
    borderLeft: isActive ? '3px solid #1B2B6B' : '3px solid transparent',
    transition: 'all 0.15s',
    marginBottom: 2
  })

  return (
    <div style={{
      width: 240,
      minWidth: 240,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: '#fff',
      boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 100
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            background: '#1B2B6B',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0
          }}>
            📒
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1B2B6B', letterSpacing: '-0.3px' }}>
            Weekly Ledger
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '0 12px', marginBottom: 8 }}>
        <NavLink to="/" end style={navLinkStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Dashboard
        </NavLink>
        <NavLink to="/transactions" style={navLinkStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          All Transactions
        </NavLink>
      </nav>

      {/* Week navigation */}
      <div style={{
        borderTop: '1px solid #F3F4F6',
        padding: '16px 16px 12px'
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#9CA3AF',
          marginBottom: 8
        }}>
          Current Week
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={prevWeek}
            style={{
              background: 'none', border: '1px solid #E5E7EB',
              borderRadius: 6, padding: '4px 8px',
              cursor: 'pointer', color: '#6B7280', fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            ←
          </button>
          <div style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: '#1A1A2E'
          }}>
            {weekRange}
          </div>
          <button
            onClick={nextWeek}
            style={{
              background: 'none', border: '1px solid #E5E7EB',
              borderRadius: 6, padding: '4px 8px',
              cursor: 'pointer', color: '#6B7280', fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            →
          </button>
        </div>
        {!isCurrentWeek && (
          <button
            onClick={goToCurrentWeek}
            style={{
              marginTop: 8,
              width: '100%',
              background: 'none',
              border: '1px solid #E5E7EB',
              borderRadius: 6,
              padding: '5px 0',
              cursor: 'pointer',
              fontSize: 12,
              color: '#1B2B6B',
              fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F0F3FF'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            Today
          </button>
        )}
      </div>

      {/* Mini calendar */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Month header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 16px 8px',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={prevMonth}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', fontSize: 14, padding: '2px 4px',
              fontFamily: 'Inter, sans-serif',
              borderRadius: 4, transition: 'background 0.1s, color 0.1s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#1A1A2E' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
          >
            ‹
          </button>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            {MONTH_NAMES[calMonth]} {calYear}
          </div>
          <button
            onClick={nextMonth}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', fontSize: 14, padding: '2px 4px',
              fontFamily: 'Inter, sans-serif',
              borderRadius: 4, transition: 'background 0.1s, color 0.1s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#1A1A2E' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
          >
            ›
          </button>
        </div>

        <CalendarGrid
          calYear={calYear}
          calMonth={calMonth}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
        />
      </div>

      {/* Sync section */}
      <div style={{
        borderTop: '1px solid #F3F4F6',
        padding: 16,
        flexShrink: 0
      }}>
        {syncError && (
          <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 8 }}>{syncError}</div>
        )}
        {lastSynced && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
            Last synced: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            width: '100%',
            background: syncing ? '#F3F4F6' : '#1B2B6B',
            color: syncing ? '#9CA3AF' : '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            cursor: syncing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s'
          }}
        >
          {syncing ? (
            <>
              <span style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                border: '2px solid #D1D5DB',
                borderTopColor: '#9CA3AF',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Syncing...
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Sync Transactions
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
