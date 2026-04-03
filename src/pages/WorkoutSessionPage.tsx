import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Exercise } from '../types/index'

interface SetInput {
  id?: string
  weight_kg: number
  reps: number
  done: boolean
}

interface ExerciseEntry {
  exercise: Exercise
  sets: SetInput[]
}

export default function WorkoutSessionPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<ExerciseEntry[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef<Date>(new Date())

  useEffect(() => {
    fetchSession()
    fetchExercises()
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [id])

  const fetchSession = async () => {
    const { data: session } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', id)
      .single()
    if (session) startedAt.current = new Date(session.started_at)

    const { data: sets } = await supabase
      .from('workout_sets')
      .select('*, exercise:exercises(*)')
      .eq('session_id', id)
      .order('created_at')

    if (sets && sets.length > 0) {
      const grouped: Record<string, ExerciseEntry> = {}
      sets.forEach(set => {
        const exId = set.exercise_id
        if (!grouped[exId]) {
          grouped[exId] = { exercise: set.exercise as Exercise, sets: [] }
        }
        grouped[exId].sets.push({
          id: set.id,
          weight_kg: set.weight_kg,
          reps: set.reps,
          done: true
        })
      })
      setEntries(Object.values(grouped))
    }
  }

  const fetchExercises = async () => {
    const { data } = await supabase.from('exercises').select('*').order('category').order('name')
    setExercises(data || [])
  }

  const fetchLastSets = async (exerciseId: string) => {
    const { data } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps, session_id')
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!data || data.length === 0) return null
    const lastSessionId = data[0].session_id
    const lastSets = data.filter(s => s.session_id === lastSessionId)
    return lastSets.map(s => ({ weight_kg: s.weight_kg, reps: s.reps, done: false }))
  }

  const addExercise = async (exercise: Exercise) => {
    const lastSets = await fetchLastSets(exercise.id)
    setEntries(prev => [...prev, {
      exercise,
      sets: lastSets || [{ weight_kg: 0, reps: 10, done: false }]
    }])
    setShowPicker(false)
  }

  const addSet = (ei: number) => {
    setEntries(prev => prev.map((entry, i) => {
      if (i !== ei) return entry
      const last = entry.sets.at(-1) || { weight_kg: 0, reps: 10, done: false }
      return { ...entry, sets: [...entry.sets, { ...last, done: false, id: undefined }] }
    }))
  }

  const removeSet = (ei: number, si: number) => {
    setEntries(prev => {
      const newSets = prev[ei].sets.filter((_, i) => i !== si)
      if (newSets.length === 0) return prev.filter((_, i) => i !== ei)
      return prev.map((entry, i) => i !== ei ? entry : { ...entry, sets: newSets })
    })
  }

  const updateSet = (ei: number, si: number, field: 'weight_kg' | 'reps', delta: number) => {
    setEntries(prev => prev.map((entry, i) => {
      if (i !== ei) return entry
      return {
        ...entry,
        sets: entry.sets.map((set, j) =>
          j !== si ? set : { ...set, [field]: Math.max(0, set[field] + delta) }
        )
      }
    }))
  }

  const setInputValue = (ei: number, si: number, field: 'weight_kg' | 'reps', value: number) => {
    setEntries(prev => prev.map((entry, i) => {
      if (i !== ei) return entry
      return {
        ...entry,
        sets: entry.sets.map((set, j) =>
          j !== si ? set : { ...set, [field]: Math.max(0, value) }
        )
      }
    }))
  }

  const toggleDone = (ei: number, si: number) => {
    setEntries(prev => prev.map((entry, i) => {
      if (i !== ei) return entry
      return {
        ...entry,
        sets: entry.sets.map((set, j) =>
          j !== si ? set : { ...set, done: !set.done }
        )
      }
    }))
  }

  const calcE1RM = (w: number, r: number) => {
    if (r === 1) return w
    return Math.round(w * (1 + r / 30) * 10) / 10
  }

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const totalVolume = entries.reduce((sum, e) =>
    sum + e.sets.reduce((s2, s) => s2 + s.weight_kg * s.reps, 0), 0)

  const handleFinish = async () => {
    setSaving(true)
    await supabase.from('workout_sets').delete().eq('session_id', id)
    const allSets = entries.flatMap((entry) =>
      entry.sets.map((set, si) => ({
        session_id: id,
        exercise_id: entry.exercise.id,
        set_number: si + 1,
        weight_kg: set.weight_kg,
        reps: set.reps,
      }))
    )
    if (allSets.length > 0) await supabase.from('workout_sets').insert(allSets)
    await supabase.from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(false)
    navigate('/')
  }

  const categoryLabel: Record<string, string> = {
    legs: '하체', chest: '가슴', back: '등', shoulder: '어깨', arm: '팔', core: '코어', cardio: '유산소'
  }

  const categoryEmoji: Record<string, string> = {
    legs: '🦵', chest: '💪', back: '🏋️', shoulder: '🔝', arm: '💪', core: '⚡', cardio: '🏃'
  }

  const grouped = exercises.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = []
    acc[ex.category].push(ex)
    return acc
  }, {} as Record<string, Exercise[]>)

  return (
    <div className="min-h-screen bg-dark pb-32 max-w-md mx-auto">
      {/* 헤더 */}
      <div className="sticky top-0 bg-dark/95 backdrop-blur border-b border-gray-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="text-gray-400 text-sm">← 홈</button>
          <button
            onClick={handleFinish}
            disabled={saving}
            className="bg-primary text-white text-sm font-bold px-5 py-1.5 rounded-full disabled:opacity-50"
          >
            {saving ? '저장 중...' : '완료 ✓'}
          </button>
        </div>
        <div className="flex justify-around pt-1">
          <div className="text-center">
            <p className="text-primary font-bold text-lg">{formatElapsed(elapsed)}</p>
            <p className="text-gray-500 text-xs">시간</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">{totalVolume.toLocaleString()}</p>
            <p className="text-gray-500 text-xs">볼륨 kg</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">{entries.reduce((s, e) => s + e.sets.length, 0)}</p>
            <p className="text-gray-500 text-xs">총 세트</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {entries.map((entry, ei) => {
          const maxE1RM = Math.max(...entry.sets.map(s => calcE1RM(s.weight_kg, s.reps)))
          return (
            <div key={ei} className="bg-gray-900 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{entry.exercise.name}</p>
                  <p className="text-gray-500 text-xs">{categoryLabel[entry.exercise.category]} · e1RM {maxE1RM}kg</p>
                </div>
                <span className="text-2xl">{categoryEmoji[entry.exercise.category]}</span>
              </div>
              <div className="px-4 py-2">
                {entry.sets.map((set, si) => (
                  <div key={si} className={`py-2 border-b border-gray-800/50 last:border-0 ${set.done ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-gray-500 text-xs">세트 {si + 1}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleDone(ei, si)}
                          className={`px-3 py-0.5 rounded-full border text-xs font-medium transition-all ${
                            set.done ? 'bg-primary border-primary text-white' : 'border-gray-600 text-gray-500'
                          }`}
                        >
                          {set.done ? '✓ 완료' : '완료'}
                        </button>
                        <button onClick={() => removeSet(ei, si)} className="text-gray-600 text-xs px-1">✕</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <button onClick={() => updateSet(ei, si, 'weight_kg', -2.5)} className="w-7 h-7 shrink-0 bg-gray-800 rounded-lg text-white font-bold text-sm">−</button>
                        <input type="number" value={set.weight_kg} onChange={e => setInputValue(ei, si, 'weight_kg', Number(e.target.value))} className="w-12 min-w-0 bg-gray-800 text-white text-center rounded-lg py-1.5 text-sm font-bold outline-none" />
                        <button onClick={() => updateSet(ei, si, 'weight_kg', 2.5)} className="w-7 h-7 shrink-0 bg-gray-800 rounded-lg text-white font-bold text-sm">+</button>
                        <span className="text-gray-500 text-xs shrink-0">kg</span>
                      </div>
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <button onClick={() => updateSet(ei, si, 'reps', -1)} className="w-7 h-7 shrink-0 bg-gray-800 rounded-lg text-white font-bold text-sm">−</button>
                        <input type="number" value={set.reps} onChange={e => setInputValue(ei, si, 'reps', Number(e.target.value))} className="w-12 min-w-0 bg-gray-800 text-white text-center rounded-lg py-1.5 text-sm font-bold outline-none" />
                        <button onClick={() => updateSet(ei, si, 'reps', 1)} className="w-7 h-7 shrink-0 bg-gray-800 rounded-lg text-white font-bold text-sm">+</button>
                        <span className="text-gray-500 text-xs shrink-0">회</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => addSet(ei)} className="w-full py-2.5 text-gray-500 text-sm border-t border-gray-800">+ 세트 추가</button>
            </div>
          )
        })}

        <button
          onClick={() => setShowPicker(true)}
          className="w-full py-5 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 font-medium text-lg active:scale-95 transition-transform"
        >
          + 운동 추가
        </button>
      </div>

      {showPicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={() => setShowPicker(false)}>
          <div className="bg-gray-950 w-full rounded-t-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-950 px-4 py-4 border-b border-gray-800">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">운동 선택</h3>
            </div>
            <div className="px-4 py-3 pb-10">
              {Object.entries(grouped).map(([category, exList]) => (
                <div key={category} className="mb-5">
                  <p className="text-gray-500 text-xs font-semibold mb-2 uppercase tracking-wider">{categoryLabel[category]}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {exList.map(ex => (
                      <button key={ex.id} onClick={() => addExercise(ex)} className="text-left px-3 py-3 bg-gray-900 rounded-xl text-white text-sm font-medium active:scale-95 transition-transform">
                        {ex.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
