'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

const GRADE_CATS = ['Passing','Take Aways','Touches','Control','Recovery'] as const
type GradeCat = typeof GRADE_CATS[number]
type Grades = Record<GradeCat, string>
const GRADES = ['A','B','C','D','F'] as const

function GradeSelector({ label, grades, setGrades }: { label: string; grades: Grades; setGrades: (g: Grades) => void }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p style={{ color: '#757575', fontSize: '0.7rem', letterSpacing: '0.1em', margin: '0 0 0.5rem 0' }}>{label.toUpperCase()}</p>
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

function StatInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #1e1e1e' }}>
      <span style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>{label}</span>
      <input type="number" min="0" max="99" value={value} onChange={e => onChange(e.target.value)}
        className="stat-input" placeholder="0" />
    </div>
  )
}

export default function EntryPage() {
  const router = useRouter()
  const params = useParams()
  const playerName = decodeURIComponent(params.player as string)

  const [role, setRole] = useState('')
  const [players, setPlayers] = useState<{name:string}[]>([])
  const [peerName, setPeerName] = useState('')
  const [gameDate, setGameDate] = useState('')
  const [filmMinute, setFilmMinute] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emptyGrades = (): Grades => ({ Passing: '', 'Take Aways': '', Touches: '', Control: '', Recovery: '' })
  const [selfGrades, setSelfGrades] = useState<Grades>(emptyGrades())
  const [peerGrades, setPeerGrades] = useState<Grades>(emptyGrades())
  const [coachGrades, setCoachGrades] = useState<Grades>(emptyGrades())

  const emptyStats = () => ({ pass: '', complete: '', shotOnGoal: '', shotNotOnGoal: '', takeAway: '', loseBallDribbling: '', dangerousBallMiddle: '', badTouch: '' })
  const [stats, setStats] = useState(emptyStats())

  useEffect(() => {
    const r = sessionStorage.getItem('role')
    if (!r) { router.push('/'); return }
    setRole(r)
    fetch('/api/players').then(r => r.json()).then(d => setPlayers(d.players || []))
  }, [router])

  const setStat = (key: string, val: string) => setStats(s => ({ ...s, [key]: val }))

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName, submittedBy: playerName, role,
          stats, selfGrades,
          peerName: peerName || null,
          peerGrades: peerName ? peerGrades : null,
          coachGrades: role === 'coach' ? coachGrades : null,
          gameDate, filmMinute, notes
        })
      })
      setSubmitted(true)
    } catch(e) { alert('Error submitting: ' + e) }
    setSubmitting(false)
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: '#0f2d1a', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#e0e0e0', fontWeight: '700', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Report Submitted</h2>
        <p style={{ color: '#616161', fontSize: '0.85rem', margin: 0 }}>Film data saved for {playerName}{peerName ? ' and ' + peerName : ''}</p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={() => { setSubmitted(false); setStats(emptyStats()); setSelfGrades(emptyGrades()); setPeerGrades(emptyGrades()); setCoachGrades(emptyGrades()); setNotes(''); }}
          style={{ padding: '0.625rem 1.25rem', background: '#800000', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>
          Submit Another
        </button>
        <button onClick={() => router.push('/roster')}
          style={{ padding: '0.625rem 1.25rem', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: '#9e9e9e', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>
          Back to Roster
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '1.25rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => router.push('/roster')} style={{ background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: '#9e9e9e', padding: '0.375rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>← Back</button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '3px', height: '1.25rem', background: '#800000', borderRadius: '2px' }} />
                <h1 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#e0e0e0', margin: 0, letterSpacing: '0.04em' }}>{playerName.toUpperCase()}</h1>
              </div>
              <p style={{ color: '#616161', fontSize: '0.7rem', letterSpacing: '0.1em', margin: '0.1rem 0 0 0.55rem' }}>FILM REPORT ENTRY</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ color: '#616161', fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.25rem' }}>GAME DATE</label>
              <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '0.375rem', color: '#e0e0e0', padding: '0.375rem 0.5rem', fontSize: '0.8rem', outline: 'none' }} />
            </div>
            <div>
              <label style={{ color: '#616161', fontSize: '0.65rem', letterSpacing: '0.08em', display: 'block', marginBottom: '0.25rem' }}>FILM MINUTE</label>
              <input type="text" value={filmMinute} onChange={e => setFilmMinute(e.target.value)} placeholder="e.g. 0:00-90:00" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '0.375rem', color: '#e0e0e0', padding: '0.375rem 0.5rem', fontSize: '0.8rem', width: '120px', outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Two-panel grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* LEFT: My Stats + Self Grades */}
          <div className="section-panel">
            <h2 style={{ color: '#e0e0e0', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '0.08em', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#800000', display: 'inline-block' }} />
              MY STATS
            </h2>
            <StatInput label="Passes" value={stats.pass} onChange={v => setStat('pass',v)} />
            <StatInput label="Completions" value={stats.complete} onChange={v => setStat('complete',v)} />
            <StatInput label="Shot on Goal" value={stats.shotOnGoal} onChange={v => setStat('shotOnGoal',v)} />
            <StatInput label="Shot not on Goal" value={stats.shotNotOnGoal} onChange={v => setStat('shotNotOnGoal',v)} />
            <StatInput label="Take Away" value={stats.takeAway} onChange={v => setStat('takeAway',v)} />
            <StatInput label="Lose Ball Dribbling" value={stats.loseBallDribbling} onChange={v => setStat('loseBallDribbling',v)} />
            <StatInput label="Dangerous Ball in Middle" value={stats.dangerousBallMiddle} onChange={v => setStat('dangerousBallMiddle',v)} />
            <StatInput label="Bad Touch" value={stats.badTouch} onChange={v => setStat('badTouch',v)} />

            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #2a2a2a' }}>
              <p style={{ color: '#800000', fontSize: '0.7rem', letterSpacing: '0.12em', margin: '0 0 1rem 0', fontWeight: '700' }}>MY SELF-EVALUATION</p>
              {GRADE_CATS.map(cat => (
                <GradeSelector key={cat} label={cat} grades={selfGrades} setGrades={setSelfGrades} />
              ))}
            </div>
          </div>

          {/* RIGHT: Peer Eval */}
          <div className="section-panel">
            <h2 style={{ color: '#e0e0e0', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '0.08em', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1e3a5f', display: 'inline-block' }} />
              PEER EVALUATION
            </h2>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ color: '#616161', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>EVALUATING PLAYER</label>
              <select value={peerName} onChange={e => setPeerName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: peerName ? '#e0e0e0' : '#616161', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}>
                <option value="">-- Select teammate to evaluate --</option>
                {players.filter(p => p.name !== playerName).map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            {peerName ? (
              <>
                <p style={{ color: '#3b82f6', fontSize: '0.7rem', letterSpacing: '0.12em', margin: '0 0 1rem 0', fontWeight: '700' }}>GRADES FOR {peerName.toUpperCase()}</p>
                {GRADE_CATS.map(cat => (
                  <GradeSelector key={cat} label={cat} grades={peerGrades} setGrades={setPeerGrades} />
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#3a3a3a' }}>
                <p style={{ fontSize: '0.8rem', letterSpacing: '0.08em' }}>SELECT A PLAYER ABOVE<br/>TO ADD PEER EVALUATION</p>
              </div>
            )}

            {/* Coach section */}
            {role === 'coach' && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #2a2a2a' }}>
                <p style={{ color: '#a81212', fontSize: '0.7rem', letterSpacing: '0.12em', margin: '0 0 1rem 0', fontWeight: '700' }}>⚑ COACH GRADES FOR {playerName.toUpperCase()}</p>
                {GRADE_CATS.map(cat => (
                  <GradeSelector key={cat} label={cat} grades={coachGrades} setGrades={setCoachGrades} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes + Submit */}
        <div className="section-panel" style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#616161', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '0.5rem' }}>NOTES</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Film notes, timestamps, observations..."
            rows={3} style={{ width: '100%', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '0.5rem', color: '#e0e0e0', padding: '0.625rem 0.875rem', fontSize: '0.875rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', padding: '0.875rem', background: '#800000', border: 'none', borderRadius: '0.5rem', color: '#fff', fontWeight: '700', fontSize: '1rem', cursor: submitting ? 'wait' : 'pointer', letterSpacing: '0.05em', transition: 'background 0.15s' }}>
          {submitting ? 'SUBMITTING...' : 'SUBMIT FILM REPORT'}
        </button>
      </div>
    </div>
  )
}