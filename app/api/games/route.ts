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
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Games`
    const resp = await fetch(url, { next: { revalidate: 30 } })
    if (!resp.ok) throw new Error('Games sheet fetch failed: ' + resp.status)
    const text = await resp.text()
    const rows = parseGvizCsv(text)
    if (rows.length < 2) return NextResponse.json({ games: [] })

    const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim())
    
    // Auto-detect common column names
    const idIdx = headers.findIndex(h => /^id$/i.test(h))
    const dateIdx = headers.findIndex(h => /date/i.test(h))
    const oppIdx = headers.findIndex(h => /opponent|vs|team|away/i.test(h))
    const locIdx = headers.findIndex(h => /location|venue|home|place/i.test(h))
    const labelIdx = headers.findIndex(h => /label|name|title|game/i.test(h))

    const games = rows.slice(1)
      .map((r, i) => {
        const clean = (idx: number) => idx >= 0 ? r[idx]?.replace(/^"|"$/g, '').trim() || '' : ''
        const date = clean(dateIdx)
        const opponent = clean(oppIdx)
        const location = clean(locIdx)
        const customLabel = clean(labelIdx)
        const id = clean(idIdx) || String(i + 1)
        
        // Build display label
        let label = customLabel || ''
        if (!label && opponent) label = opponent
        if (date) label = label ? `${date} - ${label}` : date
        if (!label) label = `Game ${i + 1}`
        
        return { id, label, date, opponent, location, row: r.map(c => c.replace(/^"|"$/g, '').trim()) }
      })
      .filter(g => g.label && g.label !== ('Game ' + (0 + 1)))

    return NextResponse.json({ games, headers })
  } catch (e) {
    console.error('Games API error:', e)
    return NextResponse.json({ error: String(e), games: [] }, { status: 500 })
  }
}
