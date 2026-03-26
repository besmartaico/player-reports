import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const runtime = 'nodejs'

const SHEET_ID = '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON')
  const creds = JSON.parse(raw)
  creds.private_key = creds.private_key.replace(/\\n/g, '\n')
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export async function GET() {
  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Games!A:Z',
    })

    const rows = resp.data.values ?? []
    if (rows.length < 2) return NextResponse.json({ games: [] })

    const headers = rows[0].map((h: string) => h.trim())
    const dateIdx = headers.findIndex((h: string) => /^date$/i.test(h))
    const oppIdx  = headers.findIndex((h: string) => /^oppon?ents?$/i.test(h))
    const teamIdx = headers.findIndex((h: string) => /^team$/i.test(h))

    const games = rows.slice(1)
      .map((r: string[], i: number) => {
        const clean = (idx: number) => idx >= 0 ? (r[idx] ?? '').trim() : ''
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

    return NextResponse.json({ games, headers }, { headers: { 'cache-control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Games API error:', msg)
    return NextResponse.json({ error: msg, games: [] }, { status: 500 })
  }
}
