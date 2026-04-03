import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { WorkoutSession, WorkoutSet } from '../types/index'

interface ExerciseGroup {
  exerciseId: string
  exerciseName: string
  category: string
  imageUrl?: string
  sets: WorkoutSet[]
}

export default function WorkoutDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [groups, setGroups] = useState<ExerciseGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    const { data: sessionData } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', id)
      .single()
    setSession(sessionData)

    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('*, exercise:exercises(*)')
      .eq('session_id', id)
      .order('created_at')

    if (setsData) {
      const grouped: Record<string, ExerciseGroup> = {}
      setsData.forEach(set => {
        const exId = set.exercise_id
        if (!grouped[exId]) {
          grouped[exId] = {
            exerciseId: exId,
            exerciseName: set.exercise?.name || '',
            category: set.exercise?.category || '',
            imageUrl: set.exercise?.image_url || undefined,
            sets: []
          }
        }
        grouped[exId].sets.push(set)
      })
      setGroups(Object.values(grouped))
    }
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
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

  const getMaxE1RM = (sets: WorkoutSet[]) => {
    const max = Math.max(...sets.map(s => s.e1rm || 0))
    return Math.round(max * 10) / 10
  }

  const categoryEmoji: Record<string, string> = {
    legs: '🦵', chest: '💪', back: '🏋️', shoulder: '🔝', arm: '💪', core: '⚡', cardio: '🏃'
  }

  const categoryLabel: Record<string, string> = {
    legs: '하체', chest: '가슴', back: '등', shoulder: '어깨', arm: '팔', core: '코어', cardio: '유산소'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-secondary)' }}>로딩 중...</p>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-secondary)' }}>기록을 찾을 수 없어요</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto" style={{ background: 'var(--bg-base)' }}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 px-5 py-4"
        style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: 'var(--bg-card2)', color: 'var(--text-secondary)' }}>
            ←
          </button>
          <div>
            <p className="font-bold text-white">{formatDate(session.started_at)}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatTime(session.started_at)} · {getDuration(session)}
            </p>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="mx-5 mt-5 mb-4 card p-4 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="stat-number text-3xl" style={{ color: 'var(--accent)' }}>
            {session.total_volume_kg.toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>볼륨 kg</p>
        </div>
        <div className="text-center" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
          <p className="stat-number text-3xl" style={{ color: 'var(--green)' }}>
            {Math.round(session.total_calories)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>칼로리</p>
        </div>
        <div className="text-center">
          <p className="stat-number text-3xl text-white">{groups.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>종목</p>
        </div>
      </div>

      {/* 종목별 세트 목록 */}
      <div className="px-5 space-y-3">
        {groups.map((group, gi) => (
          <div key={gi} className="card overflow-hidden flex items-stretch">
            {/* 왼쪽 이미지 */}
            <div className="w-24 flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-card2)', borderRight: '1px solid var(--border)' }}>
              {group.imageUrl ? (
                <img src={group.imageUrl} alt={group.exerciseName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl opacity-60">{categoryEmoji[group.category]}</span>
              )}
            </div>

            {/* 오른쪽 내용 */}
            <div className="flex-1 p-3">
              <p className="font-bold text-white text-sm">{group.exerciseName}</p>
              <p className="text-xs mb-2" style={{ color: 'var(--accent)' }}>
                e1RM {getMaxE1RM(group.sets)}kg
              </p>
              <div className="space-y-1">
                {group.sets.map((set, si) => (
                  <div key={si} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>SET {si + 1}</span>
                    <span className="text-sm font-medium text-white">
                      {set.weight_kg}kg × {set.reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
