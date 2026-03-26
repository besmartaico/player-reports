import { NextResponse } from 'next/server'

const SHEET_ID = process.env.SHEET_ID || '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'
const API_KEY = process.env.GOOGLE_API_KEY || ''

export async function GET() {
  try {
    // Fetch player roster from Google Sheets via public API key
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:Z?key=${API_KEY}`
    const resp = await fetch(url, { next: { revalidate: 60 } })
    
    if (!resp.ok) {
      // Fallback: try gviz (works if sheet is publicly shared)
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`
      const gvizResp = await fetch(gvizUrl)
      const text = await gvizResp.text()
      const json = JSON.parse(text.replace(/^[^{]*/, '').replace(/;\s*$/, ''))
      const cols = json.table.cols.map((c: {label:string}) => c.label)
      const nameIdx = cols.findIndex((c: string) => c.toLowerCase().includes('name') || c.toLowerCase().includes('player'))
      const teamIdx = cols.findIndex((c: string) => c.toLowerCase().includes('potential') || c.toLowerCase().includes('primary'))
      
      const players = json.table.rows
        .filter((r: {c: ({v:string}|null)[]}) => r.c[nameIdx]?.v)
        .map((r: {c: ({v:string}|null)[]}) => ({
          name: r.c[nameIdx]?.v || '',
          potentialTeam: r.c[teamIdx]?.v || 'Unassigned'
        }))
      
      return NextResponse.json({ players, cols })
    }
    
    const data = await resp.json()
    const rows: string[][] = data.values || []
    if (rows.length < 2) return NextResponse.json({ players: [] })
    
    const headers = rows[0].map((h: string) => h.trim())
    const nameIdx = headers.findIndex((h: string) => h.toLowerCase().includes('name') || h.toLowerCase().includes('player'))
    const teamIdx = headers.findIndex((h: string) => h.toLowerCase().includes('potential') && h.toLowerCase().includes('primary'))
    
    const players = rows.slice(1)
      .filter(r => r[nameIdx])
      .map(r => ({
        name: r[nameIdx] || '',
        potentialTeam: r[teamIdx] || 'Unassigned',
      }))
    
    return NextResponse.json({ players, headers })
  } catch (e) {
    return NextResponse.json({ error: String(e), players: [] }, { status: 500 })
  }
}