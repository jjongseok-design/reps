import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WorkoutSession } from '../types/index'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([])
  const [todaySession, setTodaySession] = useState<WorkoutSession | null>(null)
  const [inProgressSession, setInProgressSession] = useState<WorkoutSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10)

    if (data) {
      // 진행 중 세션 (ended_at 없음)
      const inProgress = data.find(s => !s.ended_at)
      setInProgressSession(inProgress || null)

      // 오늘 완료된 세션
      const todayCompleted = data.find(s =>
        s.ended_at && new Date(s.started_at) >= today
      )
      setTodaySession(todayCompleted || null)

      // 최근 완료 세션 5개
      setRecentSessions(data.filter(s => s.ended_at).slice(0, 5))
    }
    setLoading(false)
  }

  const handleStartWorkout = () => {
    if (inProgressSession) {
      navigate(`/workout/session/${inProgressSession.id}`)
    } else {
      navigate('/workout/new')
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
  }

  const getDuration = (session: WorkoutSession) => {
    if (!session.ended_at) return '-'
    const diff = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
    return `${Math.floor(diff / 60000)}분`
  }

  return (
    <div className="min-h-screen bg-dark pb-24 max-w-md mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reps 💪</h1>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
        <button onClick={signOut} className="text-gray-500 text-sm">로그아웃</button>
      </div>

      <div className="px-4 space-y-4">
        {/* 진행 중 세션 배너 */}
        {inProgressSession && (
          <div
            onClick={() => navigate(`/workout/session/${inProgressSession.id}`)}
            className="bg-primary/20 border border-primary/40 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
          >
            <div>
              <p className="text-primary font-bold">운동 진행 중 🔥</p>
              <p className="text-gray-400 text-sm mt-0.5">
                {formatDate(inProgressSession.started_at)} · 볼륨 {inProgressSession.total_volume_kg.toLocaleString()}kg
              </p>
            </div>
            <span className="text-primary text-xl">→</span>
          </div>
        )}

        {/* 오늘 운동 시작/이어하기 버튼 */}
        <button
          onClick={handleStartWorkout}
          className="w-full bg-primary rounded-2xl py-5 text-white font-bold text-lg active:scale-95 transition-transform"
        >
          {inProgressSession ? '⚡ 운동 이어하기' : '+ 오늘 운동 시작'}
        </button>

        {/* 오늘 완료된 운동 요약 */}
        {todaySession && (
          <div
            onClick={() => navigate(`/workout/${todaySession.id}`)}
            className="bg-gray-900 rounded-2xl p-4 cursor-pointer active:scale-95 transition-transform"
          >
            <p className="text-gray-500 text-xs mb-2">오늘 운동</p>
            <div className="flex justify-around">
              <div className="text-center">
                <p className="text-primary font-bold text-xl">{todaySession.total_volume_kg.toLocaleString()}</p>
                <p className="text-gray-500 text-xs">볼륨 kg</p>
              </div>
              <div className="text-center">
                <p className="text-green-400 font-bold text-xl">{Math.round(todaySession.total_calories)}</p>
                <p className="text-gray-500 text-xs">칼로리</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-xl">{getDuration(todaySession)}</p>
                <p className="text-gray-500 text-xs">운동 시간</p>
              </div>
            </div>
          </div>
        )}

        {/* 최근 기록 */}
        <div>
          <h2 className="text-white font-semibold mb-3">최근 기록</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">로딩 중...</p>
          ) : recentSessions.length === 0 ? (
            <p className="text-gray-500 text-sm">아직 운동 기록이 없어요</p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => navigate(`/workout/${session.id}`)}
                  className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer active:scale-95 transition-transform"
                >
                  <div>
                    <p className="text-white font-medium">{formatDate(session.started_at)}</p>
                    <p className="text-gray-500 text-xs">{getDuration(session)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary font-bold">{session.total_volume_kg.toLocaleString()} kg</p>
                    <p className="text-gray-500 text-xs">{Math.round(session.total_calories)} kcal</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
