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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      playerName, submittedBy, role,
      gameId, gameLabel,
      stats, selfGrades,
      peerName, peerGrades,
      coachGrades,
      filmMinute, notes
    } = body

    const timestamp = new Date().toISOString()
    const rows: string[][] = []

    // Player self row
    rows.push([
      timestamp, gameId || '', gameLabel || '', submittedBy || playerName, playerName, 'self',
      stats?.pass || '', stats?.complete || '', stats?.shotOnGoal || '',
      stats?.shotNotOnGoal || '', stats?.takeAway || '', stats?.loseBallDribbling || '',
      stats?.dangerousBallMiddle || '', stats?.badTouch || '',
      filmMinute || '', notes || '',
      selfGrades?.Passing || '', selfGrades?.['Take Aways'] || '', selfGrades?.Touches || '',
      selfGrades?.Control || '', selfGrades?.Recovery || ''
    ])

    // Peer eval row
    if (peerName && peerGrades) {
      rows.push([
        timestamp, gameId || '', gameLabel || '', submittedBy || playerName, peerName, 'peer',
        '', '', '', '', '', '', '', '', '', '',
        peerGrades?.Passing || '', peerGrades?.['Take Aways'] || '', peerGrades?.Touches || '',
        peerGrades?.Control || '', peerGrades?.Recovery || ''
      ])
    }

    // Coach grades row
    if (role === 'coach' && coachGrades) {
      rows.push([
        timestamp, gameId || '', gameLabel || '', submittedBy || playerName, playerName, 'coach',
        '', '', '', '', '', '', '', '', '', '',
        coachGrades?.Passing || '', coachGrades?.['Take Aways'] || '', coachGrades?.Touches || '',
        coachGrades?.Control || '', coachGrades?.Recovery || ''
      ])
    }

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Reports!A:U',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    })

    return NextResponse.json({ success: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Submit error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
