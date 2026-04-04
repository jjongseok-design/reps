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

export default function StatsPage() {
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [e1rmData, setE1RMData] = useState<E1RMData[]>([])
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [totalSessions, setTotalSessions] = useState(0)
  const [totalVolume, setTotalVolume] = useState(0)
  const [bestVolume, setBestVolume] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchExercises()
  }, [])

  useEffect(() => {
    if (selectedExercise) fetchE1RMData(selectedExercise)
  }, [selectedExercise])

  const fetchStats = async () => {
    const { data } = await supabase
      .from('workout_sessions')
      .select('started_at, total_volume_kg')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: true })
      .limit(12)

    if (data) {
      setTotalSessions(data.length)
      setTotalVolume(data.reduce((sum, s) => sum + s.total_volume_kg, 0))
      setBestVolume(Math.max(...data.map(s => s.total_volume_kg)))
      setVolumeData(data.map(s => ({
        date: `${new Date(s.started_at).getMonth() + 1}/${new Date(s.started_at).getDate()}`,
        volume: s.total_volume_kg
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

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="px-5 pb-4" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}>
        <h1 className="font-display text-4xl" style={{ color: 'var(--accent)' }}>통계</h1>
      </div>

      {loading ? (
        <p className="px-5 text-sm" style={{ color: 'var(--text-secondary)' }}>로딩 중...</p>
      ) : (
        <div className="px-5 space-y-4">
          {/* 메인 볼륨 카드 */}
          <div className="card p-5 flex items-center justify-between"
            style={{ borderLeft: '3px solid var(--accent)' }}>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>총 볼륨</p>
              <p className="stat-number text-5xl" style={{ color: 'var(--accent)' }}>
                {(totalVolume / 1000).toFixed(1)}
                <span className="text-2xl ml-1">t</span>
              </p>
            </div>
            <div className="text-right">
              <div className="mb-3">
                <p className="stat-number text-2xl text-white">{totalSessions}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>총 운동</p>
              </div>
              <div>
                <p className="stat-number text-2xl" style={{ color: 'var(--green)' }}>
                  {bestVolume.toLocaleString()}kg
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>최고 볼륨</p>
              </div>
            </div>
          </div>

          {/* 볼륨 차트 */}
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

          {/* e1RM 그래프 */}
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
                  color: 'var(--accent)'
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
