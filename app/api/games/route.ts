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
    const dateIdx = headers.findIndex(h => /^date$/i.test(h))
    const oppIdx  = headers.findIndex(h => /^oppon?ents?$/i.test(h))
    const teamIdx = headers.findIndex(h => /^team$/i.test(h))

    const games = rows.slice(1)
      .map((r, i) => {
        const clean = (idx: number) => idx >= 0 ? (r[idx] || '').replace(/^"|"$/g, '').trim() : ''
        const date     = clean(dateIdx)
        const opponent = clean(oppIdx)
        const team     = clean(teamIdx)
        if (!date && !opponent) return null
        let label = ''
        if (date)     label += date
        if (opponent) label += (label ? ' - vs ' : 'vs ') + opponent
        if (team)     label += ' (' + team + ')'
        if (!label)   label = 'Game ' + (i + 1)
        return { id: String(i + 1), label, date, opponent, team }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)

    return NextResponse.json({ games, headers })
  } catch (e) {
    console.error('Games API error:', e)
    return NextResponse.json({ error: String(e), games: [] }, { status: 500 })
  }
}
