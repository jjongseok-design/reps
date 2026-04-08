import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Exercise } from '../types/index'
import RestTimer from '../components/RestTimer'
import ExerciseDetailModal from '../components/ExerciseDetailModal'

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
const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategoryTab, setActiveCategoryTab] = useState('all')
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null)
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
    const { data } = await supabase.from('exercises').select('*').eq('is_hidden', false).order('category').order('name')
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

  const handleAddSelected = async () => {
    const selected = exercises.filter(ex => selectedExerciseIds.has(ex.id))
    const newEntries: ExerciseEntry[] = []
    for (const ex of selected) {
      const lastSets = await fetchLastSets(ex.id)
      newEntries.push({
        exercise: ex,
        sets: lastSets || [{ weight_kg: 0, reps: 10, done: false }]
      })
    }
    setEntries(prev => [...prev, ...newEntries])
    setShowPicker(false)
    setSelectedExerciseIds(new Set())
    setSearchQuery('')
    setActiveCategoryTab('all')
  }

  const toggleSelectExercise = (id: string) => {
    setSelectedExerciseIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
    navigate('/workout')
  }

  const categoryLabel: Record<string, string> = {
    legs: '하체', chest: '가슴', back: '등', shoulder: '어깨',
    arm: '팔', core: '코어', weightlifting: '역도', cardio: '유산소', etc: '기타'
  }

  const categoryOrder = ['legs', 'chest', 'back', 'shoulder', 'arm', 'core', 'weightlifting', 'cardio', 'etc']

  const categoryEmoji: Record<string, string> = {
    legs: '🦵', chest: '💪', back: '🏋️', shoulder: '🔝', arm: '💪', core: '⚡', weightlifting: '🏅', cardio: '🏃', etc: '🎯'
  }

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategoryTab === 'all' || ex.category === activeCategoryTab
    return matchesSearch && matchesCategory
  })

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
      <div className="sticky top-0 z-10 px-5 pb-4"
        style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
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
              <div className="px-4 py-1">
                {entry.sets.map((set, si) => (
                  <div key={si}
                    className="py-2.5 transition-all"
                    style={{
                      borderBottom: si < entry.sets.length - 1 ? '1px solid var(--border)' : 'none',
                      opacity: set.done ? 0.5 : 1
                    }}>
                    {/* 1줄: SET N 레이블 + 완료/삭제 버튼 */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold tracking-wide"
                        style={{ color: set.done ? 'var(--accent)' : 'var(--text-dim)' }}>
                        SET {si + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleDone(ei, si)}
                          className="done-btn"
                          style={{
                            background: set.done ? 'var(--accent)' : 'transparent',
                            borderColor: set.done ? 'var(--accent)' : '#555',
                            color: set.done ? 'white' : '#aaa',
                            padding: '3px 12px', fontSize: '12px'
                          }}
                        >
                          {set.done ? '✓' : '○'}
                        </button>
                        <button onClick={() => removeSet(ei, si)}
                          className="w-6 h-6 flex items-center justify-center rounded text-xs"
                          style={{ color: 'var(--text-dim)', background: 'var(--bg-card2)' }}>✕</button>
                      </div>
                    </div>
                    {/* 2줄: kg 입력 그룹 + 횟수/시간 입력 그룹 */}
                    <div className="flex items-center gap-2">
                      {/* kg 그룹 */}
                      {entry.exercise.measure_type !== 'time' && (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <button onClick={() => updateSet(ei, si, 'weight_kg', -2.5)} className="ctrl-btn w-9 h-9 text-sm flex-shrink-0">−</button>
                          <input
                            type="number"
                            value={set.weight_kg}
                            onChange={e => setInputValue(ei, si, 'weight_kg', Number(e.target.value))}
                            className="input-dark flex-1 min-w-0 py-2 text-sm text-center"
                          />
                          <button onClick={() => updateSet(ei, si, 'weight_kg', 2.5)} className="ctrl-btn w-9 h-9 text-sm flex-shrink-0">+</button>
                          <span className="text-xs w-6 text-center flex-shrink-0" style={{ color: 'var(--text-dim)' }}>kg</span>
                        </div>
                      )}
                      {/* 횟수/시간 그룹 */}
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <button onClick={() => updateSet(ei, si, 'reps', entry.exercise.measure_type === 'time' ? -10 : -1)} className="ctrl-btn w-9 h-9 text-sm flex-shrink-0">−</button>
                        <input
                          type="number"
                          value={set.reps}
                          onChange={e => setInputValue(ei, si, 'reps', Number(e.target.value))}
                          className="input-dark flex-1 min-w-0 py-2 text-sm text-center"
                        />
                        <button onClick={() => updateSet(ei, si, 'reps', entry.exercise.measure_type === 'time' ? 10 : 1)} className="ctrl-btn w-9 h-9 text-sm flex-shrink-0">+</button>
                        <span className="text-xs w-6 text-center flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                          {entry.exercise.measure_type === 'time' ? '초' : '회'}
                        </span>
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

      {/* 운동 선택 모달 - 풀스크린 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-base)' }}>
          {/* 상단 헤더 */}
          <div className="flex-shrink-0" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center px-4 py-3">
              <button
                onClick={() => { setShowPicker(false); setSelectedExerciseIds(new Set()); setSearchQuery(''); setActiveCategoryTab('all') }}
                className="w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'var(--bg-card2)', color: 'var(--text-secondary)' }}
              >✕</button>
              <h2 className="font-display text-xl text-white flex-1 text-center">운동 선택하기</h2>
              <button
                onClick={() => setShowAddExercise(true)}
                className="text-sm font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >+ 직접 추가</button>
            </div>

            {/* 검색창 */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 px-4 rounded-2xl input-dark">
                <span style={{ color: 'var(--text-dim)' }}>🔍</span>
                <input
                  type="text"
                  placeholder="종목 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none py-3 placeholder:text-gray-600"
                />
                {searchQuery.length > 0 && (
                  <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-dim)' }}>✕</button>
                )}
              </div>
            </div>

            {/* 카테고리 탭 */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {['all', ...categoryOrder].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategoryTab(cat)}
                  className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all"
                  style={{
                    background: activeCategoryTab === cat ? 'var(--accent)' : 'var(--bg-card2)',
                    color: activeCategoryTab === cat ? 'white' : 'var(--text-secondary)'
                  }}
                >
                  {cat === 'all' ? '전체' : categoryLabel[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* 종목 리스트 */}
          <div className="flex-1 overflow-y-auto px-4 space-y-1 pb-4">
            {filteredExercises.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <span className="text-3xl">🔍</span>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>검색 결과가 없습니다</p>
              </div>
            )}
            {filteredExercises.map(ex => {
              const isSelected = selectedExerciseIds.has(ex.id)
              const isBookmarked = bookmarkedIds.has(ex.id)
              return (
                <div
                  key={ex.id}
                  onClick={() => toggleSelectExercise(ex.id)}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl active:scale-[0.99] transition-all cursor-pointer"
                  style={{
                    background: isSelected ? 'var(--accent-dim)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'transparent'}`
                  }}
                >
                  {/* 체크박스 */}
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      border: isSelected ? 'none' : '1.5px solid #555'
                    }}
                  >
                    {isSelected && <span className="text-xs text-white font-bold">✓</span>}
                  </div>

                  {/* 이미지 or 이모지 아이콘 */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ background: 'var(--bg-card2)' }}
                  >
                    {ex.image_url ? (
                      <img
                        src={ex.image_url}
                        alt={ex.name}
                        className="w-full h-full object-contain"
                        style={{ filter: 'invert(1) grayscale(100%) brightness(0.7) contrast(1.2)', mixBlendMode: 'screen' }}
                      />
                    ) : (
                      <span className="text-xl">{categoryEmoji[ex.category] || '🏋️'}</span>
                    )}
                  </div>

                  {/* 종목명 */}
                  <span className="flex-1 text-white font-medium text-sm break-keep line-clamp-2">{ex.name}</span>

                  {/* 상세 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); setDetailExercise(ex) }}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-base transition-colors"
                    style={{ color: 'var(--text-dim)' }}
                  >ⓘ</button>

                  {/* 북마크 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleBookmark(ex.id) }}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg transition-colors"
                    style={{ color: isBookmarked ? '#facc15' : 'var(--text-dim)' }}
                  >
                    {isBookmarked ? '★' : '☆'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* 하단 고정 버튼 */}
          <div
            className="flex-shrink-0 px-4 pt-3"
            style={{ borderTop: '1px solid var(--border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={handleAddSelected}
              disabled={selectedExerciseIds.size === 0}
              className="w-full py-4 text-base font-bold rounded-2xl transition-all"
              style={{
                background: selectedExerciseIds.size > 0 ? 'var(--accent)' : 'var(--bg-card2)',
                color: selectedExerciseIds.size > 0 ? 'white' : 'var(--text-dim)',
                cursor: selectedExerciseIds.size > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              {selectedExerciseIds.size > 0 ? `${selectedExerciseIds.size}개 추가하기` : '운동을 선택해주세요'}
            </button>
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
              <option value="weightlifting">역도</option>
              <option value="cardio">유산소</option>
              <option value="etc">기타</option>
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
      {detailExercise && (
        <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
      )}
      {showRestTimer && (
        <RestTimer onClose={() => setShowRestTimer(false)} />
      )}
    </div>
  )
}
