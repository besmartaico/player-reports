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

    // First get spreadsheet metadata to find the actual first sheet name
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
    const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1'
    
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${firstSheet}!A:Z`,
    })

    const rows = resp.data.values ?? []
    if (rows.length < 2) return NextResponse.json({ players: [], sheetName: firstSheet })

    const headers = rows[0].map((h: string) => h.trim())
    const nameIdx = headers.findIndex((h: string) => /name|player/i.test(h))
    const teamIdx = headers.findIndex((h: string) => /potential.*primary|primary.*team/i.test(h))
    const ni = nameIdx >= 0 ? nameIdx : 0
    const ti = teamIdx >= 0 ? teamIdx : -1

    const players = rows.slice(1)
      .filter((r: string[]) => r[ni]?.trim())
      .map((r: string[]) => ({
        name: r[ni]?.trim() || '',
        potentialTeam: ti >= 0 ? r[ti]?.trim() || 'Unassigned' : 'Unassigned',
      }))

    return NextResponse.json({ players, headers, sheetName: firstSheet }, { headers: { 'cache-control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Players API error:', msg)
    return NextResponse.json({ error: msg, players: [] }, { status: 500 })
  }
}
