'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Stats {
  pass: number; complete: number; shotOnGoal: number; shotNotOnGoal: number
  takeAway: number; loseBallDribbling: number; dangerousBallMiddle: number; badTouch: number
}
interface Grades { Passing: string; TakeAways: string; Touches: string; Control: string; Recovery: string }
interface Report {
  timestamp: string; gameId: string; gameLabel: string
  submittedBy: string; player: string; type: string
  stats: Stats; grades: Grades; filmMinute: string; notes: string
}
interface Player { name: string; potentialTeam: string }

const STAT_LABELS: [keyof Stats, string][] = [
  ['pass','Passes'],['complete','Completions'],['shotOnGoal','Shot on Goal'],
  ['shotNotOnGoal','Shot not on Goal'],['takeAway','Take Away'],
  ['loseBallDribbling','Lose Ball Dribbling'],['dangerousBallMiddle','Dangerous Ball in Middle'],['badTouch','Bad Touch'],
]
const GRADE_KEYS: (keyof Grades)[] = ['Passing','TakeAways','Touches','Control','Recovery']
const GRADE_LABEL: Record<string,string> = { Passing:'Passing', TakeAways:'Take Aways', Touches:'Touches', Control:'Control', Recovery:'Recovery' }
const GRADE_VAL: Record<string,number> = { A:4, B:3, C:2, D:1, F:0 }
const GRADE_FROM_VAL = (v: number) => ['F','D','C','B','A'][v] ?? '—'
const TEAM_COLORS: Record<string,string> = { Varsity:'#6b0000', JV:'#1e3a5f', Sophomore:'#166534', Freshman:'#713f12', Unassigned:'#3a3a3a' }

function teamColor(t: string) { return TEAM_COLORS[t] || '#4a4a4a' }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase() }

function sumStats(reports: Report[]): Stats {
  const out = { pass:0,complete:0,shotOnGoal:0,shotNotOnGoal:0,takeAway:0,loseBallDribbling:0,dangerousBallMiddle:0,badTouch:0 }
  for (const r of reports) for (const k of Object.keys(out) as (keyof Stats)[]) out[k] += r.stats[k] || 0
  return out
}

function avgGrade(reports: Report[], key: keyof Grades): string {
  const vals = reports.map(r => r.grades[key]).filter(g => g && GRADE_VAL[g] >= 0).map(g => GRADE_VAL[g])
  if (!vals.length) return '—'
  return GRADE_FROM_VAL(Math.round(vals.reduce((a,b) => a+b,0) / vals.length))
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0
  return (
    <div style={{ marginBottom:'0.625rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
        <span style={{ color:'#9e9e9e', fontSize:'0.78rem' }}>{label}</span>
        <span style={{ color:'#e0e0e0', fontSize:'0.78rem', fontWeight:700 }}>{value}</span>
      </div>
      <div style={{ background:'#2a2a2a', borderRadius:'3px', height:'6px' }}>
        <div style={{ width:`${pct}%`, height:'6px', borderRadius:'3px', background:'#6b0000', transition:'width 0.4s' }} />
      </div>
    </div>
  )
}

function GradeBadge({ grade }: { grade: string }) {
  if (!grade || grade === '—') return <span style={{ color:'#555', fontSize:'0.75rem' }}>—</span>
  const colors: Record<string,{bg:string;color:string}> = {
    A:{bg:'#0f2d1a',color:'#4ade80'}, B:{bg:'#1e2d4f',color:'#60a5fa'},
    C:{bg:'#2d2800',color:'#fbbf24'}, D:{bg:'#2d1a00',color:'#fb923c'}, F:{bg:'#2d0f0f',color:'#f87171'},
  }
  const c = colors[grade] || { bg:'#2a2a2a', color:'#9e9e9e' }
  return <span style={{ background:c.bg, color:c.color, borderRadius:'4px', padding:'2px 8px', fontSize:'0.75rem', fontWeight:700 }}>{grade}</span>
}

function MetricCard({ label, value }: { label: string; value: string|number }) {
  return (
    <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.625rem', padding:'0.875rem 1rem' }}>
      <p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.1em', margin:'0 0 0.35rem 0' }}>{label.toUpperCase()}</p>
      <p style={{ color:'#e0e0e0', fontSize:'1.5rem', fontWeight:800, margin:0 }}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState('')
  const [reports, setReports] = useState<Report[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'team'|'players'>('team')
  const [teamFilter, setTeamFilter] = useState('All')
  const [gameFilter, setGameFilter] = useState('All')
  const [selectedPlayer, setSelectedPlayer] = useState<string|null>(null)

  useEffect(() => {
    const r = sessionStorage.getItem('role')
    if (!r) { router.push('/'); return }
    setRole(r)
    Promise.all([fetch('/api/reports').then(r=>r.json()), fetch('/api/players').then(r=>r.json())])
      .then(([rd,pd]) => { setReports(rd.reports||[]); setPlayers(pd.players||[]); setLoading(false) })
      .catch(e => { setError('Failed to load: '+e.message); setLoading(false) })
  }, [router])

  const teams = useMemo(() => ['All',...Array.from(new Set(players.map(p=>p.potentialTeam).filter(Boolean))).sort()], [players])
  const games = useMemo(() => {
    const map = new Map<string,string>()
    for (const r of reports) if (r.gameId) map.set(r.gameId, r.gameLabel||r.gameId)
    return [{ id:'All', label:'All Games' },...Array.from(map.entries()).map(([id,label])=>({ id, label }))]
  }, [reports])
  const playerTeamMap = useMemo(() => { const m: Record<string,string> = {}; for (const p of players) m[p.name]=p.potentialTeam||'Unassigned'; return m }, [players])

  const selfReports = useMemo(() => reports.filter(r => {
    if (r.type !== 'self') return false
    if (gameFilter !== 'All' && r.gameId !== gameFilter) return false
    if (teamFilter !== 'All' && (playerTeamMap[r.player]||'Unassigned') !== teamFilter) return false
    return true
  }), [reports, gameFilter, teamFilter, playerTeamMap])

  const sLabel: React.CSSProperties = { color:'#616161', fontSize:'0.65rem', letterSpacing:'0.1em', display:'block', marginBottom:'0.35rem' }

  const TeamView = () => {
    const totals = sumStats(selfReports)
    const maxVal = Math.max(...Object.values(totals), 1)
    const compPct = totals.pass > 0 ? Math.round((totals.complete/totals.pass)*100) : 0
    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
          <MetricCard label="Players" value={new Set(selfReports.map(r=>r.player)).size} />
          <MetricCard label="Games" value={new Set(selfReports.map(r=>r.gameId)).size} />
          <MetricCard label="Total Passes" value={totals.pass} />
          <MetricCard label="Completion %" value={compPct+'%'} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'1.125rem' }}>
            <p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.12em', margin:'0 0 1rem 0' }}>AGGREGATE STATS</p>
            {STAT_LABELS.map(([k,label]) => <StatBar key={k} label={label} value={totals[k]} max={maxVal} />)}
          </div>
          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'1.125rem' }}>
            <p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.12em', margin:'0 0 1rem 0' }}>AVG SELF-EVAL GRADES</p>
            {GRADE_KEYS.map(k => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.5rem 0', borderBottom:'1px solid #222' }}>
                <span style={{ color:'#9e9e9e', fontSize:'0.82rem' }}>{GRADE_LABEL[k]}</span>
                <GradeBadge grade={avgGrade(selfReports,k)} />
              </div>
            ))}
            <p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.12em', margin:'1.25rem 0 0.75rem 0' }}>REPORTS PER GAME</p>
            {games.filter(g=>g.id!=='All').map(g => (
              <div key={g.id} style={{ display:'flex', justifyContent:'space-between', padding:'0.4rem 0', borderBottom:'1px solid #1e1e1e' }}>
                <span style={{ color:'#9e9e9e', fontSize:'0.78rem' }}>{g.label}</span>
                <span style={{ color:'#e0e0e0', fontSize:'0.78rem', fontWeight:700 }}>{selfReports.filter(r=>r.gameId===g.id).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const PlayersListView = () => {
    const playerNames = Array.from(new Set(selfReports.map(r=>r.player))).sort()
    if (!playerNames.length) return <div style={{ textAlign:'center', padding:'3rem', color:'#4a4a4a', fontSize:'0.85rem', letterSpacing:'0.08em' }}>NO REPORTS FOUND</div>
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
        {playerNames.map(name => {
          const pReports = selfReports.filter(r=>r.player===name)
          const peerCount = reports.filter(r=>r.player===name&&r.type==='peer').length
          const tot = sumStats(pReports)
          const compP = tot.pass > 0 ? Math.round((tot.complete/tot.pass)*100) : 0
          const team = playerTeamMap[name]||'Unassigned'
          return (
            <div key={name} onClick={()=>setSelectedPlayer(name)}
              style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'0.875rem 1.125rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor='#6b0000')}
              onMouseLeave={e=>(e.currentTarget.style.borderColor='#2a2a2a')}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.875rem' }}>
                <div style={{ width:'2.25rem', height:'2.25rem', borderRadius:'50%', background:teamColor(team), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(name)}</div>
                <div>
                  <p style={{ color:'#e0e0e0', fontWeight:700, margin:0, fontSize:'0.9rem' }}>{name}</p>
                  <p style={{ color:'#616161', fontSize:'0.72rem', margin:0 }}>{team} · {pReports.length} report{pReports.length!==1?'s':''} · {peerCount} peer eval{peerCount!==1?'s':''}</p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
                <div style={{ textAlign:'right' }}><p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.08em', margin:'0 0 2px 0' }}>PASSES</p><p style={{ color:'#e0e0e0', fontWeight:700, margin:0, fontSize:'0.9rem' }}>{tot.pass}</p></div>
                <div style={{ textAlign:'right' }}><p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.08em', margin:'0 0 2px 0' }}>COMP%</p><p style={{ color:'#e0e0e0', fontWeight:700, margin:0, fontSize:'0.9rem' }}>{compP}%</p></div>
                <div style={{ textAlign:'right' }}><p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.08em', margin:'0 0 2px 0' }}>PASSING</p><GradeBadge grade={avgGrade(pReports,'Passing')} /></div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b0000" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const PlayerDetailView = ({ name }: { name: string }) => {
    const selfP = reports.filter(r=>r.player===name&&r.type==='self')
    const peerReceived = reports.filter(r=>r.player===name&&r.type==='peer')
    const peerGiven = reports.filter(r=>r.submittedBy===name&&r.type==='peer')
    const coachP = reports.filter(r=>r.player===name&&r.type==='coach')
    const team = playerTeamMap[name]||'Unassigned'
    const totals = sumStats(selfP)
    const compPct = totals.pass > 0 ? Math.round((totals.complete/totals.pass)*100) : 0
    const gameBreakdown = Array.from(new Set(selfP.map(r=>r.gameId))).map(gid => {
      const reps = selfP.filter(r=>r.gameId===gid)
      return { gid, label:reps[0]?.gameLabel||gid, count:reps.length, totals:sumStats(reps) }
    })
    return (
      <div>
        <button onClick={()=>setSelectedPlayer(null)} style={{ background:'transparent', border:'1px solid #333', borderRadius:'0.5rem', color:'#9e9e9e', padding:'0.375rem 0.75rem', fontSize:'0.8rem', cursor:'pointer', marginBottom:'1rem' }}>← All Players</button>
        <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'1.125rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem' }}>
            <div style={{ width:'3rem', height:'3rem', borderRadius:'50%', background:teamColor(team), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', fontWeight:700, color:'#fff' }}>{initials(name)}</div>
            <div><h2 style={{ color:'#e0e0e0', fontWeight:800, margin:0, fontSize:'1.1rem', letterSpacing:'0.04em' }}>{name.toUpperCase()}</h2><p style={{ color:'#616161', fontSize:'0.75rem', margin:0 }}>{team}</p></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.625rem', marginBottom:'1rem' }}>
            <MetricCard label="Self Reports" value={selfP.length} />
            <MetricCard label="Peer Evals Received" value={peerReceived.length} />
            <MetricCard label="Total Passes" value={totals.pass} />
            <MetricCard label="Completion %" value={compPct+'%'} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.625rem' }}>
            {([['SELF GRADES',selfP,'#6b0000'],['PEER GRADES',peerReceived,'#1e3a5f'],['COACH GRADES',coachP,'#166534']] as [string,Report[],string][]).map(([label,reps,color]) => (
              <div key={label} style={{ background:'#111', border:`1px solid ${color}33`, borderRadius:'0.625rem', padding:'0.875rem' }}>
                <p style={{ color, fontSize:'0.65rem', letterSpacing:'0.1em', margin:'0 0 0.75rem 0', fontWeight:700 }}>{label}</p>
                {GRADE_KEYS.map(k => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'0.3rem 0', borderBottom:'1px solid #1e1e1e' }}>
                    <span style={{ color:'#757575', fontSize:'0.72rem' }}>{GRADE_LABEL[k]}</span>
                    <GradeBadge grade={avgGrade(reps,k)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'1.125rem', marginBottom:'1rem' }}>
          <p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.12em', margin:'0 0 0.875rem 0' }}>GAME-BY-GAME BREAKDOWN</p>
          {!gameBreakdown.length && <p style={{ color:'#4a4a4a', fontSize:'0.82rem' }}>No self-reports yet.</p>}
          {gameBreakdown.map(({ gid, label, count, totals:gt }) => (
            <div key={gid} style={{ padding:'0.75rem 0', borderBottom:'1px solid #1e1e1e' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem' }}>
                <span style={{ color:'#e0e0e0', fontSize:'0.85rem', fontWeight:700 }}>{label}</span>
                <span style={{ color:'#616161', fontSize:'0.72rem' }}>{count} report{count!==1?'s':''}</span>
              </div>
              <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                {STAT_LABELS.slice(0,4).map(([k,lbl]) => <span key={k} style={{ color:'#9e9e9e', fontSize:'0.75rem' }}>{lbl}: <strong style={{ color:'#e0e0e0' }}>{gt[k]}</strong></span>)}
              </div>
            </div>
          ))}
        </div>
        {peerGiven.length > 0 && (
          <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'1.125rem' }}>
            <p style={{ color:'#616161', fontSize:'0.65rem', letterSpacing:'0.12em', margin:'0 0 0.875rem 0' }}>PEER EVALS GIVEN BY {name.split(' ')[0].toUpperCase()}</p>
            {peerGiven.map((r,i) => (
              <div key={i} style={{ padding:'0.625rem 0', borderBottom:'1px solid #1e1e1e' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'#e0e0e0', fontSize:'0.82rem', fontWeight:600 }}>{r.player}</span>
                  <span style={{ color:'#616161', fontSize:'0.72rem' }}>{r.gameLabel}</span>
                </div>
                <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginTop:'0.25rem' }}>
                  {GRADE_KEYS.map(k => r.grades[k] ? <span key={k} style={{ color:'#757575', fontSize:'0.72rem' }}>{GRADE_LABEL[k]}: <GradeBadge grade={r.grades[k]} /></span> : null)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', padding:'1.5rem' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <div style={{ width:'3px', height:'1.5rem', background:'#6b0000', borderRadius:'2px' }} />
              <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'#e0e0e0', margin:0, letterSpacing:'0.04em' }}>DASHBOARD</h1>
            </div>
            <p style={{ color:'#616161', fontSize:'0.75rem', letterSpacing:'0.12em', margin:'0.25rem 0 0 0.6rem' }}>LONE PEAK KNIGHTS · {role==='coach'?'COACH VIEW':'PLAYER VIEW'}</p>
          </div>
          <div style={{ display:'flex', gap:'0.625rem' }}>
            <button onClick={()=>router.push('/roster')} style={{ background:'transparent', border:'1px solid #3a3a3a', borderRadius:'0.5rem', color:'#9e9e9e', padding:'0.4rem 0.875rem', fontSize:'0.8rem', cursor:'pointer' }}>← ROSTER</button>
            <button onClick={()=>{ sessionStorage.clear(); router.push('/') }} style={{ background:'transparent', border:'1px solid #3a3a3a', borderRadius:'0.5rem', color:'#9e9e9e', padding:'0.4rem 0.875rem', fontSize:'0.8rem', cursor:'pointer' }}>LOGOUT</button>
          </div>
        </div>
        <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:'0.75rem', padding:'1rem 1.25rem', marginBottom:'1rem', display:'flex', gap:'1.25rem', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={sLabel}>TEAM</label>
            <div style={{ display:'flex', gap:'0.375rem', flexWrap:'wrap' }}>
              {teams.map(t => (
                <button key={t} onClick={()=>{ setTeamFilter(t); setSelectedPlayer(null) }}
                  style={{ padding:'0.3rem 0.75rem', borderRadius:'1rem', fontSize:'0.75rem', fontWeight:600, cursor:'pointer', background:teamFilter===t?'#6b0000':'#2a2a2a', border:teamFilter===t?'1px solid #800000':'1px solid #3a3a3a', color:teamFilter===t?'#fff':'#9e9e9e' }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ flex:1, minWidth:'200px' }}>
            <label style={sLabel}>GAME</label>
            <select value={gameFilter} onChange={e=>{ setGameFilter(e.target.value); setSelectedPlayer(null) }}
              style={{ width:'100%', padding:'0.5rem 0.75rem', background:'#2a2a2a', border:'1px solid #3a3a3a', borderRadius:'0.5rem', color:'#e0e0e0', fontSize:'0.875rem', outline:'none' }}>
              {games.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {!selectedPlayer && (
            <div>
              <label style={sLabel}>VIEW</label>
              <div style={{ display:'flex', gap:'0.375rem' }}>
                {(['team','players'] as const).map(v => (
                  <button key={v} onClick={()=>setView(v)}
                    style={{ padding:'0.3rem 0.875rem', borderRadius:'1rem', fontSize:'0.75rem', fontWeight:600, cursor:'pointer', background:view===v?'#6b0000':'#2a2a2a', border:view===v?'1px solid #800000':'1px solid #3a3a3a', color:view===v?'#fff':'#9e9e9e' }}>
                    {v==='team'?'TEAM':'PLAYERS'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {loading && <div style={{ textAlign:'center', padding:'4rem', color:'#616161', fontSize:'0.85rem', letterSpacing:'0.1em' }}>▋ LOADING REPORTS...</div>}
        {error && <div style={{ background:'#1a0000', border:'1px solid #6b0000', borderRadius:'0.5rem', padding:'0.875rem', marginBottom:'1rem' }}><p style={{ color:'#f49898', fontSize:'0.85rem', margin:0 }}>{error}</p></div>}
        {!loading && !error && (selectedPlayer ? <PlayerDetailView name={selectedPlayer} /> : view==='team' ? <TeamView /> : <PlayersListView />)}
      </div>
    </div>
  )
}