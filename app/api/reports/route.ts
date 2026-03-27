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
      range: 'Reports!A:U',
    })
    const rows = resp.data.values ?? []
    if (rows.length < 2) {
      return NextResponse.json({ reports: [] }, { headers: { 'cache-control': 'no-store' } })
    }
    const reports = rows.slice(1).filter((r) => r[0]).map((r) => ({
      timestamp: r[0] ?? '',
      gameId: r[1] ?? '',
      gameLabel: r[2] ?? '',
      submittedBy: r[3] ?? '',
      player: r[4] ?? '',
      type: r[5] ?? 'self',
      stats: {
        pass: Number(r[6]) || 0,
        complete: Number(r[7]) || 0,
        shotOnGoal: Number(r[8]) || 0,
        shotNotOnGoal: Number(r[9]) || 0,
        takeAway: Number(r[10]) || 0,
        loseBallDribbling: Number(r[11]) || 0,
        dangerousBallMiddle: Number(r[12]) || 0,
        badTouch: Number(r[13]) || 0,
      },
      filmMinute: r[14] ?? '',
      notes: r[15] ?? '',
      grades: {
        Passing: r[16] ?? '',
        TakeAways: r[17] ?? '',
        Touches: r[18] ?? '',
        Control: r[19] ?? '',
        Recovery: r[20] ?? '',
      },
    }))
    return NextResponse.json({ reports }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Reports API error:', msg)
    return NextResponse.json({ error: msg, reports: [] }, { status: 500 })
  }
}