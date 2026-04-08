import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../types/index'

const categoryLabel: Record<string, string> = {
  legs: '하체', chest: '가슴', back: '등', shoulder: '어깨',
  arm: '팔', core: '코어', weightlifting: '역도', cardio: '유산소', etc: '기타'
}
const categoryOrder = ['legs', 'chest', 'back', 'shoulder', 'arm', 'core', 'weightlifting', 'cardio', 'etc']

export default function AdminPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [uploading, setUploading] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    const { data, error } = await supabase.from('exercises').select('*').order('category').order('sort_order', { ascending: true })
    if (error) {
      alert('데이터 로드 실패: ' + error.message)
      return
    }
    setExercises(data || [])
  }

  const handleUpload = async (exerciseId: string, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['gif', 'png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      alert('gif, png, jpg, webp 파일만 업로드 가능합니다.')
      return
    }
    setUploading(exerciseId)
    const filename = `${exerciseId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('Exercise-images')
      .upload(filename, file, { upsert: true })

    if (uploadError) {
      alert('업로드 실패: ' + uploadError.message)
      setUploading(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('Exercise-images')
      .getPublicUrl(filename)

    const { error: updateError } = await supabase.from('exercises').update({ image_url: publicUrl }).eq('id', exerciseId)
    if (updateError) {
      alert('DB 업데이트 실패: ' + updateError.message)
      setUploading(null)
      return
    }
    setExercises(prev => prev.map(ex => ex.id === exerciseId ? { ...ex, image_url: publicUrl } : ex))
    setUploading(null)
  }

  const handleDrop = async (e: React.DragEvent, exerciseId: string) => {
    e.preventDefault()
    setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) await handleUpload(exerciseId, file)
  }

  const handleDelete = async (ex: Exercise) => {
    if (!ex.image_url) return
    if (!confirm(`"${ex.name}" 이미지를 삭제할까요?`)) return
    setDeleting(ex.id)

    const ext = ex.image_url.split('.').pop()?.split('?')[0]
    const filename = `${ex.id}.${ext}`
    await supabase.storage.from('Exercise-images').remove([filename])
    await supabase.from('exercises').update({ image_url: null }).eq('id', ex.id)
    await fetchExercises()
    setDeleting(null)
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>, exerciseId: string) => {
    const file = e.target.files?.[0]
    if (file) await handleUpload(exerciseId, file)
    e.target.value = ''
  }

  const filtered = exercises.filter(ex =>
    activeCategory === 'all' || ex.category === activeCategory
  )

  return (
    <div className="min-h-screen pb-32 max-w-2xl mx-auto px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="py-6">
        <h1 className="text-2xl font-bold text-white mb-1">Admin</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          종목 이미지 관리 · 전체 {exercises.length}개
        </p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
        {['all', ...categoryOrder].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-card2)',
              color: activeCategory === cat ? 'white' : 'var(--text-secondary)'
            }}
          >
            {cat === 'all'
              ? `전체 (${exercises.length})`
              : `${categoryLabel[cat]} (${exercises.filter(e => e.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* 종목 목록 */}
      <div className="space-y-2">
        {filtered.map(ex => (
          <div key={ex.id} className="card p-3 flex items-center gap-3">
            {/* 이미지 미리보기 */}
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
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
                <span className="text-2xl opacity-30">📷</span>
              )}
            </div>

            {/* 종목 정보 */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{ex.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {categoryLabel[ex.category] || ex.category}
              </p>
              {ex.image_url && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>
                  ✓ 이미지 있음
                </p>
              )}
            </div>

            {/* 삭제 버튼 */}
            {ex.image_url && (
              <button
                onClick={() => handleDelete(ex)}
                disabled={deleting === ex.id}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all"
                style={{ background: 'var(--bg-card2)', color: deleting === ex.id ? 'var(--text-dim)' : '#f87171' }}
              >
                {deleting === ex.id ? '…' : '✕'}
              </button>
            )}

            {/* 드래그앤드롭 업로드 */}
            <label
              htmlFor={`file-${ex.id}`}
              onDragEnter={e => { e.preventDefault(); setDragOver(ex.id) }}
              onDragOver={e => { e.preventDefault(); setDragOver(ex.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, ex.id)}
              className="flex-shrink-0 w-24 h-12 flex items-center justify-center rounded-xl cursor-pointer transition-all text-xs font-medium"
              style={{
                border: `2px dashed ${dragOver === ex.id ? 'var(--accent)' : 'var(--border)'}`,
                background: dragOver === ex.id ? 'var(--accent-dim)' : 'transparent',
                color: dragOver === ex.id ? 'var(--accent)' : 'var(--text-dim)'
              }}
            >
              {uploading === ex.id
                ? <span style={{ pointerEvents: 'none', color: 'var(--accent)' }}>업로드 중...</span>
                : <span style={{ pointerEvents: 'none' }}>{ex.image_url ? '🔄 교체' : '+ 이미지'}</span>
              }
            </label>
            <input
              id={`file-${ex.id}`}
              type="file"
              accept=".gif,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={e => handleFileInput(e, ex.id)}
              disabled={uploading === ex.id}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
