'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = () => {
    setLoading(true)
    setError('')
    if (password === 'Knights') {
      sessionStorage.setItem('role', 'player')
      router.push('/roster')
    } else if (password === 'KnightsCoach') {
      sessionStorage.setItem('role', 'coach')
      router.push('/roster')
    } else {
      setError('Incorrect password. Try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '3px', height: '2rem', background: '#800000', borderRadius: '2px' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#e0e0e0', letterSpacing: '0.05em', margin: 0 }}>PLAYER REPORTS</h1>
            <div style={{ width: '3px', height: '2rem', background: '#800000', borderRadius: '2px' }} />
          </div>
          <p style={{ color: '#616161', fontSize: '0.8rem', letterSpacing: '0.15em', margin: 0 }}>LONE PEAK KNIGHTS · BESMARTAI.CO</p>
        </div>

        {/* Card */}
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '1rem', padding: '2rem' }}>
          <p style={{ color: '#9e9e9e', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>Enter your team password to continue</p>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#757575', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter password"
              style={{
                width: '100%', padding: '0.75rem 1rem', background: '#2a2a2a',
                border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: '#e0e0e0',
                fontSize: '1rem', boxSizing: 'border-box', outline: 'none'
              }}
            />
          </div>

          {error && (
            <div style={{ background: '#2d0000', border: '1px solid #800000', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', marginBottom: '1rem' }}>
              <p style={{ color: '#f49898', fontSize: '0.85rem', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            style={{
              width: '100%', padding: '0.75rem', background: password ? '#800000' : '#3a3a3a',
              border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: '700',
              fontSize: '0.95rem', cursor: password ? 'pointer' : 'not-allowed', letterSpacing: '0.05em',
              transition: 'background 0.15s'
            }}
          >
            {loading ? 'ENTERING...' : 'ENTER'}
          </button>
        </div>

        <p style={{ textAlign: 'center', color: '#3a3a3a', fontSize: '0.75rem', marginTop: '2rem', letterSpacing: '0.1em' }}>
          BESMARTAI PLAYER REPORTS · FILM ANALYSIS SYSTEM
        </p>
      </div>
    </div>
  )
}