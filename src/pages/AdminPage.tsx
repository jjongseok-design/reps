import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../types/index'

const CATEGORIES = ['legs', 'chest', 'back', 'shoulder', 'arm', 'core', 'weightlifting', 'cardio', 'etc'] as const
const CATEGORY_LABEL: Record<string, string> = {
  legs: '하체', chest: '가슴', back: '등', shoulder: '어깨',
  arm: '팔', core: '코어', weightlifting: '역도', cardio: '유산소', etc: '기타'
}

type ExerciseForm = {
  name: string
  category: string
  measure_type: 'reps' | 'time'
  calories_per_kg_rep: number
  sort_order: number
  is_hidden: boolean
}

const EMPTY_FORM: ExerciseForm = {
  name: '', category: 'chest', measure_type: 'reps',
  calories_per_kg_rep: 0.1, sort_order: 999, is_hidden: false
}

export default function AdminPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // 운동 추가/편집 모달
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Exercise | null>(null)
  const [form, setForm] = useState<ExerciseForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchExercises() }, [])

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from('exercises').select('*')
      .order('category').order('sort_order', { ascending: true })
    if (error) { alert('데이터 로드 실패: ' + error.message); return }
    setExercises(data || [])
  }

  // ── SHA-1 서명 생성 ──────────────────────────────────────────────────────────
  const sha1 = async (message: string) => {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(message))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // ── 이미지 압축 (GIF 제외, 최대 800px, WebP 변환) ────────────────────────────
  const compressImage = (file: File): Promise<Blob> =>
    new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX }
          else { width = Math.round((width / height) * MAX); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => resolve(blob!), 'image/webp', 0.85)
      }
      img.src = url
    })

  // ── XHR 업로드 (진행률 추적) ─────────────────────────────────────────────────
  const xhrUpload = (url: string, formData: FormData): Promise<any> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve(JSON.parse(xhr.responseText))
      xhr.onerror = () => reject(new Error('네트워크 오류'))
      xhr.send(formData)
    })

  // ── 이미지 업로드 (Cloudinary signed upload) ─────────────────────────────────
  const handleUpload = async (exerciseId: string, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['gif', 'png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      alert('gif, png, jpg, webp 파일만 업로드 가능합니다.'); return
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const apiKey    = import.meta.env.VITE_CLOUDINARY_API_KEY
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
      alert('Cloudinary 환경변수 미설정'); return
    }

    setUploading(exerciseId)
    setUploadProgress(0)

    // GIF 외 이미지는 압축 후 업로드
    const isGif = ext === 'gif'
    const uploadFile = isGif ? file : await compressImage(file)

    const timestamp = String(Math.round(Date.now() / 1000))
    const publicId  = `exercise-images/${exerciseId}`
    const signature = await sha1(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('api_key', apiKey)
    formData.append('timestamp', timestamp)
    formData.append('signature', signature)
    formData.append('public_id', publicId)
    formData.append('overwrite', 'true')

    try {
      const cloudData = await xhrUpload(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData
      )
      if (cloudData.error) throw new Error(cloudData.error.message)

      const imageUrl = cloudData.secure_url
      const { error } = await supabase.from('exercises').update({ image_url: imageUrl }).eq('id', exerciseId)
      if (error) throw new Error('DB 저장 실패: ' + error.message)

      setExercises(prev => prev.map(ex => ex.id === exerciseId ? { ...ex, image_url: imageUrl } : ex))
    } catch (err: any) {
      alert('업로드 실패: ' + err.message)
    } finally {
      setUploading(null)
      setUploadProgress(0)
    }
  }

  const handleDrop = async (e: React.DragEvent, exerciseId: string) => {
    e.preventDefault(); setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) await handleUpload(exerciseId, file)
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>, exerciseId: string) => {
    const file = e.target.files?.[0]
    if (file) await handleUpload(exerciseId, file)
    e.target.value = ''
  }

  // ── 이미지 삭제 ───────────────────────────────────────────────────────────────
  const handleDeleteImage = async (ex: Exercise) => {
    if (!ex.image_url) return
    if (!confirm(`"${ex.name}" 이미지를 삭제할까요?`)) return
    setDeleting(ex.id)
    const { error } = await supabase.from('exercises').update({ image_url: null }).eq('id', ex.id)
    if (error) { alert('삭제 실패: ' + error.message); setDeleting(null); return }
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, image_url: undefined } : e))
    setDeleting(null)
  }

  // ── 운동 추가/편집 모달 ───────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM); setEditTarget(null); setModal('add')
  }

  const openEdit = (ex: Exercise) => {
    setForm({
      name: ex.name, category: ex.category,
      measure_type: (ex as any).measure_type ?? 'reps',
      calories_per_kg_rep: (ex as any).calories_per_kg_rep ?? 0.1,
      sort_order: (ex as any).sort_order ?? 999,
      is_hidden: (ex as any).is_hidden ?? false,
    })
    setEditTarget(ex); setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('운동 이름을 입력하세요.'); return }
    setSaving(true)

    if (modal === 'add') {
      const { data, error } = await supabase.from('exercises').insert([form]).select().single()
      if (error) { alert('추가 실패: ' + error.message); setSaving(false); return }
      setExercises(prev => [...prev, data])
    } else if (modal === 'edit' && editTarget) {
      const { error } = await supabase.from('exercises').update(form).eq('id', editTarget.id)
      if (error) { alert('수정 실패: ' + error.message); setSaving(false); return }
      setExercises(prev => prev.map(ex => ex.id === editTarget.id ? { ...ex, ...form } : ex))
    }

    setSaving(false); setModal(null)
  }

  // ── 운동 삭제 ─────────────────────────────────────────────────────────────────
  const handleDeleteExercise = async (ex: Exercise) => {
    if (!confirm(`"${ex.name}" 운동을 완전히 삭제할까요?\n관련 운동 기록도 영향을 받을 수 있습니다.`)) return
    const { error } = await supabase.from('exercises').delete().eq('id', ex.id)
    if (error) { alert('삭제 실패: ' + error.message); return }
    setExercises(prev => prev.filter(e => e.id !== ex.id))
  }

  const filtered = exercises.filter(ex => activeCategory === 'all' || ex.category === activeCategory)

  return (
    <div className="min-h-screen pb-32 max-w-2xl mx-auto px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            종목 관리 · 전체 {exercises.length}개
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl font-bold text-sm text-white"
          style={{ background: 'var(--accent)' }}
        >
          + 운동 추가
        </button>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-1 pb-4 flex-wrap">
        {['all', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="flex-shrink-0 px-2 py-1 rounded-full font-bold transition-all"
            style={{
              fontSize: '10px',
              background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-card2)',
              color: activeCategory === cat ? 'white' : 'var(--text-secondary)'
            }}
          >
            {cat === 'all'
              ? `전체 (${exercises.length})`
              : `${CATEGORY_LABEL[cat]} (${exercises.filter(e => e.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* 종목 목록 */}
      <div className="space-y-2">
        {filtered.map(ex => (
          <div
            key={ex.id}
            className="card p-3 flex items-center gap-3 transition-all"
            style={{
              border: `2px solid ${dragOver === ex.id ? 'var(--accent)' : 'transparent'}`,
              background: dragOver === ex.id ? 'var(--accent-dim)' : undefined,
            }}
            onDragEnter={e => { e.preventDefault(); setDragOver(ex.id) }}
            onDragOver={e => { e.preventDefault(); setDragOver(ex.id) }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
            }}
            onDrop={e => handleDrop(e, ex.id)}
          >
            {/* 이미지 미리보기 */}
            <label
              htmlFor={`file-${ex.id}`}
              className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer relative group"
              style={{ background: 'var(--bg-card2)' }}
              title="클릭하거나 이미지를 카드 위로 드래그하세요"
            >
              {ex.image_url ? (
                <>
                  <img src={ex.image_url} alt={ex.name}
                    className="w-full h-full object-contain"
                    style={{ filter: 'invert(1) grayscale(100%) brightness(0.7) contrast(1.2)', mixBlendMode: 'screen' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.5)', fontSize: '18px' }}>
                    🔄
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg opacity-40">📷</span>
                  <span className="text-white opacity-40" style={{ fontSize: '8px' }}>
                    {uploading === ex.id ? '...' : '+ 사진'}
                  </span>
                </div>
              )}
              {uploading === ex.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--accent)', fontSize: '11px', fontWeight: 'bold' }}>
                  <span>{uploadProgress}%</span>
                  <div className="w-10 mt-1 rounded-full overflow-hidden" style={{ height: '3px', background: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.1s' }} />
                  </div>
                </div>
              )}
            </label>
            <input id={`file-${ex.id}`} type="file" accept=".gif,.png,.jpg,.jpeg,.webp"
              className="hidden" onChange={e => handleFileInput(e, ex.id)} disabled={uploading === ex.id} />

            {/* 종목 정보 — 클릭 시 편집 */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(ex)}>
              <p className="font-bold text-white text-sm truncate">{ex.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {CATEGORY_LABEL[ex.category] || ex.category}
                {(ex as any).is_hidden && <span className="ml-1 opacity-50">(숨김)</span>}
              </p>
              {dragOver === ex.id && (
                <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                  여기에 놓으세요
                </p>
              )}
            </div>

            {/* 이미지 삭제 */}
            {ex.image_url && (
              <button
                onClick={() => handleDeleteImage(ex)}
                disabled={deleting === ex.id}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-all"
                style={{ background: 'var(--bg-card2)', color: deleting === ex.id ? 'var(--text-dim)' : '#f87171' }}
                title="이미지 삭제"
              >
                {deleting === ex.id ? '…' : '✕'}
              </button>
            )}

            {/* 운동 삭제 */}
            <button
              onClick={() => handleDeleteExercise(ex)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-all"
              style={{ background: 'var(--bg-card2)', color: '#f87171' }}
              title="운동 삭제"
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {/* 추가/편집 모달 */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="w-full max-w-lg rounded-t-2xl p-6 space-y-4"
            style={{ background: 'var(--bg-card)' }}>
            <h2 className="text-lg font-bold text-white">
              {modal === 'add' ? '운동 추가' : '운동 편집'}
            </h2>

            {/* 이름 */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>운동 이름</label>
              <input
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 바벨 스쿼트"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>카테고리</label>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map(cat => (
                  <button key={cat}
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className="px-2 py-1 rounded-full text-xs font-bold transition-all"
                    style={{
                      background: form.category === cat ? 'var(--accent)' : 'var(--bg-card2)',
                      color: form.category === cat ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    {CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* 측정 방식 */}
            <div>
              <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>측정 방식</label>
              <div className="flex gap-2">
                {(['reps', 'time'] as const).map(t => (
                  <button key={t}
                    onClick={() => setForm(f => ({ ...f, measure_type: t }))}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: form.measure_type === t ? 'var(--accent)' : 'var(--bg-card2)',
                      color: form.measure_type === t ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    {t === 'reps' ? '횟수' : '시간'}
                  </button>
                ))}
              </div>
            </div>

            {/* 칼로리 / 정렬 순서 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  칼로리 (kg·회당)
                </label>
                <input
                  type="number" step="0.01" min="0"
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
                  value={form.calories_per_kg_rep}
                  onChange={e => setForm(f => ({ ...f, calories_per_kg_rep: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--text-secondary)' }}>정렬 순서</label>
                <input
                  type="number" min="0"
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* 숨김 여부 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_hidden}
                onChange={e => setForm(f => ({ ...f, is_hidden: e.target.checked }))}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>이 운동 숨기기</span>
            </label>

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--bg-card2)', color: 'var(--text-secondary)' }}
              >취소</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: saving ? 'var(--text-dim)' : 'var(--accent)' }}
              >
                {saving ? '저장 중...' : modal === 'add' ? '추가' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
