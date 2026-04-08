import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zsafusllrolzllwcyyjh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYWZ1c2xscm9semxsd2N5eWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjYzOTEsImV4cCI6MjA5MDc0MjM5MX0.2POT3ABgGNhBs4Fyj_43X2QXm7rge2ZQL_GMoVbPqDQ'
)

const BUCKET = 'Exercise-images'

const categoryLabel: Record<string, string> = {
  legs: '하체',
  chest: '가슴',
  back: '등',
  shoulder: '어깨',
  arm: '팔',
  core: '코어',
  weightlifting: '역도',
  cardio: '유산소',
  etc: '기타',
}

const categoryOrder = ['legs', 'chest', 'back', 'shoulder', 'arm', 'core', 'weightlifting', 'cardio', 'etc']

interface Exercise {
  id: string
  name: string
  category: string
  image_url?: string
}

export default function AdminPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [activeCategory, setActiveCategory] = useState('legs')
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, category, image_url')
      .order('name')
    if (data) setExercises(data)
  }

  const uploadImage = async (exerciseId: string, file: File) => {
    setUploading(exerciseId)
    setMessage('')
    try {
      const ext = file.name.split('.').pop()
      const filename = `${exerciseId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filename)

      const publicUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('exercises')
        .update({ image_url: publicUrl })
        .eq('id', exerciseId)

      if (updateError) throw updateError

      setExercises(prev =>
        prev.map(ex => ex.id === exerciseId ? { ...ex, image_url: publicUrl } : ex)
      )
      setMessage('업로드 완료!')
    } catch (err: any) {
      setMessage('업로드 실패: ' + err.message)
    } finally {
      setUploading(null)
    }
  }

  const handleDrop = (e: React.DragEvent, exerciseId: string) => {
    e.preventDefault()
    setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) uploadImage(exerciseId, file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, exerciseId: string) => {
    const file = e.target.files?.[0]
    if (file) uploadImage(exerciseId, file)
  }

  const deleteImage = async (exerciseId: string, imageUrl: string) => {
    if (!confirm('이미지를 삭제할까요?')) return
    setMessage('')
    try {
      // Storage에서 파일 삭제
      const filename = imageUrl.split('/').pop()
      if (filename) {
        await supabase.storage.from(BUCKET).remove([filename])
      }
      // DB에서 image_url 제거
      const { error } = await supabase
        .from('exercises')
        .update({ image_url: null })
        .eq('id', exerciseId)
      if (error) throw error
      setExercises(prev =>
        prev.map(ex => ex.id === exerciseId ? { ...ex, image_url: undefined } : ex)
      )
      setMessage('삭제 완료!')
    } catch (err: any) {
      setMessage('삭제 실패: ' + err.message)
    }
  }

  const filtered = exercises.filter(ex => ex.category === activeCategory)

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'Noto Sans KR, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #222', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>관리자 - 이미지 관리</h1>
        {message && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: message.includes('실패') ? '#7f1d1d' : '#14532d', fontSize: 13, marginBottom: 8 }}>
            {message}
          </div>
        )}
        {/* 카테고리 탭 */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categoryOrder.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 600,
                background: activeCategory === cat ? '#f97316' : '#1a1a1a',
                color: activeCategory === cat ? 'white' : '#888',
              }}
            >
              {categoryLabel[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* 종목 리스트 */}
      <div style={{ padding: '8px 16px' }}>
        {filtered.map(ex => (
          <div
            key={ex.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            {/* 이미지 미리보기 */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: '#1a1a1a',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ex.image_url ? (
                  <img src={ex.image_url} alt={ex.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 24 }}>📷</span>
                )}
              </div>
              {ex.image_url && (
                <button
                  onClick={() => deleteImage(ex.id, ex.image_url!)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    color: 'white',
                    fontSize: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >✕</button>
              )}
            </div>

            {/* 종목명 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{ex.name}</div>
              {/* 드래그앤드롭 영역 */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(ex.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, ex.id)}
                onClick={() => fileInputRefs.current[ex.id]?.click()}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px dashed ${dragOver === ex.id ? '#f97316' : '#333'}`,
                  background: dragOver === ex.id ? 'rgba(249,115,22,0.1)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#666',
                  textAlign: 'center',
                }}
              >
                {uploading === ex.id ? '업로드 중...' : '이미지 드롭 또는 클릭'}
              </div>
              <input
                type="file"
                accept="image/*,.gif"
                style={{ display: 'none' }}
                ref={el => { fileInputRefs.current[ex.id] = el }}
                onChange={e => handleFileChange(e, ex.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
