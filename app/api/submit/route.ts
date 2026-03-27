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
      playerName, submittedBy, role, gameId, gameLabel,
      stats, selfGrades, peerName, peerStats, peerGrades,
      coachGrades, filmMinute, notes
    } = body

    const timestamp = new Date().toISOString()
    const rows: string[][] = []
    const s = (v: unknown) => (v ?? '').toString()

    // Columns A–W (23 cols):
    // A=Timestamp, B=GameID, C=Game, D=SubmittedBy, E=Player, F=Type,
    // G=Pass, H=Complete, I=Goals, J=Assists, K=ShotOnGoal, L=ShotNotOnGoal,
    // M=TakeAway, N=LoseBall, O=DangerousBall, P=BadTouch,
    // Q=FilmMinute, R=Notes,
    // S=Gr-Passing, T=Gr-TakeAways, U=Gr-Touches, V=Gr-Control, W=Gr-Recovery

    rows.push([
      timestamp, s(gameId), s(gameLabel), s(submittedBy || playerName), s(playerName), 'self',
      s(stats?.pass), s(stats?.complete), s(stats?.goals), s(stats?.assists),
      s(stats?.shotOnGoal), s(stats?.shotNotOnGoal), s(stats?.takeAway),
      s(stats?.loseBallDribbling), s(stats?.dangerousBallMiddle), s(stats?.badTouch),
      s(filmMinute), s(notes),
      s(selfGrades?.Passing), s(selfGrades?.['Take Aways']),
      s(selfGrades?.Touches), s(selfGrades?.Control), s(selfGrades?.Recovery)
    ])

    if (peerName) {
      rows.push([
        timestamp, s(gameId), s(gameLabel), s(submittedBy || playerName), s(peerName), 'peer',
        s(peerStats?.pass), s(peerStats?.complete), s(peerStats?.goals), s(peerStats?.assists),
        s(peerStats?.shotOnGoal), s(peerStats?.shotNotOnGoal), s(peerStats?.takeAway),
        s(peerStats?.loseBallDribbling), s(peerStats?.dangerousBallMiddle), s(peerStats?.badTouch),
        s(filmMinute), '',
        s(peerGrades?.Passing), s(peerGrades?.['Take Aways']),
        s(peerGrades?.Touches), s(peerGrades?.Control), s(peerGrades?.Recovery)
      ])
    }

    if (role === 'coach' && coachGrades) {
      rows.push([
        timestamp, s(gameId), s(gameLabel), s(submittedBy || playerName), s(playerName), 'coach',
        '', '', '', '', '', '', '', '', '', '', '', '',
        s(coachGrades?.Passing), s(coachGrades?.['Take Aways']),
        s(coachGrades?.Touches), s(coachGrades?.Control), s(coachGrades?.Recovery)
      ])
    }

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Reports!A:W',
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
