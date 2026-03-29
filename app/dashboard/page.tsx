'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Stats { pass:number;complete:number;goals:number;assists:number;shotOnGoal:number;shotNotOnGoal:number;takeAway:number;loseBallDribbling:number;dangerousBallMiddle:number;badTouch:number }
interface Grades { Passing:string;TakeAways:string;Touches:string;Control:string;Recovery:string }
interface Report { rowIndex:number;timestamp:string;gameId:string;gameLabel:string;submittedBy:string;player:string;type:string;stats:Stats;grades:Grades;filmMinute:string;notes:string;perfGrade:string;perfScore:number }
interface Player { name:string;potentialTeam:string }

const STAT_LABELS:[keyof Stats,string][] = [['pass','Passes'],['complete','Completions'],['goals','Goals'],['assists','Assists'],['shotOnGoal','Shot on Goal'],['shotNotOnGoal','Shot not on Goal'],['takeAway','Take Away'],['loseBallDribbling','Lose Ball Dribbling'],['dangerousBallMiddle','Dangerous Ball in Middle'],['badTouch','Bad Touch']]
const GRADE_KEYS:(keyof Grades)[] = ['Passing','TakeAways','Touches','Control','Recovery']
const GRADE_LABEL:Record<string,string> = {Passing:'Passing',TakeAways:'Take Aways',Touches:'Touches',Control:'Control',Recovery:'Recovery'}
const GRADE_ORDER = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F']
const TEAM_COLORS:Record<string,string> = {Varsity:'#6b0000',JV:'#1e3a5f',Sophomore:'#166534',Freshman:'#713f12',Unassigned:'#3a3a3a'}

const teamColor=(t:string)=>TEAM_COLORS[t]||'#4a4a4a'
const initials=(name:string)=>name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()

function sumStats(reps:Report[]):Stats {
  const out={pass:0,complete:0,goals:0,assists:0,shotOnGoal:0,shotNotOnGoal:0,takeAway:0,loseBallDribbling:0,dangerousBallMiddle:0,badTouch:0}
  for(const r of reps) for(const k of Object.keys(out) as (keyof Stats)[]) out[k]+=r.stats[k]||0
  return out
}

const gradeVal=(g:string)=>Math.max(0,11-GRADE_ORDER.indexOf(g))
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
  return <div style={{marginBottom:'0.5rem'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.2rem'}}><span style={{color:'#9e9e9e',fontSize:'0.78rem'}}>{label}</span><span style={{color:'#e0e0e0',fontSize:'0.78rem',fontWeight:700}}>{value}</span></div><div style={{background:'#2a2a2a',borderRadius:'3px',height:'6px'}}><div style={{width:pct+'%',height:'6px',borderRadius:'3px',background:'#6b0000',transition:'width 0.4s'}}/></div></div>
}

function getImprovementNotes(prev:Stats,curr:Stats,prevGrade:string,currGrade:string):string[] {
  const notes:string[]=[]
  const cp=prev.pass>0?(prev.complete/prev.pass)*100:0
  const cc=curr.pass>0?(curr.complete/curr.pass)*100:0
  if(cc-cp>5) notes.push('Passing accuracy +'+Math.round(cc-cp)+'% ('+Math.round(cp)+'% → '+Math.round(cc)+'%)')
  if(cp-cc>5) notes.push('Passing accuracy -'+Math.round(cp-cc)+'% ('+Math.round(cp)+'% → '+Math.round(cc)+'%) — focus area')
  if(curr.goals>prev.goals) notes.push('+'+(curr.goals-prev.goals)+' goal'+(curr.goals-prev.goals>1?'s':'')+' vs previous game')
  if(curr.takeAway>prev.takeAway) notes.push('Takeaways up '+(curr.takeAway-prev.takeAway)+' ('+prev.takeAway+' → '+curr.takeAway+')')
  if(curr.takeAway<prev.takeAway&&prev.takeAway>0) notes.push('Takeaways down '+(prev.takeAway-curr.takeAway))
  if(curr.loseBallDribbling>prev.loseBallDribbling+1) notes.push('Ball losses dribbling up '+(curr.loseBallDribbling-prev.loseBallDribbling)+' — work on')
  if(curr.loseBallDribbling<prev.loseBallDribbling-1) notes.push('Ball losses reduced by '+(prev.loseBallDribbling-curr.loseBallDribbling))
  if(curr.badTouch>prev.badTouch+2) notes.push('Bad touches up '+(curr.badTouch-prev.badTouch)+' — focus area')
  if(curr.badTouch<prev.badTouch-2) notes.push('Bad touches down '+(prev.badTouch-curr.badTouch))
  if(curr.dangerousBallMiddle>prev.dangerousBallMiddle+1) notes.push('Dangerous balls in middle increased — decision-making')
  const gd=gradeVal(currGrade)-gradeVal(prevGrade)
  if(gd>=2) notes.push('Grade improved significantly ('+prevGrade+' → '+currGrade+')')
  else if(gd<=-2) notes.push('Grade declined ('+prevGrade+' → '+currGrade+') — review film')
  return notes
}

// Edit modal component
function EditModal({report,onSave,onClose}:{report:Report;onSave:(r:Report)=>void;onClose:()=>void}) {
  const [stats,setStats]=useState({...report.stats})
  const [grades,setGrades]=useState({...report.grades})
  const [filmMinute,setFilmMinute]=useState(report.filmMinute)
  const [notes,setNotes]=useState(report.notes)
  const [saving,setSaving]=useState(false)

  const handleSave=async()=>{
    setSaving(true)
    try {
      await fetch('/api/report-edit',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({rowIndex:report.rowIndex,stats,selfGrades:grades,peerGrades:grades,filmMinute,notes,type:report.type})})
      onSave({...report,stats,grades,filmMinute,notes})
    } catch(e){alert('Save failed: '+e)}
    setSaving(false)
  }

  const setStat=(k:keyof Stats,v:string)=>setStats(s=>({...s,[k]:Number(v)||0}))
  const setGrade=(k:keyof Grades,v:string)=>setGrades(g=>({...g,[k]:v}))
  const GRADES=['A','B','C','D','F']

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{background:'#1a1a1a',border:'1px solid #3a3a3a',borderRadius:'0.75rem',padding:'1.5rem',width:'100%',maxWidth:'560px',maxHeight:'85vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
          <h2 style={{color:'#e0e0e0',fontWeight:800,margin:0,fontSize:'1rem',letterSpacing:'0.04em'}}>EDIT REPORT — {report.player.toUpperCase()}</h2>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#616161',fontSize:'1.25rem',cursor:'pointer',lineHeight:1}}>×</button>
        </div>
        <p style={{color:'#6b0000',fontSize:'0.72rem',letterSpacing:'0.08em',margin:'0 0 1rem 0'}}>{report.gameLabel} · {report.type.toUpperCase()}</p>

        <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 0.625rem 0'}}>STATS</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'1rem'}}>
          {STAT_LABELS.map(([k,label])=>(
            <div key={k}>
              <label style={{color:'#757575',fontSize:'0.72rem',display:'block',marginBottom:'2px'}}>{label}</label>
              <input type="number" min="0" max="99" value={stats[k]}
                onChange={e=>setStat(k,e.target.value)}
                style={{width:'100%',background:'#222',border:'1px solid #333',borderRadius:'0.375rem',color:'#e0e0e0',padding:'0.375rem 0.5rem',fontSize:'0.85rem',outline:'none',boxSizing:'border-box'}}/>
            </div>
          ))}
        </div>

        <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 0.625rem 0'}}>GRADES</p>
        <div style={{marginBottom:'1rem'}}>
          {GRADE_KEYS.map(k=>(
            <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
              <span style={{color:'#9e9e9e',fontSize:'0.82rem'}}>{GRADE_LABEL[k]}</span>
              <div style={{display:'flex',gap:'0.375rem'}}>
                {GRADES.map(g=>(
                  <button key={g} onClick={()=>setGrade(k,g)}
                    style={{width:'32px',height:'32px',borderRadius:'0.375rem',border:'1px solid #333',background:grades[k]===g?'#6b0000':'#2a2a2a',color:grades[k]===g?'#fff':'#9e9e9e',fontSize:'0.8rem',fontWeight:600,cursor:'pointer'}}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:'0.75rem'}}>
          <label style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',display:'block',marginBottom:'4px'}}>FILM MINUTE</label>
          <input value={filmMinute} onChange={e=>setFilmMinute(e.target.value)}
            style={{width:'100%',background:'#222',border:'1px solid #333',borderRadius:'0.375rem',color:'#e0e0e0',padding:'0.375rem 0.5rem',fontSize:'0.85rem',outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:'1.25rem'}}>
          <label style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',display:'block',marginBottom:'4px'}}>NOTES</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
            style={{width:'100%',background:'#222',border:'1px solid #333',borderRadius:'0.375rem',color:'#e0e0e0',padding:'0.375rem 0.5rem',fontSize:'0.85rem',outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
        </div>

        <div style={{display:'flex',gap:'0.75rem'}}>
          <button onClick={handleSave} disabled={saving}
            style={{flex:1,padding:'0.625rem',background:'#6b0000',border:'none',borderRadius:'0.5rem',color:'#fff',fontWeight:700,fontSize:'0.875rem',cursor:saving?'wait':'pointer'}}>
            {saving?'SAVING...':'SAVE CHANGES'}
          </button>
          <button onClick={onClose}
            style={{padding:'0.625rem 1rem',background:'transparent',border:'1px solid #3a3a3a',borderRadius:'0.5rem',color:'#9e9e9e',fontWeight:600,fontSize:'0.875rem',cursor:'pointer'}}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
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
  const [editingReport,setEditingReport]=useState<Report|null>(null)
  const [deletingRow,setDeletingRow]=useState<number|null>(null)
  const [sampleLoading,setSampleLoading]=useState(false)
  const [clearingLoading,setClearingLoading]=useState(false)
  const [hasSample,setHasSample]=useState(false)

  const loadReports=()=>{
    setLoading(true)
    Promise.all([fetch('/api/reports').then(r=>r.json()),fetch('/api/players').then(r=>r.json())])
      .then(([rd,pd])=>{const reps=rd.reports||[];setReports(reps);setPlayers(pd.players||[]);setLoading(false);setHasSample(reps.some((r: {isSample?:boolean})=>r.isSample))})
      .catch(e=>{setError('Failed to load: '+e.message);setLoading(false)})
  }
  const handleGenerateSample=async()=>{
    setSampleLoading(true)
    try{const r=await fetch('/api/sample-data',{method:'POST'});const d=await r.json();if(d.error)alert('Error: '+d.error);else loadReports()}catch(e){alert('Failed: '+e)}
    setSampleLoading(false)
  }
  const handleClearSample=async()=>{
    if(!confirm('Clear all sample data from the sheet?'))return
    setClearingLoading(true)
    try{const r=await fetch('/api/sample-data',{method:'DELETE'});const d=await r.json();if(d.error)alert('Error: '+d.error);else loadReports()}catch(e){alert('Failed: '+e)}
    setClearingLoading(false)
  }

  useEffect(()=>{
    const r=sessionStorage.getItem('role')
    if(!r){router.push('/');return}
    setRole(r)
    loadReports()
  },[router])

  const handleDelete=async(rowIndex:number)=>{
    if(!confirm('Delete this report? This cannot be undone.')) return
    setDeletingRow(rowIndex)
    try {
      await fetch('/api/report-edit',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({rowIndex})})
      setReports(prev=>prev.filter(r=>r.rowIndex!==rowIndex))
    } catch(e){alert('Delete failed: '+e)}
    setDeletingRow(null)
  }

  const handleEditSave=(updated:Report)=>{
    setReports(prev=>prev.map(r=>r.rowIndex===updated.rowIndex?updated:r))
    setEditingReport(null)
  }

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
  const isCoach=role==='coach'

  // Coach action buttons for a report row
  const CoachActions=({r}:{r:Report})=>(
    isCoach ? <div style={{display:'flex',gap:'6px',marginTop:'6px'}}>
      <button onClick={()=>setEditingReport(r)}
        style={{padding:'3px 10px',fontSize:'0.7rem',fontWeight:600,background:'transparent',border:'1px solid #3a3a3a',borderRadius:'4px',color:'#9e9e9e',cursor:'pointer'}}>
        EDIT
      </button>
      <button onClick={()=>handleDelete(r.rowIndex)} disabled={deletingRow===r.rowIndex}
        style={{padding:'3px 10px',fontSize:'0.7rem',fontWeight:600,background:'transparent',border:'1px solid #6b0000',borderRadius:'4px',color:'#f87171',cursor:'pointer'}}>
        {deletingRow===r.rowIndex?'...':'DELETE'}
      </button>
    </div> : null
  )

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
          <MetricCard label="Games" value={gameIds.length}/>
          <MetricCard label="Total Passes" value={totals.pass}/>
          <MetricCard label="Completion %" value={compPct+'%'}/>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.625rem',padding:'0.875rem 1rem',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.1em',margin:'0 0 0.35rem 0'}}>TEAM GRADE</p>
            <GradePill grade={teamGrade} large/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 1rem 0'}}>AGGREGATE STATS</p>
            {STAT_LABELS.map(([k,label])=><StatBar key={k} label={label} value={totals[k]} max={maxVal}/>)}
          </div>
          <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 1rem 0'}}>PERFORMANCE BY GAME</p>
            {gameIds.length===0&&<p style={{color:'#4a4a4a',fontSize:'0.82rem'}}>No game data yet.</p>}
            {gameIds.map((gid,i)=>{
              const gReps=selfReports.filter(r=>r.gameId===gid)
              const gLabel=games.find(g=>g.id===gid)?.label||gid
              const gGrade=avgGradeStr(gReps.map(r=>r.perfGrade).filter(Boolean))
              const prevGid=gameIds[i-1]
              const prevGrade=prevGid?avgGradeStr(selfReports.filter(r=>r.gameId===prevGid).map(r=>r.perfGrade).filter(Boolean)):''
              const gt=sumStats(gReps)
              return <div key={gid} style={{padding:'0.625rem 0',borderBottom:'1px solid #1e1e1e'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'3px'}}>
                  <div><p style={{color:'#e0e0e0',fontSize:'0.82rem',fontWeight:600,margin:0}}>{gLabel}</p><p style={{color:'#616161',fontSize:'0.7rem',margin:0}}>{gReps.length} player{gReps.length!==1?'s':''} reported</p></div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}><GradePill grade={gGrade}/><TrendArrow prev={prevGrade} curr={gGrade}/></div>
                </div>
                <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                  {[['pass','P'],['goals','G'],['assists','A'],['takeAway','TA']].map(([k,lbl])=><span key={k} style={{color:'#757575',fontSize:'0.7rem'}}>{lbl}: <strong style={{color:'#9e9e9e'}}>{gt[k as keyof Stats]}</strong></span>)}
                </div>
              </div>
            })}
          </div>
        </div>
      </div>
    )
  }

  const PlayersListView=()=>{
    // Players with self-reports
    const selfPlayerNames=Array.from(new Set(selfReports.map(r=>r.player))).sort()
    // Players who only have peer evals (no self-report in current filter)
    const peerOnlyNames=Array.from(new Set(
      reports.filter(r=>r.type==='peer'&&(gameFilter==='All'||r.gameId===gameFilter)&&(teamFilter==='All'||(playerTeamMap[r.player]||'Unassigned')===teamFilter))
        .map(r=>r.player)
    )).filter(n=>!selfPlayerNames.includes(n)).sort()
    const playerNames=[...selfPlayerNames,...peerOnlyNames]
    if(!playerNames.length) return <div style={{textAlign:'center',padding:'3rem',color:'#4a4a4a',fontSize:'0.85rem',letterSpacing:'0.08em'}}>NO REPORTS FOUND</div>
    return <div style={{display:'flex',flexDirection:'column',gap:'0.625rem'}}>
      {playerNames.map(name=>{
        const pReps=selfReports.filter(r=>r.player===name)
        const peerReps=reports.filter(r=>r.player===name&&r.type==='peer')
        const tot=sumStats(pReps)
        const compP=tot.pass>0?Math.round((tot.complete/tot.pass)*100):0
        const team=playerTeamMap[name]||'Unassigned'
        const seasonGrade=avgGradeStr(pReps.map(r=>r.perfGrade).filter(Boolean))
        const selfPassGrade=avgGradeStr(pReps.map(r=>r.grades.Passing).filter(Boolean))
        const peerPassGrade=avgGradeStr(peerReps.map(r=>r.grades.Passing).filter(Boolean))
        const isPeerOnly = !selfReports.some(r=>r.player===name)
        if(isPeerOnly){
          const peerRepsForPlayer=reports.filter(r=>r.player===name&&r.type==='peer'&&(gameFilter==='All'||r.gameId===gameFilter))
          return <div key={name}
            style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'0.875rem 1.125rem',display:'flex',alignItems:'center',justifyContent:'space-between',opacity:0.65}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.875rem'}}>
              <div style={{width:'2.25rem',height:'2.25rem',borderRadius:'50%',background:'#3a3a3a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:700,color:'#666',flexShrink:0}}>{initials(name)}</div>
              <div>
                <p style={{color:'#9e9e9e',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{name}</p>
                <p style={{color:'#616161',fontSize:'0.72rem',margin:0}}>{playerTeamMap[name]||'Unassigned'} · {peerRepsForPlayer.length} peer eval{peerRepsForPlayer.length!==1?'s':''} received</p>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
              <span style={{background:'#2a1a00',color:'#fb923c',fontSize:'0.65rem',fontWeight:700,padding:'3px 10px',borderRadius:'20px',letterSpacing:'0.06em',border:'1px solid #fb923c44'}}>AWAITING SELF-REPORT</span>
            </div>
          </div>
        }
        return <div key={name} onClick={()=>setSelectedPlayer(name)}
          style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'0.875rem 1.125rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}
          onMouseEnter={e=>(e.currentTarget.style.borderColor='#6b0000')}
          onMouseLeave={e=>(e.currentTarget.style.borderColor='#2a2a2a')}>
          <div style={{display:'flex',alignItems:'center',gap:'0.875rem'}}>
            <div style={{width:'2.25rem',height:'2.25rem',borderRadius:'50%',background:teamColor(team),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:700,color:'#fff',flexShrink:0}}>{initials(name)}</div>
            <div><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{name}</p><p style={{color:'#616161',fontSize:'0.72rem',margin:0}}>{team} · {pReps.length} game{pReps.length!==1?'s':''} · {peerReps.length} peer eval{peerReps.length!==1?'s':''}</p></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 2px 0'}}>PASSES</p><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{tot.pass}</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 2px 0'}}>GOALS</p><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{tot.goals}</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 2px 0'}}>COMP%</p><p style={{color:'#e0e0e0',fontWeight:700,margin:0,fontSize:'0.9rem'}}>{compP}%</p></div>
            <div style={{textAlign:'right'}}><p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 3px 0'}}>PERF</p><GradePill grade={seasonGrade}/></div>
            <div style={{textAlign:'right'}}>
              <p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 3px 0'}}>SELF/PEER PASS</p>
              <div style={{display:'flex',gap:'4px',alignItems:'center'}}><GradePill grade={selfPassGrade}/><span style={{color:'#555',fontSize:'0.65rem'}}>/</span><GradePill grade={peerPassGrade}/></div>
            </div>
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

    // Season self vs peer grade comparison
    const seasonSelfGrades=Object.fromEntries(GRADE_KEYS.map(k=>[k,avgGradeStr(selfP.map(r=>r.grades[k]).filter(Boolean))]))
    const seasonPeerGrades=Object.fromEntries(GRADE_KEYS.map(k=>[k,avgGradeStr(peerReceived.map(r=>r.grades[k]).filter(Boolean))]))

    const gameBreakdown=selfP.map((r,i)=>({r,prev:selfP[i-1],improvement:selfP[i-1]?getImprovementNotes(selfP[i-1].stats,r.stats,selfP[i-1].perfGrade,r.perfGrade):[]}))

    return (
      <div>
        <button onClick={()=>setSelectedPlayer(null)} style={{background:'transparent',border:'1px solid #333',borderRadius:'0.5rem',color:'#9e9e9e',padding:'0.375rem 0.75rem',fontSize:'0.8rem',cursor:'pointer',marginBottom:'1rem'}}>← All Players</button>

        {/* Header */}
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

          {/* Season Self vs Peer grades table */}
          <div style={{background:'#111',border:'1px solid #2a2a2a',borderRadius:'0.625rem',padding:'1rem'}}>
            <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 0.75rem 0'}}>SEASON GRADES — SELF VS PEER VS COACH</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr repeat(3,80px)',gap:'0',borderBottom:'1px solid #2a2a2a',paddingBottom:'6px',marginBottom:'4px'}}>
              <span style={{color:'#555',fontSize:'0.65rem',letterSpacing:'0.08em'}}>CATEGORY</span>
              <span style={{color:'#6b0000',fontSize:'0.65rem',letterSpacing:'0.08em',textAlign:'center'}}>SELF</span>
              <span style={{color:'#1e3a5f',fontSize:'0.65rem',letterSpacing:'0.08em',textAlign:'center'}}>PEER</span>
              <span style={{color:'#166534',fontSize:'0.65rem',letterSpacing:'0.08em',textAlign:'center'}}>COACH</span>
            </div>
            {GRADE_KEYS.map(k=>{
              const sg=seasonSelfGrades[k]
              const pg=seasonPeerGrades[k]
              const cg=avgGradeStr(coachP.map(r=>r.grades[k]).filter(Boolean))
              return <div key={k} style={{display:'grid',gridTemplateColumns:'1fr repeat(3,80px)',padding:'5px 0',borderBottom:'1px solid #1a1a1a'}}>
                <span style={{color:'#9e9e9e',fontSize:'0.78rem'}}>{GRADE_LABEL[k]}</span>
                <div style={{textAlign:'center'}}><GradePill grade={sg}/></div>
                <div style={{textAlign:'center'}}><GradePill grade={pg}/></div>
                <div style={{textAlign:'center'}}><GradePill grade={cg}/></div>
              </div>
            })}
          </div>
        </div>

        {/* Game by game */}
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem',marginBottom:'1rem'}}>
          <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 1rem 0'}}>GAME-BY-GAME — PERF GRADE & SELF vs PEER GRADES</p>
          {!gameBreakdown.length&&<p style={{color:'#4a4a4a',fontSize:'0.82rem'}}>No self-reports yet.</p>}
          {gameBreakdown.map(({r,prev,improvement},i)=>{
            const peerForGame=peerReceived.filter(p=>p.gameId===r.gameId)
            const peerPerfGrade=peerForGame.length?avgGradeStr(peerForGame.map(p=>p.perfGrade).filter(Boolean)):null
            // Self grades vs peer grades for this specific game
            const gameSelfGrades=Object.fromEntries(GRADE_KEYS.map(k=>[k,r.grades[k]||'—']))
            const gamePeerGrades=Object.fromEntries(GRADE_KEYS.map(k=>[k,avgGradeStr(peerForGame.map(p=>p.grades[k]).filter(Boolean))]))
            const gameCoachGrades=Object.fromEntries(GRADE_KEYS.map(k=>[k,avgGradeStr(coachP.filter(c=>c.gameId===r.gameId).map(c=>c.grades[k]).filter(Boolean))]))

            return <div key={r.gameId+i} style={{padding:'0.875rem 0',borderBottom:'1px solid #1e1e1e'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                <div>
                  <span style={{color:'#e0e0e0',fontSize:'0.9rem',fontWeight:700}}>{r.gameLabel||r.gameId}</span>
                  {r.filmMinute&&<span style={{color:'#616161',fontSize:'0.7rem',marginLeft:'8px'}}>Film: {r.filmMinute}</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{textAlign:'right'}}>
                    <p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 3px 0'}}>PERF GRADE</p>
                    <div style={{display:'flex',alignItems:'center'}}><GradePill grade={r.perfGrade||'—'}/>{prev&&<TrendArrow prev={prev.perfGrade} curr={r.perfGrade}/>}</div>
                  </div>
                  {peerPerfGrade&&<div style={{textAlign:'right'}}>
                    <p style={{color:'#616161',fontSize:'0.6rem',letterSpacing:'0.08em',margin:'0 0 3px 0'}}>PEER PERF</p>
                    <GradePill grade={peerPerfGrade}/>
                  </div>}
                  <CoachActions r={r}/>
                </div>
              </div>

              {/* Mini stats */}
              <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'0.5rem'}}>
                {[['pass','P'],['complete','Comp'],['goals','G'],['assists','A'],['shotOnGoal','SoG'],['takeAway','TA'],['badTouch','BT']].map(([k,lbl])=><span key={k} style={{color:'#757575',fontSize:'0.72rem'}}>{lbl}: <strong style={{color:'#9e9e9e'}}>{r.stats[k as keyof Stats]}</strong></span>)}
              </div>

              {/* Game-specific self vs peer grades */}
              <div style={{background:'#111',borderRadius:'6px',padding:'8px 10px',marginBottom:improvement.length?'0.5rem':0}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr repeat(3,70px)',gap:'0',marginBottom:'4px'}}>
                  <span style={{color:'#444',fontSize:'0.6rem',letterSpacing:'0.06em'}}>GRADES</span>
                  <span style={{color:'#6b0000',fontSize:'0.6rem',textAlign:'center'}}>SELF</span>
                  <span style={{color:'#1e3a5f',fontSize:'0.6rem',textAlign:'center'}}>PEER</span>
                  <span style={{color:'#166534',fontSize:'0.6rem',textAlign:'center'}}>COACH</span>
                </div>
                {GRADE_KEYS.map(k=>(
                  <div key={k} style={{display:'grid',gridTemplateColumns:'1fr repeat(3,70px)',padding:'2px 0'}}>
                    <span style={{color:'#757575',fontSize:'0.7rem'}}>{GRADE_LABEL[k]}</span>
                    <div style={{textAlign:'center'}}><GradePill grade={gameSelfGrades[k]}/></div>
                    <div style={{textAlign:'center'}}><GradePill grade={gamePeerGrades[k]}/></div>
                    <div style={{textAlign:'center'}}><GradePill grade={gameCoachGrades[k]}/></div>
                  </div>
                ))}
              </div>

              {improvement.length>0&&<div style={{marginTop:'0.5rem'}}>{improvement.map((note,ni)=><div key={ni} style={{display:'flex',alignItems:'flex-start',gap:'6px',marginBottom:'2px'}}><span style={{color:'#6b0000',fontSize:'0.7rem',marginTop:'1px'}}>•</span><span style={{color:'#9e9e9e',fontSize:'0.72rem'}}>{note}</span></div>)}</div>}
              {r.notes&&<p style={{color:'#616161',fontSize:'0.72rem',marginTop:'0.375rem',fontStyle:'italic'}}>"{r.notes}"</p>}
            </div>
          })}
        </div>

        {/* Season totals */}
        <div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem',marginBottom:'1rem'}}>
          <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 0.875rem 0'}}>SEASON TOTALS</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0 1.5rem'}}>
            {STAT_LABELS.map(([k,label])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'0.35rem 0',borderBottom:'1px solid #1e1e1e'}}><span style={{color:'#9e9e9e',fontSize:'0.78rem'}}>{label}</span><span style={{color:'#e0e0e0',fontSize:'0.78rem',fontWeight:700}}>{totals[k]}</span></div>)}
          </div>
        </div>

        {peerGiven.length>0&&<div style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:'0.75rem',padding:'1.125rem'}}>
          <p style={{color:'#616161',fontSize:'0.65rem',letterSpacing:'0.12em',margin:'0 0 0.875rem 0'}}>PEER EVALS GIVEN BY {name.split(' ')[0].toUpperCase()}</p>
          {peerGiven.map((r,i)=><div key={i} style={{padding:'0.625rem 0',borderBottom:'1px solid #1e1e1e'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div><span style={{color:'#e0e0e0',fontSize:'0.82rem',fontWeight:600}}>{r.player}</span><span style={{color:'#616161',fontSize:'0.72rem',marginLeft:'8px'}}>{r.gameLabel}</span></div>
              <CoachActions r={r}/>
            </div>
            <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginTop:'0.25rem'}}>{GRADE_KEYS.map(k=>r.grades[k]?<span key={k} style={{color:'#757575',fontSize:'0.72rem'}}>{GRADE_LABEL[k]}: <GradePill grade={r.grades[k]}/></span>:null)}</div>
          </div>)}
        </div>}
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',padding:'1.5rem'}}>
      {editingReport&&<EditModal report={editingReport} onSave={handleEditSave} onClose={()=>setEditingReport(null)}/>}
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
            <button onClick={handleGenerateSample} disabled={sampleLoading} style={{background:'transparent',border:'1px solid #166534',borderRadius:'0.5rem',color:'#4ade80',padding:'0.4rem 0.875rem',fontSize:'0.8rem',cursor:sampleLoading?'wait':'pointer',opacity:sampleLoading?0.5:1}}>{sampleLoading?'GENERATING...':'+ SAMPLE DATA'}</button>
            {hasSample&&<button onClick={handleClearSample} disabled={clearingLoading} style={{background:'transparent',border:'1px solid #6b0000',borderRadius:'0.5rem',color:'#f87171',padding:'0.4rem 0.875rem',fontSize:'0.8rem',cursor:clearingLoading?'wait':'pointer',opacity:clearingLoading?0.5:1}}>{clearingLoading?'CLEARING...':'CLEAR SAMPLES'}</button>}
            {isCoach&&<button onClick={loadReports} style={{background:'transparent',border:'1px solid #3a3a3a',borderRadius:'0.5rem',color:'#9e9e9e',padding:'0.4rem 0.875rem',fontSize:'0.8rem',cursor:'pointer'}}>REFRESH</button>}
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
