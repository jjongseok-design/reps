import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Exercise } from '../types/index'
import RestTimer from '../components/RestTimer'

interface SetInput {
  weight_kg: number
  reps: number
  done: boolean
}

interface ExerciseEntry {
  exercise: Exercise
  sets: SetInput[]
}

export default function WorkoutTabPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [entries, setEntries] = useState<ExerciseEntry[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [showRestTimer, setShowRestTimer] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseCategory, setNewExerciseCategory] = useState('legs')
  const [addingExercise, setAddingExercise] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const startedAt = useRef<Date>(new Date())
  const timerRef = useRef<any>(null)

  useEffect(() => {
    fetchExercises()
    checkInProgressSession()
  }, [])

  const checkInProgressSession = async () => {
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setSessionId(data.id)
      setIsActive(true)
      const sessionStart = new Date(data.started_at)
      startedAt.current = sessionStart
      startTimer(sessionStart)
      fetchSessionSets(data.id)
    }
  }

  const fetchSessionSets = async (sid: string) => {
    const { data } = await supabase
      .from('workout_sets')
      .select('*, exercise:exercises(*)')
      .eq('session_id', sid)
      .order('created_at')

    if (data && data.length > 0) {
      const grouped: Record<string, ExerciseEntry> = {}
      data.forEach(set => {
        const exId = set.exercise_id
        if (!grouped[exId]) {
          grouped[exId] = { exercise: set.exercise as Exercise, sets: [] }
        }
        grouped[exId].sets.push({ weight_kg: set.weight_kg, reps: set.reps, done: true })
      })
      setEntries(Object.values(grouped))
    }
  }

  const fetchExercises = async () => {
    const { data } = await supabase.from('exercises').select('*').order('category').order('name')
    setExercises(data || [])
  }

  const addNewExercise = async () => {
    if (!newExerciseName.trim()) return
    setAddingExercise(true)
    const { data } = await supabase
      .from('exercises')
      .insert({ name: newExerciseName.trim(), category: newExerciseCategory, calories_per_kg_rep: 0.1 })
      .select().single()
    if (data) {
      await fetchExercises()
      setNewExerciseName('')
      setShowAddExercise(false)
      addExercise(data)
    }
    setAddingExercise(false)
  }

  const startTimer = (from?: Date) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const base = from || startedAt.current
    setElapsed(Math.floor((Date.now() - base.getTime()) / 1000))
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - base.getTime()) / 1000))
    }, 1000)
  }

  const handleStartWorkout = async () => {
    // 오늘 이미 완료된 세션이 있으면 그걸 이어서 사용
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: existing } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .gte('started_at', today.toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      // 기존 세션 이어하기 - ended_at 초기화
      await supabase
        .from('workout_sessions')
        .update({ ended_at: null })
        .eq('id', existing.id)
      setSessionId(existing.id)
      setIsActive(true)
      startedAt.current = new Date(existing.started_at)
      startTimer()
      fetchSessionSets(existing.id)
    } else {
      // 새 세션 생성
      const { data } = await supabase
        .from('workout_sessions')
        .insert({ user_id: user!.id, started_at: new Date().toISOString() })
        .select().single()
      if (data) {
        setSessionId(data.id)
        setIsActive(true)
        startedAt.current = new Date()
        setEntries([])
        startTimer()
      }
    }
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
    if (lastSessionId === sessionId) {
      const prevData = data.filter(s => s.session_id !== sessionId)
      if (prevData.length === 0) return null
      const prevSessionId = prevData[0].session_id
      return prevData.filter(s => s.session_id === prevSessionId).map(s => ({ weight_kg: s.weight_kg, reps: s.reps, done: false }))
    }
    return data.filter(s => s.session_id === lastSessionId).map(s => ({ weight_kg: s.weight_kg, reps: s.reps, done: false }))
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
      return { ...entry, sets: [...entry.sets, { ...last, done: false }] }
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
      const wasDone = entry.sets[si].done
      if (!wasDone) setShowRestTimer(true)
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
    if (!sessionId) return
    setSaving(true)
    await supabase.from('workout_sets').delete().eq('session_id', sessionId)
    const allSets = entries.flatMap((entry) =>
      entry.sets.map((set, si) => ({
        session_id: sessionId,
        exercise_id: entry.exercise.id,
        set_number: si + 1,
        weight_kg: set.weight_kg,
        reps: set.reps,
      }))
    )
    if (allSets.length > 0) await supabase.from('workout_sets').insert(allSets)
    await supabase.from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
    if (timerRef.current) clearInterval(timerRef.current)
    setIsActive(false)
    setSessionId(null)
    setEntries([])
    setElapsed(0)
    setSaving(false)
    navigate('/history')
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

  // 운동 시작 전 화면
  if (!isActive) {
    return (
      <div className="min-h-screen pb-24 max-w-md mx-auto flex flex-col" style={{ background: 'var(--bg-base)' }}>
        <div className="px-5 pt-8 pb-4">
          <h1 className="font-display text-4xl" style={{ color: 'var(--accent)' }}>REPS</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>오늘도 한계를 넘어보세요</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-8">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'var(--accent-dim)', border: '1px solid rgba(249,115,22,0.3)' }}>
              <span className="text-5xl">🔥</span>
            </div>
            <p className="font-display text-3xl text-white mb-2">오늘 운동 준비됐나요?</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>종목을 추가하고 세트를 기록하세요</p>
          </div>
          <div className="w-full space-y-3">
            <button
              onClick={handleStartWorkout}
              className="btn-primary glow-orange w-full py-5 text-lg font-bold"
            >
              + 운동 시작
            </button>
            <p className="text-center text-xs" style={{ color: 'var(--text-dim)' }}>
              오늘 기록이 있으면 이어서 진행됩니다
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 운동 중 화면
  return (
    <div className="min-h-screen bg-dark pb-32 max-w-md mx-auto">
      {/* 상단 스티키 헤더 */}
      <div className="sticky top-0 z-10 px-5 py-4"
        style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-display text-2xl" style={{ color: 'var(--accent)' }}>운동 중</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>열심히 하고 있어요 🔥</p>
          </div>
          <button
            onClick={handleFinish}
            disabled={saving}
            className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? '저장 중...' : '완료 ✓'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center py-2 rounded-xl" style={{ background: 'var(--accent-dim)' }}>
            <p className="stat-number text-2xl" style={{ color: 'var(--accent)' }}>{formatElapsed(elapsed)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>시간</p>
          </div>
          <div className="text-center py-2 rounded-xl" style={{ background: 'var(--bg-card2)' }}>
            <p className="stat-number text-2xl text-white">{totalVolume.toLocaleString()}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>볼륨 kg</p>
          </div>
          <div className="text-center py-2 rounded-xl" style={{ background: 'var(--bg-card2)' }}>
            <p className="stat-number text-2xl text-white">
              {entries.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>완료 세트</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {entries.map((entry, ei) => {
          const maxE1RM = Math.max(0, ...entry.sets.map(s => calcE1RM(s.weight_kg, s.reps)))
          return (
            <div key={ei} className="card overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="font-bold text-white text-base">{entry.exercise.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>
                    {categoryLabel[entry.exercise.category]} · e1RM {maxE1RM}kg
                  </p>
                </div>
                <span className="text-2xl">{categoryEmoji[entry.exercise.category]}</span>
              </div>

              {/* 세트 목록 */}
              <div className="px-4 py-2">
                {entry.sets.map((set, si) => (
                  <div key={si}
                    className="py-3 transition-all"
                    style={{
                      borderBottom: si < entry.sets.length - 1 ? '1px solid var(--border)' : 'none',
                      background: set.done ? 'rgba(249,115,22,0.04)' : 'transparent'
                    }}>
                    {/* 세트 번호 + 완료/삭제 */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base" style={{ color: set.done ? 'var(--accent)' : 'var(--text-dim)' }}>
                          SET {si + 1}
                        </span>
                        {set.done && (
                          <span className="text-xs" style={{ color: 'var(--accent)' }}>✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleDone(ei, si)}
                          className="done-btn"
                          style={{
                            background: set.done ? 'var(--accent)' : 'transparent',
                            borderColor: set.done ? 'var(--accent)' : '#333',
                            color: set.done ? 'white' : '#555'
                          }}
                        >
                          {set.done ? '✓ 완료' : '완료'}
                        </button>
                        <button onClick={() => removeSet(ei, si)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-xs transition-colors"
                          style={{ color: 'var(--text-dim)', background: 'var(--bg-card2)' }}>✕</button>
                      </div>
                    </div>
                    {/* kg + 횟수 입력 */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-1">
                        <button onClick={() => updateSet(ei, si, 'weight_kg', -2.5)} className="ctrl-btn w-9 h-9 text-lg">−</button>
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={set.weight_kg}
                            onChange={e => setInputValue(ei, si, 'weight_kg', Number(e.target.value))}
                            className="input-dark w-full py-2 text-base"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                            style={{ color: 'var(--text-dim)' }}>kg</span>
                        </div>
                        <button onClick={() => updateSet(ei, si, 'weight_kg', 2.5)} className="ctrl-btn w-9 h-9 text-lg">+</button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <button onClick={() => updateSet(ei, si, 'reps', -1)} className="ctrl-btn w-9 h-9 text-lg">−</button>
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={set.reps}
                            onChange={e => setInputValue(ei, si, 'reps', Number(e.target.value))}
                            className="input-dark w-full py-2 text-base"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                            style={{ color: 'var(--text-dim)' }}>회</span>
                        </div>
                        <button onClick={() => updateSet(ei, si, 'reps', 1)} className="ctrl-btn w-9 h-9 text-lg">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => addSet(ei)} className="w-full py-3 text-sm font-medium transition-colors"
                style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                + 세트 추가
              </button>
            </div>
          )
        })}

        {/* 운동 추가 버튼 */}
        <button
          onClick={() => setShowPicker(true)}
          className="w-full py-5 font-bold text-lg active:scale-95 transition-transform rounded-2xl"
          style={{ border: '2px dashed rgba(249,115,22,0.3)', color: 'var(--accent)' }}
        >
          + 운동 추가
        </button>
      </div>

      {/* 운동 선택 모달 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowPicker(false)}>
          <div className="w-full rounded-t-3xl max-h-[80vh] overflow-y-auto" style={{ background: '#0f0f0f', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 px-5 py-4" style={{ background: '#0f0f0f', borderBottom: '1px solid var(--border)' }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--border)' }} />
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl text-white">운동 선택</h3>
                <button
                  onClick={() => setShowAddExercise(true)}
                  className="text-sm font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >+ 직접 추가</button>
              </div>
            </div>
            <div className="px-4 py-3 pb-10">
              {Object.entries(grouped).map(([category, exList]) => {
                const isExpanded = expandedCategory === category
                return (
                  <div key={category} className="mb-2">
                    {/* 대분류 버튼 */}
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all"
                      style={{
                        background: isExpanded ? 'var(--accent)' : 'var(--bg-card)',
                        color: isExpanded ? 'white' : 'var(--text-primary)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {category === 'legs' ? '🦵' :
                           category === 'chest' ? '💪' :
                           category === 'back' ? '🏋️' :
                           category === 'shoulder' ? '🔝' :
                           category === 'arm' ? '💪' :
                           category === 'core' ? '⚡' : '🏃'}
                        </span>
                        <span className="font-bold text-base">{categoryLabel[category]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-60">{exList.length}개</span>
                        <span className="text-sm transition-transform"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                          ▾
                        </span>
                      </div>
                    </button>

                    {/* 세부 목록 */}
                    {isExpanded && (
                      <div className="mt-1 grid grid-cols-2 gap-1.5 px-1">
                        {exList.map(ex => (
                          <div key={ex.id} className="relative">
                            <button
                              onClick={() => addExercise(ex)}
                              className="w-full text-left px-3 py-3 rounded-xl text-sm font-medium active:scale-95 transition-transform pr-8"
                              style={{ background: 'var(--bg-card2)', color: 'var(--text-primary)' }}
                            >
                              {ex.name}
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm(`'${ex.name}' 종목과 관련된 모든 기록이 삭제됩니다. 계속할까요?`)) return
                                await supabase.from('workout_sets').delete().eq('exercise_id', ex.id)
                                await supabase.from('exercises').delete().eq('id', ex.id)
                                await fetchExercises()
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-xs transition-opacity"
                              style={{ color: 'var(--text-dim)' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 종목 직접 추가 모달 */}
      {showAddExercise && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end">
          <div className="bg-gray-950 w-full rounded-t-3xl p-6 max-w-md mx-auto">
            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-4">종목 직접 추가</h3>

            <input
              type="text"
              placeholder="종목 이름 (예: 케이블 크런치)"
              value={newExerciseName}
              onChange={e => setNewExerciseName(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-primary"
            />

            <select
              value={newExerciseCategory}
              onChange={e => setNewExerciseCategory(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-4 outline-none"
            >
              <option value="legs">하체</option>
              <option value="chest">가슴</option>
              <option value="back">등</option>
              <option value="shoulder">어깨</option>
              <option value="arm">팔</option>
              <option value="core">코어</option>
              <option value="cardio">유산소</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowAddExercise(false); setNewExerciseName('') }}
                className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-medium"
              >취소</button>
              <button
                onClick={addNewExercise}
                disabled={addingExercise || !newExerciseName.trim()}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
              >
                {addingExercise ? '추가 중...' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRestTimer && (
        <RestTimer onClose={() => setShowRestTimer(false)} />
      )}
    </div>
  )
}
