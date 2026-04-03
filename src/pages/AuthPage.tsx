import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        <h1 className="font-display text-7xl text-center mb-1" style={{ color: 'var(--accent)' }}>REPS</h1>
        <p className="text-center text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>운동 기록을 관리하세요</p>

        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--bg-card)' }}>
          <button
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={isLogin ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-secondary)' }}
            onClick={() => setIsLogin(true)}
          >로그인</button>
          <button
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={!isLogin ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-secondary)' }}
            onClick={() => setIsLogin(false)}
          >회원가입</button>
        </div>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="input-dark w-full px-4 py-3 mb-3"
          style={{ textAlign: 'left', fontWeight: 400 }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="input-dark w-full px-4 py-3 mb-4"
          style={{ textAlign: 'left', fontWeight: 400 }}
        />

        {error && <p className="text-sm mb-4" style={{ color: '#f87171' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary glow-orange w-full py-3 disabled:opacity-50"
        >
          {loading ? '...' : isLogin ? '로그인' : '가입하기'}
        </button>
      </div>
    </div>
  )
}
