import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface VolumeData {
  date: string
  volume: number
}

interface E1RMData {
  date: string
  e1rm: number
}

interface DayBubble {
  label: string
  date: string
  duration: number
  hasWorkout: boolean
}

interface CategoryRow {
  label: string
  category: string
  volume: number
  sets: number
}

interface WeeklyStats {
  totalMinutes: number
  dayBubbles: DayBubble[]
  categoryRows: CategoryRow[]
}

interface MonthlyStats {
  totalMinutes: number
  totalVolume: number
  totalSessions: number
}

interface MonthlyComparison {
  currentAvgMinutes: number
  prevAvgMinutes: number
  currentTotalVolume: number
  prevTotalVolume: number
}

const CATEGORY_MAP = [
  { category: 'legs', label: '하체' },
  { category: 'chest', label: '가슴' },
  { category: 'back', label: '등' },
  { category: 'shoulder', label: '어깨' },
  { category: 'arm', label: '팔' },
  { category: 'core', label: '코어' },
]

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function getMonthRange() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  return { monthStart, prevMonthStart, prevMonthEnd }
}

function formatDateMD(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

function getDurationMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) return 0
  return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
}

export default function StatsPage() {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null)
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null)
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison | null>(null)
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [e1rmData, setE1RMData] = useState<E1RMData[]>([])
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllStats()
    fetchExercises()
  }, [])

  useEffect(() => {
    if (selectedExercise) fetchE1RMData(selectedExercise)
  }, [selectedExercise])

  const fetchAllStats = async () => {
    const { monday, sunday } = getWeekRange()
    const { monthStart, prevMonthStart, prevMonthEnd } = getMonthRange()

    const [
      { data: weeklySessions },
      { data: monthlySessions },
      { data: prevMonthlySessions },
      { data: allSessions },
    ] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, started_at, ended_at')
        .gte('started_at', monday.toISOString())
        .lte('started_at', sunday.toISOString())
        .not('ended_at', 'is', null),
      supabase
        .from('workout_sessions')
        .select('id, started_at, ended_at, total_volume_kg')
        .gte('started_at', monthStart.toISOString())
        .not('ended_at', 'is', null),
      supabase
        .from('workout_sessions')
        .select('id, started_at, ended_at, total_volume_kg')
        .gte('started_at', prevMonthStart.toISOString())
        .lte('started_at', prevMonthEnd.toISOString())
        .not('ended_at', 'is', null),
      supabase
        .from('workout_sessions')
        .select('started_at, total_volume_kg')
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: true })
        .limit(12),
    ])

    // Weekly sets by category
    const weeklySessionIds = (weeklySessions || []).map(s => s.id)
    const categoryAccum: Record<string, { volume: number; sets: number }> = {}

    if (weeklySessionIds.length > 0) {
      const { data: weeklySets } = await supabase
        .from('workout_sets')
        .select('weight_kg, reps, exercise:exercises(category)')
        .in('session_id', weeklySessionIds)

      if (weeklySets) {
        weeklySets.forEach(set => {
          const cat = (set.exercise as any)?.category || 'etc'
          if (!categoryAccum[cat]) categoryAccum[cat] = { volume: 0, sets: 0 }
          categoryAccum[cat].volume += (set.weight_kg || 0) * (set.reps || 0)
          categoryAccum[cat].sets += 1
        })
      }
    }

    // Day bubbles
    const dayBubbles: DayBubble[] = DAY_LABELS.map((label, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = toLocalDateStr(d)
      const daySessions = (weeklySessions || []).filter(s => toLocalDateStr(new Date(s.started_at)) === dateStr)
      const duration = daySessions.reduce((sum, s) => sum + getDurationMinutes(s.started_at, s.ended_at), 0)
      return { label, date: dateStr, duration: Math.round(duration), hasWorkout: daySessions.length > 0 }
    })

    // Category rows
    const categoryRows: CategoryRow[] = CATEGORY_MAP.map(({ category, label }) => ({
      label,
      category,
      volume: Math.round(categoryAccum[category]?.volume || 0),
      sets: categoryAccum[category]?.sets || 0,
    }))

    const weeklyTotalMinutes = (weeklySessions || []).reduce(
      (sum, s) => sum + getDurationMinutes(s.started_at, s.ended_at), 0
    )

    setWeeklyStats({ totalMinutes: Math.round(weeklyTotalMinutes), dayBubbles, categoryRows })

    // Monthly stats
    const monthlyTotalMinutes = (monthlySessions || []).reduce(
      (sum, s) => sum + getDurationMinutes(s.started_at, s.ended_at), 0
    )
    const monthlyTotalVolume = (monthlySessions || []).reduce((sum, s) => sum + (s.total_volume_kg || 0), 0)
    const currCount = (monthlySessions || []).length

    setMonthlyStats({
      totalMinutes: Math.round(monthlyTotalMinutes),
      totalVolume: Math.round(monthlyTotalVolume),
      totalSessions: currCount,
    })

    // Monthly comparison
    const prevCount = (prevMonthlySessions || []).length
    const prevTotalMinutes = (prevMonthlySessions || []).reduce(
      (sum, s) => sum + getDurationMinutes(s.started_at, s.ended_at), 0
    )
    const prevTotalVolume = (prevMonthlySessions || []).reduce((sum, s) => sum + (s.total_volume_kg || 0), 0)

    setMonthlyComparison({
      currentAvgMinutes: currCount > 0 ? Math.round(monthlyTotalMinutes / currCount) : 0,
      prevAvgMinutes: prevCount > 0 ? Math.round(prevTotalMinutes / prevCount) : 0,
      currentTotalVolume: Math.round(monthlyTotalVolume),
      prevTotalVolume: Math.round(prevTotalVolume),
    })

    // Volume chart
    if (allSessions) {
      setVolumeData(allSessions.map(s => ({
        date: `${new Date(s.started_at).getMonth() + 1}/${new Date(s.started_at).getDate()}`,
        volume: s.total_volume_kg,
      })))
    }

    setLoading(false)
  }

  const fetchExercises = async () => {
    const { data } = await supabase
      .from('workout_sets')
      .select('exercise_id, exercise:exercises(id, name)')
      .limit(1000)

    if (data) {
      const unique = new Map()
      data.forEach(row => {
        if (row.exercise && !unique.has(row.exercise_id)) {
          unique.set(row.exercise_id, { id: row.exercise_id, name: (row.exercise as any).name })
        }
      })
      const list = Array.from(unique.values())
      setExercises(list)
      if (list.length > 0) setSelectedExercise(list[0].id)
    }
  }

  const fetchE1RMData = async (exerciseId: string) => {
    const { data } = await supabase
      .from('workout_sets')
      .select('e1rm, created_at')
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: true })

    if (data) {
      const byDate = new Map<string, number>()
      data.forEach(row => {
        const date = `${new Date(row.created_at).getMonth() + 1}/${new Date(row.created_at).getDate()}`
        const cur = byDate.get(date) || 0
        if (row.e1rm > cur) byDate.set(date, row.e1rm)
      })
      setE1RMData(Array.from(byDate.entries()).map(([date, e1rm]) => ({ date, e1rm })))
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)' }} className="text-xs">{label}</p>
          <p className="font-bold text-white">{payload[0].value.toLocaleString()}kg</p>
        </div>
      )
    }
    return null
  }

  const DeltaBadge = ({ curr, prev, unit = '' }: { curr: number; prev: number; unit?: string }) => {
    if (prev === 0) return null
    const diff = curr - prev
    if (diff === 0) return <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>±0{unit}</span>
    const isPos = diff > 0
    return (
      <span className="text-xs ml-2" style={{ color: isPos ? '#3b82f6' : '#ef4444' }}>
        {isPos ? '▲' : '▼'}{Math.abs(diff).toLocaleString()}{unit}
      </span>
    )
  }

  const { monday, sunday } = getWeekRange()
  const weekRangeLabel = `${formatDateMD(monday)} ~ ${formatDateMD(sunday)}`

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="px-5 pb-4" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}>
        <h1 className="font-display text-4xl" style={{ color: 'var(--accent)' }}>통계</h1>
      </div>

      {loading ? (
        <p className="px-5 text-sm" style={{ color: 'var(--text-secondary)' }}>로딩 중...</p>
      ) : (
        <div className="px-5 space-y-6">

          {/* ── 섹션 1: 주간 분석 ── */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <p className="font-bold text-white text-base">주간 분석</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{weekRangeLabel}</p>
            </div>

            {/* 운동 현황 카드 */}
            <div className="card p-4 mb-3">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>총 운동 시간</p>
              <p className="font-bold text-white text-2xl mb-4">
                {weeklyStats ? formatMinutes(weeklyStats.totalMinutes) : '0분'}
              </p>
              <div className="flex justify-between">
                {weeklyStats?.dayBubbles.map((day) => (
                  <div key={day.label} className="flex flex-col items-center gap-1.5">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{day.label}</p>
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 38,
                        height: 38,
                        background: day.hasWorkout ? 'var(--accent)' : 'transparent',
                        border: day.hasWorkout ? 'none' : '1.5px solid var(--border)',
                      }}
                    >
                      {day.hasWorkout && (
                        <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>
                          {day.duration < 60
                            ? `${day.duration}분`
                            : `${Math.floor(day.duration / 60)}h${day.duration % 60 > 0 ? (day.duration % 60) + 'm' : ''}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 부위별 볼륨/세트 수 테이블 */}
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>부위별 운동량</p>
              <div className="flex text-xs pb-2 mb-1" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                <span className="flex-1">부위</span>
                <span className="w-24 text-right">볼륨</span>
                <span className="w-16 text-right">세트 수</span>
              </div>
              {weeklyStats?.categoryRows.map((row) => (
                <div key={row.category} className="flex items-center text-sm py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="flex-1 font-medium text-white">{row.label}</span>
                  <span className="w-24 text-right" style={{ color: row.volume > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {row.volume > 0 ? `${row.volume.toLocaleString()}kg` : '-'}
                  </span>
                  <span className="w-16 text-right" style={{ color: row.sets > 0 ? 'white' : 'var(--text-secondary)' }}>
                    {row.sets > 0 ? `${row.sets}세트` : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 섹션 2: 월간 분석 ── */}
          <div>
            <p className="font-bold text-white text-base mb-3">월간 분석</p>

            {/* 3칸 카드 */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="card p-3 flex flex-col items-center text-center">
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>운동 시간</p>
                <p className="font-bold text-white text-sm">{monthlyStats ? formatMinutes(monthlyStats.totalMinutes) : '-'}</p>
              </div>
              <div className="card p-3 flex flex-col items-center text-center">
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>총 볼륨</p>
                <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
                  {monthlyStats ? `${(monthlyStats.totalVolume / 1000).toFixed(1)}t` : '-'}
                </p>
              </div>
              <div className="card p-3 flex flex-col items-center text-center">
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>운동 횟수</p>
                <p className="font-bold text-white text-sm">{monthlyStats ? `${monthlyStats.totalSessions}회` : '-'}</p>
              </div>
            </div>

            {/* 전월 대비 카드 */}
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>전월 대비</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>평균 운동 시간</span>
                  <span className="text-sm font-bold text-white flex items-center">
                    {monthlyComparison ? formatMinutes(monthlyComparison.currentAvgMinutes) : '-'}
                    {monthlyComparison && (
                      <DeltaBadge
                        curr={monthlyComparison.currentAvgMinutes}
                        prev={monthlyComparison.prevAvgMinutes}
                        unit="분"
                      />
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>볼륨 총합</span>
                  <span className="text-sm font-bold flex items-center" style={{ color: 'var(--accent)' }}>
                    {monthlyComparison ? `${(monthlyComparison.currentTotalVolume / 1000).toFixed(1)}t` : '-'}
                    {monthlyComparison && (
                      <DeltaBadge
                        curr={monthlyComparison.currentTotalVolume}
                        prev={monthlyComparison.prevTotalVolume}
                        unit="kg"
                      />
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 섹션 3: 세션별 볼륨 차트 ── */}
          <div className="card p-4">
            <p className="font-bold text-white mb-1">세션별 볼륨</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>최근 12회 기준</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={volumeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(249,115,22,0.05)' }} />
                <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── 섹션 4: e1RM 성장 차트 ── */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-white">e1RM 성장</p>
              <select
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
                className="text-xs px-2 py-1 rounded-lg outline-none"
                style={{
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                  color: 'var(--accent)',
                }}
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>추정 1회 최대 중량</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={e1rmData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="e1rm"
                  stroke="var(--green)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--green)', r: 3, strokeWidth: 0 }}
                  activeDot={{ fill: 'var(--green)', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  )
}
