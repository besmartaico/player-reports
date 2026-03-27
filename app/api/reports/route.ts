import { NextResponse } from 'next/server'
import { google } from 'googleapis'
export const runtime = 'nodejs'
const SHEET_ID = '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON')
  const creds = JSON.parse(raw)
  creds.private_key = creds.private_key.replace(/\\n/g,'\n')
  return new google.auth.JWT({ email:creds.client_email, key:creds.private_key, scopes:['https://www.googleapis.com/auth/spreadsheets.readonly'] })
}
interface StatSet { pass:number;complete:number;goals:number;assists:number;shotOnGoal:number;shotNotOnGoal:number;takeAway:number;loseBallDribbling:number;dangerousBallMiddle:number;badTouch:number }
function clamp(v:number,min=0,max=100):number { return Math.min(max,Math.max(min,v)) }
function scoreFromStats(s:StatSet):number {
  const pc=s.pass>0?(s.complete/s.pass)*100:0
  let ps:number
  if(pc>=90)ps=100;else if(pc>=80)ps=80+(pc-80)*2;else if(pc>=70)ps=60+(pc-70)*2;else if(pc>=60)ps=40+(pc-60)*2;else ps=Math.max(0,pc*0.67)
  const pv=s.pass>0?clamp(Math.log(s.pass+1)/Math.log(41)*100):0
  const raw=ps*0.35+pv*0.10+clamp(s.takeAway*10)*0.15+clamp(s.shotOnGoal*12)*0.15+clamp(s.goals*25)*0.15+clamp(s.assists*15)*0.05+clamp(s.shotNotOnGoal*5)*0.05-clamp(s.loseBallDribbling*12+Math.max(0,s.loseBallDribbling-3)*6)*0.10-clamp(s.dangerousBallMiddle*10+Math.max(0,s.dangerousBallMiddle-3)*5)*0.10-clamp(s.badTouch*8+Math.max(0,s.badTouch-4)*4)*0.10
  return clamp(raw)
}
function scoreToGrade(score:number):string {
  if(score>=96)return'A';if(score>=90)return'A-';if(score>=86)return'B+';if(score>=82)return'B';if(score>=78)return'B-'
  if(score>=74)return'C+';if(score>=70)return'C';if(score>=66)return'C-';if(score>=62)return'D+';if(score>=58)return'D';if(score>=54)return'D-';return'F'
}
function mergeStats(a:StatSet,b:StatSet|null,w=0.4):StatSet {
  if(!b)return a
  const bl=(av:number,bv:number)=>Math.round(av*(1-w)+bv*w)
  return{pass:bl(a.pass,b.pass),complete:bl(a.complete,b.complete),goals:bl(a.goals,b.goals),assists:bl(a.assists,b.assists),shotOnGoal:bl(a.shotOnGoal,b.shotOnGoal),shotNotOnGoal:bl(a.shotNotOnGoal,b.shotNotOnGoal),takeAway:bl(a.takeAway,b.takeAway),loseBallDribbling:bl(a.loseBallDribbling,b.loseBallDribbling),dangerousBallMiddle:bl(a.dangerousBallMiddle,b.dangerousBallMiddle),badTouch:bl(a.badTouch,b.badTouch)}
}
function parseRow(r:string[],rowIdx:number) {
  const n=r.length
  // New format (>=24 cols, or col18=SAMPLE/empty): isSample at 18, grades at 19-23
  // Mid format (23 cols): goals/assists, no isSample, grades at 18-22
  // Old format (<=21 cols): no goals/assists, grades at 16-20
  const isNew = n>=24||(n>=19&&(r[18]===''||r[18]==='SAMPLE'||!r[18]?.match(/^[ABCDF]/)))
  let stats,filmMinute,notes,isSample,grades
  if(isNew&&n>=19){
    stats={pass:Number(r[6])||0,complete:Number(r[7])||0,goals:Number(r[8])||0,assists:Number(r[9])||0,shotOnGoal:Number(r[10])||0,shotNotOnGoal:Number(r[11])||0,takeAway:Number(r[12])||0,loseBallDribbling:Number(r[13])||0,dangerousBallMiddle:Number(r[14])||0,badTouch:Number(r[15])||0}
    filmMinute=r[16]??'';notes=r[17]??'';isSample=(r[18]??'')==='SAMPLE'
    grades={Passing:r[19]??'',TakeAways:r[20]??'',Touches:r[21]??'',Control:r[22]??'',Recovery:r[23]??''}
  } else if(n>=23){
    stats={pass:Number(r[6])||0,complete:Number(r[7])||0,goals:Number(r[8])||0,assists:Number(r[9])||0,shotOnGoal:Number(r[10])||0,shotNotOnGoal:Number(r[11])||0,takeAway:Number(r[12])||0,loseBallDribbling:Number(r[13])||0,dangerousBallMiddle:Number(r[14])||0,badTouch:Number(r[15])||0}
    filmMinute=r[16]??'';notes=r[17]??'';isSample=false
    grades={Passing:r[18]??'',TakeAways:r[19]??'',Touches:r[20]??'',Control:r[21]??'',Recovery:r[22]??''}
  } else {
    stats={pass:Number(r[6])||0,complete:Number(r[7])||0,goals:0,assists:0,shotOnGoal:Number(r[8])||0,shotNotOnGoal:Number(r[9])||0,takeAway:Number(r[10])||0,loseBallDribbling:Number(r[11])||0,dangerousBallMiddle:Number(r[12])||0,badTouch:Number(r[13])||0}
    filmMinute=r[14]??'';notes=r[15]??'';isSample=false
    grades={Passing:r[16]??'',TakeAways:r[17]??'',Touches:r[18]??'',Control:r[19]??'',Recovery:r[20]??''}
  }
  return{rowIndex:rowIdx,timestamp:r[0]??'',gameId:r[1]??'',gameLabel:r[2]??'',submittedBy:r[3]??'',player:r[4]??'',type:r[5]??'self',stats,filmMinute,notes,isSample,grades,perfGrade:'' as string,perfScore:0 as number}
}
export async function GET() {
  try {
    const auth=getAuth()
    const sheets=google.sheets({version:'v4',auth})
    const meta=await sheets.spreadsheets.get({spreadsheetId:SHEET_ID})
    const names=meta.data.sheets?.map(s=>s.properties?.title||'')??[]
    const sheetName=names.find(n=>n.toLowerCase()==='reports')??names[0]??'Sheet1'
    const resp=await sheets.spreadsheets.values.get({spreadsheetId:SHEET_ID,range:sheetName+'!A:X'})
    const rows=resp.data.values??[]
    if(!rows.length)return NextResponse.json({reports:[],sheetName},{headers:{'cache-control':'no-store'}})
    const startRow=rows[0]?.[0]?.toLowerCase().includes('timestamp')?1:0
    const rawReports=rows.slice(startRow).map((r,i)=>parseRow(r as string[],startRow+i+1)).filter(r=>r.timestamp&&r.player)
    const pgMap:Record<string,{self:typeof rawReports[0]|null;peers:typeof rawReports[0][]}>= {}
    for(const r of rawReports){
      const k=r.player+'::'+r.gameId
      if(!pgMap[k])pgMap[k]={self:null,peers:[]}
      if(r.type==='self')pgMap[k].self=r
      else if(r.type==='peer')pgMap[k].peers.push(r)
    }
    for(const k of Object.keys(pgMap)){
      const{self,peers}=pgMap[k];if(!self)continue
      const ss={pass:self.stats.pass,complete:self.stats.complete,goals:self.stats.goals,assists:self.stats.assists,shotOnGoal:self.stats.shotOnGoal,shotNotOnGoal:self.stats.shotNotOnGoal,takeAway:self.stats.takeAway,loseBallDribbling:self.stats.loseBallDribbling,dangerousBallMiddle:self.stats.dangerousBallMiddle,badTouch:self.stats.badTouch}
      let ps:StatSet|null=null
      if(peers.length>0){
        const t:StatSet={pass:0,complete:0,goals:0,assists:0,shotOnGoal:0,shotNotOnGoal:0,takeAway:0,loseBallDribbling:0,dangerousBallMiddle:0,badTouch:0}
        for(const p of peers)for(const key of Object.keys(t) as (keyof StatSet)[])t[key]+=p.stats[key]||0
        for(const key of Object.keys(t) as (keyof StatSet)[])(t[key] as number)=Math.round(t[key]/peers.length)
        ps=t
      }
      const score=scoreFromStats(mergeStats(ss,ps))
      self.perfGrade=scoreToGrade(score);self.perfScore=Math.round(score)
    }
    return NextResponse.json({reports:rawReports,sheetName},{headers:{'cache-control':'no-store'}})
  } catch(e:unknown){
    const msg=e instanceof Error?e.message:String(e)
    console.error('Reports API error:',msg)
    return NextResponse.json({error:msg,reports:[]},{status:500})
  }
}