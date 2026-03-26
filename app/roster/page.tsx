'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Player { name: string; potentialTeam: string }
interface Game { id: string; label: string; date: string; opponent: string; location: string }

export default function RosterPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamFilter, setTeamFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const router = useRouter()

  useEffect(() => {
    const r = sessionStorage.getItem('role')
    if (!r) { router.push('/'); return }
    setRole(r)
    // Restore game selection if returning
    const sg = sessionStorage.getItem('selectedGame')
    if (sg) setSelectedGame(sg)

    Promise.all([
      fetch('/api/players').then(r => r.json()),
      fetch('/api/games').then(r => r.json())
    ]).then(([pd, gd]) => {
      setPlayers(pd.players || [])
      setGames(gd.games || [])
      setLoading(false)
    }).catch(e => { setError('Failed to load data: ' + e.message); setLoading(false) })
  }, [router])

  const teams = ['All', ...Array.from(new Set(players.map(p => p.potentialTeam).filter(Boolean))).sort()]
  const filtered = players.filter(p => {
    const matchTeam = teamFilter === 'All' || p.potentialTeam === teamFilter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchTeam && matchSearch
  })

  const handleSelectPlayer = (name: string) => {
    if (!selectedGame) {
      alert('Please select a game first before entering data.')
      return
    }
    sessionStorage.setItem('selectedGame', selectedGame)
    const game = games.find(g => g.id === selectedGame)
    if (game) sessionStorage.setItem('selectedGameLabel', game.label)
    router.push('/entry/' + encodeURIComponent(name))
  }

  const teamColor = (team: string) => {
    const colors: Record<string,string> = {
      'Varsity': '#800000', 'JV': '#1e3a5f', 'Sophomore': '#166534',
      'Freshman': '#713f12', 'Unassigned': '#3a3a3a'
    }
    return colors[team] || '#4a4a4a'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '1.5rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '3px', height: '1.5rem', background: '#800000', borderRadius: '2px' }} />
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#e0e0e0', margin: 0, letterSpacing: '0.04em' }}>PLAYER ROSTER</h1>
            </div>
            <p style={{ color: '#616161', fontSize: '0.75rem', letterSpacing: '0.12em', margin: '0.25rem 0 0 0.6rem' }}>
              LONE PEAK KNIGHTS · {role === 'coach' ? 'COACH VIEW' : 'PLAYER VIEW'}
            </p>
          </div>
          <button onClick={() => { sessionStorage.clear(); router.push('/') }}
            style={{ background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: '#9e9e9e', padding: '0.4rem 0.875rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            LOGOUT
          </button>
        </div>

        {/* Game Selector */}
        <div style={{ background: '#1a1a1a', border: `1px solid ${selectedGame ? '#800000' : '#3a3a3a'}`, borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <label style={{ color: '#616161', fontSize: '0.7rem', letterSpacing: '0.12em', display: 'block', marginBottom: '0.5rem' }}>
            ① SELECT GAME FIRST
          </label>
          {games.length === 0 && !loading ? (
            <p style={{ color: '#616161', fontSize: '0.8rem', margin: 0 }}>No games found in the Games sheet tab yet.</p>
          ) : (
            <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)}
              style={{ width: '100%', padding: '0.625rem 0.875rem', background: '#2a2a2a', border: `1px solid ${selectedGame ? '#800000' : '#4a4a4a'}`, borderRadius: '0.5rem', color: selectedGame ? '#e0e0e0' : '#616161', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}>
              <option value="">-- Select a game to report on --</option>
              {games.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          )}
          {selectedGame && (
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              <span style={{ color: '#16a34a', fontSize: '0.75rem', letterSpacing: '0.06em' }}>
                Game selected — now pick a player below
              </span>
            </div>
          )}
        </div>

        {/* Team Filter */}
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <label style={{ color: '#616161', fontSize: '0.7rem', letterSpacing: '0.12em', display: 'block', marginBottom: '0.625rem' }}>
            ② FILTER BY POTENTIAL TEAM PRIMARY
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {teams.map(t => (
              <button key={t} onClick={() => setTeamFilter(t)} style={{
                padding: '0.35rem 0.875rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.15s',
                background: teamFilter === t ? '#800000' : '#2a2a2a',
                border: teamFilter === t ? '1px solid #a81212' : '1px solid #3a3a3a',
                color: teamFilter === t ? '#fff' : '#9e9e9e'
              }}>{t}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search player name..."
            style={{ width: '100%', padding: '0.5rem 0.875rem', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <p style={{ color: '#616161', fontSize: '0.75rem', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          {filtered.length} PLAYER{filtered.length !== 1 ? 'S' : ''} {teamFilter !== 'All' ? '· ' + teamFilter.toUpperCase() : ''}
        </p>

        {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#616161', fontSize: '0.85rem', letterSpacing: '0.1em' }}>▋ LOADING...</div>}
        {error && <div style={{ background: '#2d0000', border: '1px solid #800000', borderRadius: '0.5rem', padding: '0.875rem', marginBottom: '1rem' }}><p style={{ color: '#f49898', fontSize: '0.85rem', margin: 0 }}>{error}</p></div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map(player => (
            <div key={player.name} onClick={() => handleSelectPlayer(player.name)} className="player-card"
              style={{ opacity: selectedGame ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: teamColor(player.potentialTeam), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                  {player.name.split(' ').map((n:string) => n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <p style={{ color: '#e0e0e0', fontWeight: '600', margin: 0, fontSize: '0.95rem' }}>{player.name}</p>
                  <p style={{ color: '#616161', fontSize: '0.75rem', margin: 0 }}>{player.potentialTeam}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#616161', fontSize: '0.8rem' }}>{role === 'coach' ? 'GRADE' : 'ENTER DATA'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#800000" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#4a4a4a' }}>
            <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>NO PLAYERS FOUND</p>
          </div>
        )}
      </div>
    </div>
  )
}
