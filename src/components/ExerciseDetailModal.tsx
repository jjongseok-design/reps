import type { Exercise } from '../types/index'

interface Props {
  exercise: Exercise
  onClose: () => void
}

const categoryLabel: Record<string, string> = {
  legs: '하체', chest: '가슴', back: '등', shoulder: '어깨',
  arm: '팔', core: '코어', weightlifting: '역도', cardio: '유산소', etc: '기타'
}

const categoryEmoji: Record<string, string> = {
  legs: '🦵', chest: '💪', back: '🏋️', shoulder: '🔝', arm: '💪',
  core: '⚡', weightlifting: '🏅', cardio: '🏃', etc: '🎯'
}

export default function ExerciseDetailModal({ exercise, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        {/* 닫기 버튼 — safe area 안쪽 */}
        <div style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="flex justify-end px-4 py-3">
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >✕</button>
          </div>
        </div>

        {/* 이미지 or 이모지 */}
        <div
          className="mx-5 mb-6 rounded-3xl flex items-center justify-center overflow-hidden"
          style={{ background: 'var(--bg-card)', minHeight: '220px' }}
        >
          {exercise.image_url ? (
            <img
              src={exercise.image_url}
              alt={exercise.name}
              className="w-full h-56 object-contain"
              style={{ filter: 'invert(1) grayscale(100%) brightness(0.7) contrast(1.2)', mixBlendMode: 'screen' }}
            />
          ) : (
            <span className="text-8xl">{categoryEmoji[exercise.category] || '🏋️'}</span>
          )}
        </div>

        {/* 정보 */}
        <div className="px-5 space-y-3 pb-12">
          <span
            className="inline-block text-xs px-3 py-1 rounded-full font-bold"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {categoryLabel[exercise.category] || exercise.category}
          </span>

          <h1 className="font-display text-3xl text-white leading-tight">{exercise.name}</h1>

          {exercise.measure_type === 'time' && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--bg-card2)' }}
            >
              <span>⏱</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>시간 측정 종목</span>
            </div>
          )}

          {exercise.description ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {exercise.description}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>설명이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}
