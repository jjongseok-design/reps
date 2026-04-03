import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  {
    path: '/workout',
    label: '운동',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : '#444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M2 9l2 3-2 3M22 9l-2 3 2 3"/>
      </svg>
    )
  },
  {
    path: '/history',
    label: '기록',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : '#444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
        <circle cx="8" cy="15" r="1" fill={active ? 'var(--accent)' : '#444'}/>
        <circle cx="12" cy="15" r="1" fill={active ? 'var(--accent)' : '#444'}/>
        <circle cx="16" cy="15" r="1" fill={active ? 'var(--accent)' : '#444'}/>
      </svg>
    )
  },
  {
    path: '/stats',
    label: '통계',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : '#444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    )
  },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="tab-bar fixed bottom-0 left-0 right-0 flex max-w-md mx-auto left-1/2 -translate-x-1/2 w-full">
      {tabs.map(tab => {
        const active = location.pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center py-3 gap-1.5 transition-all"
          >
            {tab.icon(active)}
            <span className="text-xs font-medium transition-colors"
              style={{ color: active ? 'var(--accent)' : '#444' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
