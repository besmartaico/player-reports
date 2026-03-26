'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

const GRADE_CATS = ['Passing','Take Aways','Touches','Control','Recovery'] as const
type GradeCat = typeof GRADE_CATS[number]
type Grades = Record<GradeCat, string>
const GRADES = ['A','B','C','D','F'] as const

const STAT_ROWS = [
  ['pass',              'Passes'],
  ['complete',          'Completions'],
  ['shotOnGoal',        'Shot on Goal'],
  ['shotNotOnGoal',     'Shot not on Goal'],
  ['takeAway',          'Take Away'],
  ['loseBallDribbling', 'Lose Ball Dribbling'],
  ['dangerousBallMiddle','Dangerous Ball in Middle'],
  ['badTouch',          'Bad Touch'],
] as const
type StatKey = typeof STAT_ROWS[number][0]
type Stats = Record<StatKey, string>

function GradeSelector({ label, grades, setGrades }: { label: string; grades: Grades; setGrades: (g: Grades) => void }) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <p style={{ color: '#757575', fontSize: '0.7rem', letterSpacing: '0.1em', margin: '0 0 0.4rem 0' }}>{label.toUpperCase()}</p>
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        {GRADES.map(g => (
          <button key={g} onClick={() => setGrades({ ...grades, [label as GradeCat]: g })}
            className={`grade-btn ${grades[label as GradeCat] === g ? 'selected-' + g : ''}`}>
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}

// Identical stat row used on both sides
function StatRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.5rem 0', borderBottom: '1px solid #1e1e1e', minHeight: '2.5rem'
    }}>
      <span style={{ color: '#9e9e9e', fontSize: '0.82rem' }}>{label}</span>
      <input
        type="number" min="0" max="99" value={value}
        onChange={e => onChange(e.target.value)}
        className="stat-input" placeholder="0"
      />
    </div>
  )
}

const emptyGrades = (): Grades => ({ Passing: '', 'Take Aways': '', Touches: '', Control: '', Recovery: '' })
const emptyStats  = (): Stats  => ({ pass: '', complete: '', shotOnGoal: '', shotNotOnGoal: '', takeAway: '', loseBallDribbling: '', dangerousBallMiddle: '', badTouch: '' })

export default function EntryPage() {
  const router = useRouter()
  const params = useParams()
  const playerName = decodeURIComponent(params.player as string)

  const [role, setRole] = useState('')
  const [players, setPlayers] = useState<{name:string}[]>([])
  const [peerName, setPeerName] = useState('')
  const [filmMinute, setFilmMinute] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [gameId, setGameId] = useState('')
  const [gameLabel, setGameLabel] = useState('')

  const [selfStats,  setSelfStats]  = useState<Stats>(emptyStats())
  const [selfGrades, setSelfGrades] = useState<Grades>(emptyGrades())
  const [peerStats,  setPeerStats]  = useState<Stats>(emptyStats())
  const [peerGrades, setPeerGrades] = useState<Grades>(emptyGrades())
  const [coachGrades, setCoachGrades] = useState<Grades>(emptyGrades())

  useEffect(() => {
    const r = sessionStorage.getItem('role')
    if (!r) { router.push('/'); return }
    setRole(r)
    setGameId(sessionStorage.getItem('selectedGame') || '')
    setGameLabel(sessionStorage.getItem('selectedGameLabel') || '')
    fetch('/api/players').then(r => r.json()).then(d => setPlayers(d.players || []))
  }, [router])

  const setSelfStat = (k: string, v: string) => setSelfStats(s => ({ ...s, [k]: v }))
  const setPeerStat  = (k: string, v: string) => setPeerStats(s => ({ ...s, [k]: v }))

  const handleSubmit = async () => {
    if (!gameId) { alert('No game selected. Go back and select a game first.'); return }
    setSubmitting(true)
    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName, submittedBy: playerName, role,
          gameId, gameLabel,
          stats: selfStats, selfGrades,
          peerName: peerName || null,
          peerStats: peerName ? peerStats : null,
          peerGrades: peerName ? peerGrades : null,
          coachGrades: role === 'coach' ? coachGrades : null,
          filmMinute, notes
        })
      })
      setSubmitted(true)
    } catch(e) { alert('Error submitting: ' + e) }
    setSubmitting(false)
  }

  const resetForm = () => {
    setSubmitted(false)
    setSelfStats(emptyStats()); setSelfGrades(emptyGrades())
    setPeerStats(emptyStats()); setPeerGrades(emptyGrades())
    setCoachGrades(emptyGrades()); setNotes(''); setPeerName('')
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: '#0f2d1a', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#e0e0e0', fontWeight: '700', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Report Submitted</h2>
        <p style={{ color: '#616161', fontSize: '0.85rem', margin: 0 }}>{playerName}{peerName ? ' & ' + peerName : ''} · {gameLabel || gameId}</p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={resetForm} style={{ padding: '0.625rem 1.25rem', background: '#6b0000', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>Submit Another</button>
        <button onClick={() => router.push('/roster')} style={{ padding: '0.625rem 1.25rem', background: '#222', border: '1px solid #333', borderRadius: '0.5rem', color: '#9e9e9e', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>Back to Roster</button>
      </div>
    </div>
  )

  const firstName = (n: string) => n.split(' ')[0].toUpperCase()

  // Shared section styles
  const divider = { marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #222' }
  const sectionLabel = (color: string): React.CSSProperties => ({
    color, fontSize: '0.7rem', letterSpacing: '0.12em', margin: '0 0 0.875rem 0', fontWeight: 700
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', padding: '1.25rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => router.push('/roster')}
              style={{ background: 'transparent', border: '1px solid #333', borderRadius: '0.5rem', color: '#9e9e9e', padding: '0.375rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              ← Back
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '3px', height: '1.25rem', background: '#6b0000', borderRadius: '2px' }} />
                <h1 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#e0e0e0', margin: 0, letterSpacing: '0.04em' }}>{playerName.toUpperCase()}</h1>
              </div>
              {gameLabel && <p style={{ color: '#6b0000', fontSize: '0.7rem', letterSpacing: '0.08em', margin: '0.1rem 0 0 0.55rem', fontWeight: 600 }}>⚑ {gameLabel}</p>}
            </div>
          </div>
          <div>
            <label style={{ color: '#555', fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.25rem' }}>FILM MINUTE</label>
            <input type="text" value={filmMinute} onChange={e => setFilmMinute(e.target.value)} placeholder="e.g. 0:00–90:00"
              style={{ background: '#222', border: '1px solid #333', borderRadius: '0.375rem', color: '#e0e0e0', padding: '0.375rem 0.5rem', fontSize: '0.8rem', width: '130px', outline: 'none' }} />
          </div>
        </div>

        {/* ── Two panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

          {/* ─── LEFT: My stats + self grades ─── */}
          <div className="section-panel">
            <h2 style={{ color: '#e0e0e0', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.08em', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b0000', display: 'inline-block' }} />
              MY STATS — {firstName(playerName)}
            </h2>

            {STAT_ROWS.map(([k, label]) => (
              <StatRow key={k} label={label} value={selfStats[k]} onChange={v => setSelfStat(k, v)} />
            ))}

            <div style={divider}>
              <p style={sectionLabel('#6b0000')}>MY SELF-EVALUATION</p>
              {GRADE_CATS.map(cat => <GradeSelector key={cat} label={cat} grades={selfGrades} setGrades={setSelfGrades} />)}
            </div>
          </div>

          {/* ─── RIGHT: Peer stats + peer grades ─── */}
          <div className="section-panel">
            <h2 style={{ color: '#e0e0e0', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.08em', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1e3a5f', display: 'inline-block' }} />
              PEER EVALUATION
            </h2>

            {/* Peer selector — same height as first stat row so rows align after */}
            <div style={{ marginBottom: '0.625rem' }}>
              <label style={{ color: '#555', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '0.35rem' }}>EVALUATING PLAYER</label>
              <select
                value={peerName}
                onChange={e => { setPeerName(e.target.value); setPeerStats(emptyStats()); setPeerGrades(emptyGrades()); }}
                style={{ width: '100%', padding: '0.5rem 0.75rem', background: '#222', border: '1px solid #333', borderRadius: '0.5rem', color: peerName ? '#e0e0e0' : '#555', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">-- Select teammate --</option>
                {players.filter(p => p.name !== playerName).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {peerName ? (
              <>
                {/* Stat rows — identical structure to left panel */}
                <p style={{ color: '#3b82f6', fontSize: '0.7rem', letterSpacing: '0.1em', margin: '0.75rem 0 0.25rem', fontWeight: 700 }}>
                  STATS — {firstName(peerName)}
                </p>
                {STAT_ROWS.map(([k, label]) => (
                  <StatRow key={k} label={label} value={peerStats[k]} onChange={v => setPeerStat(k, v)} />
                ))}

                {/* Grade rows — identical structure to left panel */}
                <div style={divider}>
                  <p style={sectionLabel('#3b82f6')}>GRADES — {firstName(peerName)}</p>
                  {GRADE_CATS.map(cat => <GradeSelector key={cat} label={cat} grades={peerGrades} setGrades={setPeerGrades} />)}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#333' }}>
                <p style={{ fontSize: '0.8rem', letterSpacing: '0.08em' }}>SELECT A PLAYER ABOVE<br/>TO ADD PEER STATS + GRADES</p>
              </div>
            )}

            {/* Coach grades appended below on right panel */}
            {role === 'coach' && (
              <div style={{ ...divider, marginTop: peerName ? '1.25rem' : '0', paddingTop: '1.25rem', borderTop: '1px solid #222' }}>
                <p style={sectionLabel('#800000')}>⚑ COACH GRADES — {firstName(playerName)}</p>
                {GRADE_CATS.map(cat => <GradeSelector key={cat} label={cat} grades={coachGrades} setGrades={setCoachGrades} />)}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="section-panel" style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#555', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>NOTES</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Film notes, timestamps, observations..." rows={3}
            style={{ width: '100%', background: '#222', border: '1px solid #333', borderRadius: '0.5rem', color: '#e0e0e0', padding: '0.625rem 0.875rem', fontSize: '0.875rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', padding: '0.875rem', background: '#6b0000', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'wait' : 'pointer', letterSpacing: '0.05em', transition: 'background 0.15s' }}>
          {submitting ? 'SUBMITTING...' : 'SUBMIT FILM REPORT'}
        </button>
      </div>
    </div>
  )
}
