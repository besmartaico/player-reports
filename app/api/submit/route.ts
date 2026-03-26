import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SHEET_ID = process.env.SHEET_ID || '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { playerName, submittedBy, role, stats, selfGrades, peerName, peerGrades, coachGrades, gameDate, filmMinute, notes } = body

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const timestamp = new Date().toISOString()

    // Row for the player's own stats + self grades
    const playerRow = [
      timestamp, gameDate || '', filmMinute || '', submittedBy, playerName, 'self',
      stats?.pass || '', stats?.complete || '', stats?.shotOnGoal || '',
      stats?.shotNotOnGoal || '', stats?.takeAway || '', stats?.loseBallDribbling || '',
      stats?.dangerousBallMiddle || '', stats?.badTouch || '', notes || '',
      selfGrades?.passing || '', selfGrades?.takeAways || '', selfGrades?.touches || '',
      selfGrades?.control || '', selfGrades?.recovery || ''
    ]

    const rows = [playerRow]

    // Row for peer evaluation if provided
    if (peerName && peerGrades) {
      const peerRow = [
        timestamp, gameDate || '', filmMinute || '', submittedBy, peerName, 'peer',
        '', '', '', '', '', '', '', '', '',
        peerGrades?.passing || '', peerGrades?.takeAways || '', peerGrades?.touches || '',
        peerGrades?.control || '', peerGrades?.recovery || ''
      ]
      rows.push(peerRow)
    }

    // Row for coach grades if provided
    if (role === 'coach' && coachGrades && playerName) {
      const coachRow = [
        timestamp, gameDate || '', filmMinute || '', submittedBy, playerName, 'coach',
        '', '', '', '', '', '', '', '', '',
        coachGrades?.passing || '', coachGrades?.takeAways || '', coachGrades?.touches || '',
        coachGrades?.control || '', coachGrades?.recovery || ''
      ]
      rows.push(coachRow)
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Reports!A:T',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}