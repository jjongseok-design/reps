import { useEffect, useState, useRef } from 'react'

interface RestTimerProps {
  onClose: () => void
}

export default function RestTimer({ onClose }: RestTimerProps) {
  const [seconds, setSeconds] = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [running, setRunning] = useState(true)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setRunning(false)
            // 진동 (모바일)
            if (navigator.vibrate) navigator.vibrate([300, 100, 300])
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  const reset = (sec: number) => {
    clearInterval(timerRef.current)
    setSeconds(sec)
    setRemaining(sec)
    setRunning(true)
  }

  const togglePause = () => {
    if (running) {
      clearInterval(timerRef.current)
      setRunning(false)
    } else {
      setRunning(true)
    }
  }

  const progress = remaining / seconds
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference * (1 - progress)

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10"
        style={{ background: '#0f0f0f', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: 'var(--border)' }} />

        <p className="text-center font-display text-xl mb-6" style={{ color: 'var(--text-secondary)' }}>
          휴식 타이머
        </p>

        {/* 원형 타이머 */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* 배경 원 */}
              <circle cx="50" cy="50" r="45"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="6"
              />
              {/* 진행 원 */}
              <circle cx="50" cy="50" r="45"
                fill="none"
                stroke={remaining === 0 ? '#22c55e' : 'var(--accent)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display text-4xl text-white">{formatTime(remaining)}</p>
              {remaining === 0 && (
                <p className="text-xs mt-1" style={{ color: '#22c55e' }}>완료!</p>
              )}
            </div>
          </div>
        </div>

        {/* 시간 프리셋 */}
        <div className="flex justify-center gap-2 mb-5">
          {[30, 60, 90, 120, 180].map(sec => (
            <button
              key={sec}
              onClick={() => reset(sec)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: seconds === sec ? 'var(--accent)' : 'var(--bg-card2)',
                color: seconds === sec ? 'white' : 'var(--text-secondary)'
              }}
            >
              {sec < 60 ? `${sec}s` : `${sec / 60}m`}
            </button>
          ))}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={togglePause}
            className="flex-1 py-3 rounded-xl font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {running ? '⏸ 일시정지' : '▶ 재개'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold"
            style={{ background: 'var(--bg-card2)', color: 'var(--text-secondary)' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
