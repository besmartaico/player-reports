import { NextResponse } from 'next/server'

const SHEET_ID = '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'

function parseGvizCsv(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { cells.push(cur); cur = '' }
      else { cur += ch }
    }
    cells.push(cur)
    rows.push(cells)
  }
  return rows
}

export async function GET() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`
    const resp = await fetch(url, { next: { revalidate: 30 } })
    if (!resp.ok) throw new Error('Sheet fetch failed: ' + resp.status)
    const text = await resp.text()
    const rows = parseGvizCsv(text)
    if (rows.length < 2) return NextResponse.json({ players: [] })

    const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim())
    const nameIdx = headers.findIndex(h => /name|player/i.test(h))
    const teamIdx = headers.findIndex(h => /potential.*primary|primary.*team/i.test(h))
    
    // fallback: first col is name
    const ni = nameIdx >= 0 ? nameIdx : 0
    const ti = teamIdx >= 0 ? teamIdx : -1

    const players = rows.slice(1)
      .map(r => ({
        name: r[ni]?.replace(/^"|"$/g, '').trim() || '',
        potentialTeam: ti >= 0 ? r[ti]?.replace(/^"|"$/g, '').trim() || 'Unassigned' : 'Unassigned'
      }))
      .filter(p => p.name)

    return NextResponse.json({ players, headers })
  } catch (e) {
    console.error('Players API error:', e)
    return NextResponse.json({ error: String(e), players: [] }, { status: 500 })
  }
}
