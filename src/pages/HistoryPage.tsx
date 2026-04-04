import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { WorkoutSession } from '../types/index'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 운동 기록을 삭제할까요?')) return
    await supabase.from('workout_sets').delete().eq('session_id', sessionId)
    await supabase.from('workout_sessions').delete().eq('id', sessionId)
    fetchSessions()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const getDuration = (session: WorkoutSession) => {
    if (!session.ended_at) return '-'
    const diff = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
    return `${Math.floor(diff / 60000)}분`
  }

  const toDateKey = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const workoutDates = new Set(sessions.map(s => toDateKey(s.started_at)))

  const selectedSessions = selectedDate
    ? sessions.filter(s => toDateKey(s.started_at) === selectedDate)
    : []

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = toDateKey(new Date().toISOString())

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

  const days = ['일', '월', '화', '수', '목', '금', '토']

  const monthSessions = sessions.filter(s => {
    const d = new Date(s.started_at)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const SessionCard = ({ session }: { session: WorkoutSession }) => (
    <div
      onClick={() => navigate(`/workout/${session.id}`)}
      className="session-card px-4 py-3.5 flex items-center justify-between cursor-pointer"
    >
      <div>
        <p className="font-bold text-white text-sm">{formatDate(session.started_at)}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {formatTime(session.started_at)} · {getDuration(session)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-display text-lg" style={{ color: 'var(--accent)' }}>
            {session.total_volume_kg.toLocaleString()}kg
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {Math.round(session.total_calories)} kcal
          </p>
        </div>
        <button
          onClick={(e) => deleteSession(session.id, e)}
          className="text-base px-1 opacity-60 hover:opacity-90 transition-opacity"
        >🗑️</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="px-5 pt-8 pb-4">
        <h1 className="font-display text-4xl" style={{ color: 'var(--accent)' }}>기록</h1>
      </div>

      {/* 캘린더 */}
      <div className="mx-5 mb-5 card p-4">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}>‹</button>
          <p className="font-bold text-white">{year}년 {month + 1}월</p>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}>›</button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {days.map((d, i) => (
            <p key={d} className="text-center text-xs py-1 font-medium"
              style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#60a5fa' : 'var(--text-dim)' }}>
              {d}
            </p>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-2">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasWorkout = workoutDates.has(dateKey)
            const isToday = dateKey === today
            const isSelected = dateKey === selectedDate

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className="flex flex-col items-center gap-1"
              >
                <span className="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: isSelected ? 'var(--accent)' : hasWorkout && !isToday ? 'rgba(249,115,22,0.12)' : isToday ? 'var(--accent-dim)' : 'transparent',
                    color: isSelected ? 'white' : isToday ? 'var(--accent)' : hasWorkout ? 'var(--accent)' : 'var(--text-primary)',
                    border: isToday && !isSelected ? '1px solid var(--accent)' : '1px solid transparent'
                  }}>
                  {day}
                </span>
                {hasWorkout && (
                  <span className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isSelected ? 'white' : 'var(--accent)' }} />
                )}
                {!hasWorkout && <span className="w-1.5 h-1.5" />}
              </button>
            )
          })}
        </div>

        {/* 이번 달 운동 횟수 */}
        <div className="mt-3 pt-3 flex justify-between items-center"
          style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>이번 달 운동</p>
          <p className="font-display text-lg" style={{ color: 'var(--accent)' }}>{monthSessions.length}회</p>
        </div>
      </div>

      {/* 세션 목록 */}
      <div className="px-5">
        {selectedDate ? (
          <>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              {parseInt(selectedDate.split('-')[1])}월 {parseInt(selectedDate.split('-')[2])}일
            </p>
            {selectedSessions.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: 'var(--text-dim)' }}>
                운동 기록이 없어요
              </p>
            ) : (
              <div className="space-y-2">
                {selectedSessions.map(session => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              {year}년 {month + 1}월 기록
            </p>
            {loading ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>로딩 중...</p>
            ) : monthSessions.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: 'var(--text-dim)' }}>
                이번 달 운동 기록이 없어요
              </p>
            ) : (
              <div className="space-y-2">
                {monthSessions.map(session => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
