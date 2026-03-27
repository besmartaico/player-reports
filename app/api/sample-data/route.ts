import { NextResponse } from 'next/server'
import { google } from 'googleapis'
export const runtime = 'nodejs'
const SHEET_ID = '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON')
  const creds = JSON.parse(raw)
  creds.private_key = creds.private_key.replace(/\\n/g,'\n')
  return new google.auth.JWT({ email:creds.client_email, key:creds.private_key, scopes:['https://www.googleapis.com/auth/spreadsheets'] })
}
async function getSheetName(sheets: ReturnType<typeof google.sheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const names = meta.data.sheets?.map(s=>s.properties?.title||'')??[]
  return names.find(n=>n.toLowerCase()==='reports')??names[0]??'Sheet1'
}
// POST = generate sample data
export async function POST() {
  try {
    const auth = getAuth()
    const sheets = google.sheets({ version:'v4', auth })
    const sheetName = await getSheetName(sheets)
    const players = [
      {name:'Marcus Reed',team:'Varsity'},{name:'Eli Torres',team:'Varsity'},
      {name:'Devon Shaw',team:'Varsity'},{name:'Caleb Nguyen',team:'JV'},
      {name:'Owen Park',team:'JV'},{name:'Liam Foster',team:'Sophomore'},
    ]
    const games = [
      {id:'game-001',label:'vs. Highland — Mar 1'},
      {id:'game-002',label:'vs. Skyline — Mar 8'},
      {id:'game-003',label:'vs. Timpview — Mar 15'},
    ]
    const grades = ['A','A','B+','B','B','B-','C+']
    const rng = (min:number,max:number) => Math.floor(Math.random()*(max-min+1))+min
    const pick = <T,>(arr:T[]):T => arr[rng(0,arr.length-1)]
    const rows: string[][] = []
    const ts = new Date().toISOString()
    for (const game of games) {
      for (const player of players) {
        const pass = rng(18,42), comp = rng(Math.floor(pass*0.6),pass)
        const selfRow = [ts,game.id,game.label,player.name,player.name,'self',
          String(pass),String(comp),String(rng(0,3)),String(rng(0,2)),
          String(rng(1,5)),String(rng(0,3)),String(rng(1,5)),
          String(rng(0,3)),String(rng(0,2)),String(rng(0,4)),
          '','','SAMPLE',
          pick(grades),pick(grades),pick(grades),pick(grades),pick(grades)]
        rows.push(selfRow)
        // Peer eval from next player in list
        const peerIdx = (players.indexOf(player)+1)%players.length
        const peerPlayer = players[peerIdx]
        const pp = rng(18,42), pc = rng(Math.floor(pp*0.6),pp)
        const peerRow = [ts,game.id,game.label,player.name,peerPlayer.name,'peer',
          String(pp),String(pc),String(rng(0,2)),String(rng(0,2)),
          String(rng(1,4)),String(rng(0,3)),String(rng(1,4)),
          String(rng(0,3)),String(rng(0,2)),String(rng(0,3)),
          '','','SAMPLE',
          pick(grades),pick(grades),pick(grades),pick(grades),pick(grades)]
        rows.push(peerRow)
      }
    }
    await sheets.spreadsheets.values.append({ spreadsheetId:SHEET_ID, range:sheetName+'!A:X', valueInputOption:'USER_ENTERED', requestBody:{values:rows} })
    return NextResponse.json({ success:true, rowsAdded:rows.length, sheetName })
  } catch(e:unknown){
    const msg=e instanceof Error?e.message:String(e)
    console.error('Sample error:',msg)
    return NextResponse.json({error:msg},{status:500})
  }
}
// DELETE = clear all SAMPLE rows
export async function DELETE() {
  try {
    const auth = getAuth()
    const sheets = google.sheets({ version:'v4', auth })
    const sheetName = await getSheetName(sheets)
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId:SHEET_ID, range:sheetName+'!A:X' })
    const rows = resp.data.values??[]
    if(!rows.length) return NextResponse.json({success:true,cleared:0})
    // Find which rows are SAMPLE (col S = index 18)
    const sampleRowNums: number[] = []
    rows.forEach((r,i)=>{ if((r[18]??'')==='SAMPLE') sampleRowNums.push(i+1) })
    if(!sampleRowNums.length) return NextResponse.json({success:true,cleared:0})
    // Clear them by overwriting with empty arrays (can't delete rows via values API, blank them)
    const clearRequests = sampleRowNums.map(rowNum=>({
      range: sheetName+'!A'+rowNum+':X'+rowNum,
      values: [Array(24).fill('')]
    }))
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId:SHEET_ID, requestBody:{ valueInputOption:'USER_ENTERED', data:clearRequests } })
    return NextResponse.json({ success:true, cleared:sampleRowNums.length })
  } catch(e:unknown){
    const msg=e instanceof Error?e.message:String(e)
    console.error('Clear sample error:',msg)
    return NextResponse.json({error:msg},{status:500})
  }
}