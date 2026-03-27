'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Stats { pass:number;complete:number;goals:number;assists:number;shotOnGoal:number;shotNotOnGoal:number;takeAway:number;loseBallDribbling:number;dangerousBallMiddle:number;badTouch:number }
interface Grades { Passing:string;TakeAways:string;Touches:string;Control:string;Recovery:string }
interface Report { timestamp:string;gameId:string;gameLabel:string;submittedBy:string;player:string;type:string;stats:Stats;grades:Grades;filmMinute:string;notes:string;perfGrade:string;perfScore:number }
interface Player { name:string;potentialTeam:string }

const STAT_LABELS:[keyof Stats,string][] = [['pass','Passes'],['complete','Completions'],['goals','Goals'],['assists','Assists'],['shotOnGoal','Shot on Goal'],['shotNotOnGoal','Shot not on Goal'],['takeAway','Take Away'],['loseBallDribbling','Lose Ball Dribbling'],['dangerousBallMiddle','Dangerous Ball in Middle'],['badTouch','Bad Touch']]
const GRADE_KEYS:(keyof Grades)[] = ['Passing','TakeAways','Touches','Control','Recovery']
const GRADE_LABEL:Record<string,string> = {Passing:'Passing',TakeAways:'Take Aways',Touches:'Touches',Control:'Control',Recovery:'Recovery'}
const GRADE_ORDER = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F']
const TEAM_COLORS:Record<string,string> = {Varsity:'#6b0000',JV:'#1e3a5f',Sophomore:'#166534',Freshman:'#713f12',Unassigned:'#3a3a3a'}

const teamColor = (t:string) => TEAM_COLORS[t]||'#4a4a4a'
const initials = (name:string) => name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()

function sumStats(reps:Report[]):Stats {
  const out={pass:0,complete:0,goals:0,assists:0,shotOnGoal:0,shotNotOnGoal:0,takeAway:0,loseBallDribbling:0,dangerousBallMiddle:0,badTouch:0}
  for(const r of reps) for(const k of Object.keys(out) as (keyof Stats)[]) out[k]+=r.stats[k]||0
  return out
}

const gradeVal = (g:string) => Math.max(0, 11-GRADE_ORDER.indexOf(g))
function avgGradeStr(grades:string[]):string {
  const valid=grades.filter(g=>GRADE_ORDER.includes(g))
  if(!valid.length) return '—'
  const avg=valid.reduce((a,g)=>a+gradeVal(g),0)/valid.length
  return GRADE_ORDER[Math.max(0,Math.round(11-avg))]||'—'
}

function gradeStyle(g:string):React.CSSProperties {
  if(!g||g==='—') return {background:'#2a2a2a',color:'#555'}
  if(g.startsWith('A')) return {background:'#0f2d1a',color:'#4ade80'}
  if(g.startsWith('B')) return {background:'#1e2d4f',color:'#60a5fa'}
  if(g.startsWith('C')) return {background:'#2d2800',color:'#fbbf24'}
  if(g.startsWith('D')) return {background:'#2d1a00',color:'#fb923c'}
  return {background:'#2d0f0f',color:'#f87171'}
}

function GradePill({grade,large}:{grade:string;large?:boolean}) {
  const s=gradeStyle(grade)
  return <span style={{...s,borderRadius:'6px',padding:large?'6px 14px':'2px 9px',fontSize:large?'1.1rem':'0.75rem',fontWeight:700,display:'inline-block',letterSpacing:'0.03em'}}>{grade||'—'}</span>
}

function TrendArrow({prev,curr}:{prev:string;curr:string}) {
  if(!prev||!curr||prev==='—'||curr==='—') return null
  const diff=gradeVal(curr)-gradeVal(prev)
  if(diff>0) return <span style={{color:'#4ade80',fontSize:'0.8rem',marginLeft:'4px'}}>▲</span>
  if(diff<0) return <span style={{color:'#f87171',fontSize:'0.8rem',marginLeft:'4px'}}>▼</span>
  return <span style={{color:'#616161',fontSize:'0.8rem',marginLeft:'4px'}}>—</span>
}

function MetricCard({label,value}:{label:string;value:string|number}) {
  return <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.625rem',padding:'0.875rem 1rem'}}><p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 0.35rem 0'}}>{label.toUpperCase()}</p><p style={{color:'#e0e0e0',fontSize:'1.5rem',fontWeight:800,margin:0}}>{value}</p></div>
}

function StatBar({label,value,max}:{label:string;value:number;max:number}) {
  const pct=max>0?Math.round((value/max)*100):0
  return <div style={{marginBottom:'0.625rem'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.2rem'}}><span style={{color:'#9e9e9e',fontSize:'0.78rem'}}>{label}</span><span style={{color:'#e0e0e0',fontSize:'0.78rem',fontWeight:700}}>{value}</span></div><div style={{background:'#2a2a2a',borderRadius:'3px',height:'6px'}}><div style={{width:pct+'%',height:'6px',borderRadius:'3px',background:'#6b0000',transition:'width 0.4s'}}/></div></div>
}

function getImprovementNotes(prev:Stats,curr:Stats,prevGrade:string,currGrade:string):string[] {
  const notes:string[]=[]
  const cp=prev.pass>0?(prev.complete/prev.pass)*100:0
  const cc=curr.pass>0?(curr.complete/curr.pass)*100:0
  if(cc-cp>5) notes.push('Passing accuracy improved '+Math.round(cc-cp)+'% ('+Math.round(cp)+'% → '+Math.round(cc)+'%)')
  if(cp-cc>5) notes.push('Passing accuracy dropped '+Math.round(cp-cc)+'% ('+Math.round(cp)+'% → '+Math.round(cc)+'%)')
  if(curr.goals>prev.goals) notes.push('+'+(curr.goals-prev.goals)+' goal'+(curr.goals-prev.goals>1?'s':'')+' vs previous game')
  if(curr.takeAway>prev.takeAway) notes.push('Takeaways up '+(curr.takeAway-prev.takeAway)+' ('+prev.takeAway+' → '+curr.takeAway+')')
  if(curr.takeAway<prev.takeAway) notes.push('Takeaways down '+(prev.takeAway-curr.takeAway)+' ('+prev.takeAway+' → '+curr.takeAway+')')
  if(curr.loseBallDribbling>prev.loseBallDribbling+1) notes.push('Ball losses dribbling up '+(curr.loseBallDribbling-prev.loseBallDribbling)+' — area to work on')
  if(curr.loseBallDribbling<prev.loseBallDribbling-1) notes.push('Ball losses dribbling reduced '+(prev.loseBallDribbling-curr.loseBallDribbling))
  if(curr.badTouch>prev.badTouch+2) notes.push('Bad touches up '+(curr.badTouch-prev.badTouch)+' — focus area')
  if(curr.badTouch<prev.badTouch-2) notes.push('Bad touches reduced by '+(prev.badTouch-curr.badTouch))
  if(curr.dangerousBallMiddle>prev.dangerousBallMiddle+1) notes.push('Dangerous balls in middle increased — decision-making focus')
  const gDiff=gradeVal(currGrade)-gradeVal(prevGrade)
  if(gDiff>=2) notes.push('Overall grade improved significantly ('+prevGrade+' → '+currGrade+')')
  else if(gDiff<=-2) notes.push('Overall grade declined ('+prevGrade+' → '+currGrade+') — review film')
  return notes
}

export default function DashboardPage() {
  const router=useRouter()
  const [role,setRole]=useState('')
  const [reports,setReports]=useState<Report[]>([])
  const [players,setPlayers]=useState<Player[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [view,setView]=useState<'team'|'players'>('team')
  const [teamFilter,setTeamFilter]=useState('All')
  const [gameFilter,setGameFilter]=useState('All')
  const [selectedPlayer,setSelectedPlayer]=useState<string|null>(null)

  useEffect(()=>{
    const r=sessionStorage.getItem('role')
    if(!r){router.push('/');return}
    setRole(r)
    Promise.all([fetch('/api/reports').then(r=>r.json()),fetch('/api/players').then(r=>r.json())])
      .then(([rd,pd])=>{setReports(rd.reports||[]);setPlayers(pd.players||[]);setLoading(false)})
      .catch(e=>{setError('Failed to load: '+e.message);setLoading(false)})
  },[router])

  const teams=useMemo(()=>['All',...Array.from(new Set(players.map(p=>p.potentialTeam).filter(Boolean))).sort()],[players])
  const games=useMemo(()=>{const map=new Map<string,string>();for(const r of reports) if(r.gameId) map.set(r.gameId,r.gameLabel||r.gameId);return [{id:'All',label:'All Games'},...Array.from(map.entries()).map(([id,label])=>({id,label}))];},[reports])
  const playerTeamMap=useMemo(()=>{const m:Record<string,string>={};for(const p of players) m[p.name]=p.potentialTeam||'Unassigned';return m;},[players])

  const selfReports=useMemo(()=>reports.filter(r=>{
    if(r.type!=='self') return false
    if(gameFilter!=='All'&&r.gameId!==gameFilter) return false
    if(teamFilter!=='All'&&(playerTeamMap[r.player]||'Unassigned')!==teamFilter) return false
    return true
  }),[reports,gameFilter,teamFilter,playerTeamMap])

  const sLabel:React.CSSProperties={color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',display:'block',marginBottom:'0.35rem'}

  const TeamView=()=>{
    const totals=sumStats(selfReports)
    const maxVal=Math.max(...Object.values(totals),1)
    const compPct=totals.pass>0?Math.round((totals.complete/totals.pass)*100):0
    const teamGrade=avgGradeStr(selfReports.map(r=>r.perfGrade).filter(Boolean))
    const gameIds=games.filter(g=>g.id!=='All').map(g=>g.id)
    return (
      <div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'0.75rem',marginBottom:'1rem'}}>
          <MetricCard label="Players" value={new Set(selfReports.map(r=>r.player)).size}/>
          <MetricCard label="Games" value={new Set(selfReports.map(r=>r.gameId)).size}/>
          <MetricCard label="Total Passes" value={totals.pass}/>
          <MetricCard label="Completion %" value={compPct+'%'}/>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.625rem',padding:'0.875rem 1rem',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 0.35rem 0'}}>TEAM PERF GRADE</p>
            <GradePill grade={teamGrade} large/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 1rem 0'}}>AGGREGATE STATS</p>
            {STAT_LABELS.map(([k,label])=><StatBar key={k} label={label} value={totals[k]} max={maxVal}/>)}
          </div>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 1rem 0'}}>TEAM PERFORMANCE BY GAME</p>
            {gameIds.length===0&&<p style={{color:'#4a4a4a',fontSize:'0.82rem'}}>No game data yet.</p>}
            {gameIds.map((gid,i)=>{
              const gReps=selfReports.filter(r=>r.gameId===gid)
              const gLabel=games.find(g=>g.id===gid)?.label||gid
              const gGrade=avgGradeStr(gReps.map(r=>r.perfGrade).filter(Boolean))
              const prevGid=gameIds[i-1]
              const prevGrade=prevGid?avgGradeStr(selfReports.filter(r=>r.gameId===prevGid).map(r=>r.perfGrade).filter(Boolean)):''
              return <div key={gid} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem 0',borderBottom:'1px solid #1e1e1e'}}>
                <div><p style={{color:'#e0e0e0',fontSize:'0.82rem',fontWeight:600,margin:0}}>{gLabel}</p><p style={{color:'#616161',fontSize:'0.7rem',margin:0}}>{gReps.length} report{gReps.length!==1?'s':''}</p></div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}><GradePill grade={gGrade}/><TrendArrow prev={prevGrade} curr={gGrade}/></div>
              </div>
            })}
          </div>
        </div>
      </div>
    )
  }

  const PlayersListView=()=>{
    const playerNames=Array.from(new Set(selfReports.map(r=>r.player))).sort()
    if(!playerNames.length) return <div style={{textAlign:'center',padding:'3rem',color:'#4a4a4a',fontSize:'0.85rem',letterSpacing:'0.08em'}}>NO REPORTS FOUND</div>
    return <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
      {playerNames.map(name=>{
        const pReps=selfReports.filter(r=>r.player===name)
        const peerCount=reports.filter(r=>r.player===name&&r.type==='peer').length
        const tot=sumStats(pReps)
        const compP=tot.pass>0?Math.round((tot.complete/tot.pass)*100):0
        const team=playerTeamMap[name]||'Unassigned'
        const seasonGrade=avgGradeStr(pReps.map(r=>r.perfGrade).filter(Boolean))
        return <div key={name} onClick={()=>setSelectedPlayer(name)}
          style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'0.875rem 1.125rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}
          onMouseEnter={e=>(e.currentTarget.style.borderColor='#6b0000')}
          onMouseLeave={e=>(e.currentTarget.style.borderColor='#2a2a2a')}>
          <div style={{display:'flex',alignItems:'center',gap:'0.875rem'}}>
            <div style={{width:'2.25rem',height:'2.25rem',borderRadius:'50%',background:teamColor(team),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:700,color:'#fff',flexShrink:0}}>{initials(name)}</div>
            <div><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{name}</p><p style={{color:'#616161',fontSize:'0.72rem',margin:0}}>{team} · {pReps.length} report{pReps.length!==1?'s':''} · {peerCount} peer eval{peerCount!==1?'s':''}</p></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'1.25rem'}}>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.08em',margin:'0 0 2px 0'}}>PASSES</p><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{tot.pass}</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.08em',margin:'0 0 2px 0'}}>GOALS</p><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{tot.goals}</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.08em',margin:'0 0 2px 0'}}>COMP%</p><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{compP}%</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.08em',margin:'0 0 4px 0'}}>SEASON</p><GradePill grade={seasonGrade}/></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b0000" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      })}
    </div>
  }

  const PlayerDetailView=({name}:{name:string})=>{
    const selfP=reports.filter(r=>r.player===name&&r.type==='self').sort((a,b)=>a.gameId.localeCompare(b.gameId))
    const peerReceived=reports.filter(r=>r.player===name&&r.type==='peer')
    const peerGiven=reports.filter(r=>r.submittedBy===name&&r.type==='peer')
    const coachP=reports.filter(r=>r.player===name&&r.type==='coach')
    const team=playerTeamMap[name]||'Unassigned'
    const totals=sumStats(selfP)
    const compPct=totals.pass>0?Math.round((totals.complete/totals.pass)*100):0
    const seasonGrade=avgGradeStr(selfP.map(r=>r.perfGrade).filter(Boolean))
    const perfScores=selfP.filter(r=>r.perfScore>0).map(r=>r.perfScore)
    const avgScore=perfScores.length?Math.round(perfScores.reduce((a,b)=>a+b,0)/perfScores.length):0
    const gameBreakdown=selfP.map((r,i)=>({r,prev:selfP[i-1],improvement:selfP[i-1]?getImprovementNotes(selfP[i-1].stats,r.stats,selfP[i-1].perfGrade,r.perfGrade):[]}))
    return (
      <div>
        <button onClick={()=>setSelectedPlayer(null)} style={{background:'transparent',border:'1px solid #333',borderRadius:'0.5rem',color:'#9e9e9e',padding:'0.375rem 0.75rem',fontSize:'0.8rem',cursor:'pointer',marginBottom:'1rem'}}>← All Players</button>
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem',marginBottom:'1rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem'}}>
            <div style={{width:'3rem',height:'3rem',borderRadius:'50%',background:teamColor(team),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.9rem',fontWeight:700,color:'#fff'}}>{initials(name)}</div>
            <div style={{flex:1}}><h2 style={{color:'#e0e0e0',fontWeight:800,margin:0,fontSize:'1.1rem',letterSpacing:'0.04em'}}>{name.toUpperCase()}</h2><p style={{color:'#616161',fontSize:'0.75rem',margin:0}}>{team}</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 6px 0'}}>SEASON GRADE</p><GradePill grade={seasonGrade} large/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'0.625rem',marginBottom:'1rem'}}>
            <MetricCard label="Games" value={selfP.length}/>
            <MetricCard label="Goals" value={totals.goals}/>
            <MetricCard label="Assists" value={totals.assists}/>
            <MetricCard label="Comp %" value={compPct+'%'}/>
            <MetricCard label="Avg Score" value={avgScore||'—'}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.625rem'}}>
            {([['SELF EVAL GRADES',selfP,'#6b0000'],['PEER EVAL GRADES',peerReceived,'#1e3a5f'],['COACH GRADES',coachP,'#166534']] as [string,Report[],string][]).map(([label,reps,color])=>(
              <div key={label} style={{background:'#111',border:'1px solid '+color+'33',borderRadius:'0.625rem',padding:'0.875rem'}}>
                <p style={{color,fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 0.75rem 0',fontWeight:700}}>{label}</p>
                {GRADE_KEYS.map(k=>{
                  const g=avgGradeStr(reps.map(r=>r.grades[k]).filter(Boolean))
                  return <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'0.3rem 0',borderBottom:'1px solid #1e1e1e'}}><span style={{color:'#757575',fontSize:'0.72rem'}}>{GRADE_LABEL[k]}</span><GradePill grade={g}/></div>
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem',marginBottom:'1rem'}}>
          <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 1rem 0'}}>PERFORMANCE GRADE BY GAME</p>
          {!gameBreakdown.length&&<p style={{color:'#4a4a4a',fontSize:'0.82rem'}}>No self-reports yet.</p>}
          {gameBreakdown.map(({r,prev,improvement},i)=>{
            const peerForGame=peerReceived.filter(p=>p.gameId===r.gameId)
            const peerGradeForGame=peerForGame.length?avgGradeStr(peerForGame.map(p=>p.perfGrade).filter(Boolean)):null
            return <div key={r.gameId+i} style={{padding:'0.875rem 0',borderBottom:'1px solid #1e1e1e'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                <div><span style={{color:'#e0e0e0',fontSize:'0.9rem',fontWeight:700}}>{r.gameLabel||r.gameId}</span>{r.filmMinute&&<span style={{color:'#616161',fontSize:'0.7rem',marginLeft:'8px'}}>Film: {r.filmMinute}</span>}</div>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 3px 0'}}>PERF GRADE</p><div style={{display:'flex',alignItems:'center'}}><GradePill grade={r.perfGrade||'—'}/>{prev&&<TrendArrow prev={prev.perfGrade} curr={r.perfGrade}/>}</div></div>
                  {peerGradeForGame&&<div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 3px 0'}}>PEER VIEW</p><GradePill grade={peerGradeForGame}/></div>}
                </div>
              </div>
              <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:improvement.length?'0.5rem':0}}>
                {[['pass','P'],['complete','Comp'],['goals','G'],['assists','A'],['shotOnGoal','SoG'],['takeAway','TA'],['badTouch','BT']].map(([k,lbl])=><span key={k} style={{color:'#757575',fontSize:'0.72rem'}}>{lbl}: <strong style={{color:'#9e9e9e'}}>{r.stats[k as keyof Stats]}</strong></span>)}
              </div>
              {improvement.length>0&&<div style={{marginTop:'0.5rem'}}>{improvement.map((note,ni)=><div key={ni} style={{display:'flex',alignItems:'flex-start',gap:'6px',marginBottom:'2px'}}><span style={{color:'#6b0000',fontSize:'0.7rem',marginTop:'1px'}}>•</span><span style={{color:'#9e9e9e',fontSize:'0.72rem'}}>{note}</span></div>)}</div>}
              {r.notes&&<p style={{color:'#616161',fontSize:'0.72rem',marginTop:'0.375rem',fontStyle:'italic'}}>"{r.notes}"</p>}
            </div>
          })}
        </div>
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem',marginBottom:'1rem'}}>
          <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 0.875rem 0'}}>SEASON TOTALS</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0 1.5rem'}}>
            {STAT_LABELS.map(([k,label])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'0.35rem 0',borderBottom:'1px solid #1e1e1e'}}><span style={{color:'#9e9e9e',fontSize:'0.78rem'}}>{label}</span><span style={{color:'#e0e0e0',fontSize:'0.78rem',fontWeight:700}}>{totals[k]}</span></div>)}
          </div>
        </div>
        {peerGiven.length>0&&<div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem'}}>
          <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 0.875rem 0'}}>PEER EVALS GIVEN BY {name.split(' ')[0].toUpperCase()}</p>
          {peerGiven.map((r,i)=><div key={i} style={{padding:'0.625rem 0',borderBottom:'1px solid #1e1e1e'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#e0e0e0',fontSize:'0.82rem',fontWeight:600}}>{r.player}</span><span style={{color:'#616161',fontSize:'0.72rem'}}>{r.gameLabel}</span></div>
            <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginTop:'0.25rem'}}>{GRADE_KEYS.map(k=>r.grades[k]?<span key={k} style={{color:'#757575',fontSize:'0.72rem'}}>{GRADE_LABEL[k]}: <GradePill grade={r.grades[k]}/></span>:null)}</div>
          </div>)}
        </div>}
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',padding:'1.5rem'}}>
      <div style={{maxWidth:'1100px',margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'0.75rem'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <div style={{width:'3px',height:'1.5rem',background:'#6b0000',borderRadius:'2px'}}/>
              <h1 style={{fontSize:'1.4rem',fontWeight:800,color:'#e0e0e0',margin:0,letterSpacing:'0.04em'}}>DASHBOARD</h1>
            </div>
            <p style={{color:'#616161',fontSize:'0.75rem',letterSpacing:'0.12em',margin:'0.25rem 0 0 0.6rem'}}>LONE PEAK KNIGHTS · {role==='coach'?'COACH VIEW':'PLAYER VIEW'}</p>
          </div>
          <div style={{display:'flex',gap:'0.625rem'}}>
            <button onClick={()=>router.push('/roster')} style={{background:'transparent',border:'1px solid #3a3a3a',borderRadius:'0.5rem',color:'#9e9e9e',padding:'0.4rem 0.875rem',fontSize:'0.8rem',cursor:'pointer'}}>← ROSTER</button>
            <button onClick={()=>{sessionStorage.clear();router.push('/')}} style={{background:'transparent',border:'1px solid #3a3a3a',borderRadius:'0.5rem',color:'#9e9e9e',padding:'0.4rem 0.875rem',fontSize:'0.8rem',cursor:'pointer'}}>LOGOUT</button>
          </div>
        </div>
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1rem 1.25rem',marginBottom:'1rem',display:'flex',gap:'1.25rem',flexWrap:'wrap',alignItems:'flex-end'}}>
          <div><label style={sLabel}>TEAM</label><div style={{display:'flex',gap:'0.375rem',flexWrap:'wrap'}}>{teams.map(t=><button key={t} onClick={()=>{setTeamFilter(t);setSelectedPlayer(null)}} style={{padding:'0.3rem 0.75rem',borderRadius:'1rem',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',background:teamFilter===t?'#6b0000':'#2a2a2a',border:teamFilter===t?'1px solid #800000':'1px solid #3a3a3a',color:teamFilter===t?'#fff':'#9e9e9e'}}>{t}</button>)}</div></div>
          <div style={{flex:1,minWidth:'200px'}}><label style={sLabel}>GAME</label><select value={gameFilter} onChange={e=>{setGameFilter(e.target.value);setSelectedPlayer(null)}} style={{width:'100%',padding:'0.5rem 0.75rem',background:'#2a2a2a',border:'1px solid #3a3a3a',borderRadius:'0.5rem',color:'#e0e0e0',fontSize:'0.875rem',outline:'none'}}>{games.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
          {!selectedPlayer&&<div><label style={sLabel}>VIEW</label><div style={{display:'flex',gap:'0.375rem'}}>{(['team','players'] as const).map(v=><button key={v} onClick={()=>setView(v)} style={{padding:'0.3rem 0.875rem',borderRadius:'1rem',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',background:view===v?'#6b0000':'#2a2a2a',border:view===v?'1px solid #800000':'1px solid #3a3a3a',color:view===v?'#fff':'#9e9e9e'}}>{v==='team'?'TEAM':'PLAYERS'}</button>)}</div></div>}
        </div>
        {loading&&<div style={{textAlign:'center',padding:'4rem',color:'#616161',fontSize:'0.85rem',letterSpacing:'0.1em'}}>○ LOADING REPORTS...</div>}
        {error&&<div style={{background:'#1a0000',border:'1px solid #6b0000',borderRadius:'0.5rem',padding:'0.875rem',marginBottom:'1rem'}}><p style={{color:'#f49898',fontSize:'0.85rem',margin:0}}>{error}</p></div>}
        {!loading&&!error&&(selectedPlayer?<PlayerDetailView name={selectedPlayer}/>:view==='team'?<TeamView/>:<PlayersListView/>)}
      </div>
    </div>
  )
}
