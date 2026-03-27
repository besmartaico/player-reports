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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// DELETE: clear a row (set all cells blank to preserve row numbering)
export async function DELETE(req: Request) {
  try {
    const { rowIndex } = await req.json()
    if (!rowIndex || rowIndex < 1) return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Get how many columns this row has
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `Reports!${rowIndex}:${rowIndex}`,
    })
    const numCols = existing.data.values?.[0]?.length ?? 23

    // Clear the row by writing empty values
    const emptyRow = Array(numCols).fill('')
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Reports!A${rowIndex}:W${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [emptyRow] },
    })

    return NextResponse.json({ success: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Delete error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT: update a row
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { rowIndex, stats, selfGrades, peerGrades, filmMinute, notes, type } = body
    if (!rowIndex || rowIndex < 1) return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })

    const s = (v: unknown) => (v ?? '').toString()

    // Read current row to preserve cols A-F
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `Reports!A${rowIndex}:F${rowIndex}`,
    })
    const current = existing.data.values?.[0] ?? []

    const grades = type === 'peer' ? peerGrades : selfGrades
    const row = [
      current[0] ?? '', current[1] ?? '', current[2] ?? '',
      current[3] ?? '', current[4] ?? '', current[5] ?? '',
      s(stats?.pass), s(stats?.complete), s(stats?.goals), s(stats?.assists),
      s(stats?.shotOnGoal), s(stats?.shotNotOnGoal), s(stats?.takeAway),
      s(stats?.loseBallDribbling), s(stats?.dangerousBallMiddle), s(stats?.badTouch),
      s(filmMinute), s(notes),
      s(grades?.Passing), s(grades?.['Take Aways']),
      s(grades?.Touches), s(grades?.Control), s(grades?.Recovery),
    ]

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Reports!A${rowIndex}:W${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })

    return NextResponse.json({ success: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Edit error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
