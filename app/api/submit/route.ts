import { NextResponse } from 'next/server'

const SHEET_ID = process.env.SHEET_ID || '1K93hMUEk4do6g30-3ZgoSs5CVF5b9LvEDdJpfOVZ8s0'

async function getGoogleToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
  const rawKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now
  }
  
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const headerB64 = encode(header)
  const claimB64 = encode(claim)
  const sigInput = headerB64 + '.' + claimB64
  
  // Import the private key and sign
  const pemBody = rawKey.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  
  const encoder = new TextEncoder()
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(sigInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  
  const jwt = sigInput + '.' + sigB64
  
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  })
  const tokenData = await tokenResp.json()
  return tokenData.access_token
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { playerName, submittedBy, role, stats, selfGrades, peerName, peerGrades, coachGrades, gameDate, filmMinute, notes } = body

    const timestamp = new Date().toISOString()
    const rows: string[][] = []

    rows.push([
      timestamp, gameDate || '', filmMinute || '', submittedBy || playerName, playerName, 'self',
      stats?.pass || '', stats?.complete || '', stats?.shotOnGoal || '',
      stats?.shotNotOnGoal || '', stats?.takeAway || '', stats?.loseBallDribbling || '',
      stats?.dangerousBallMiddle || '', stats?.badTouch || '', notes || '',
      selfGrades?.Passing || '', selfGrades?.['Take Aways'] || '', selfGrades?.Touches || '',
      selfGrades?.Control || '', selfGrades?.Recovery || ''
    ])

    if (peerName && peerGrades) {
      rows.push([
        timestamp, gameDate || '', filmMinute || '', submittedBy || playerName, peerName, 'peer',
        '', '', '', '', '', '', '', '', '',
        peerGrades?.Passing || '', peerGrades?.['Take Aways'] || '', peerGrades?.Touches || '',
        peerGrades?.Control || '', peerGrades?.Recovery || ''
      ])
    }

    if (role === 'coach' && coachGrades) {
      rows.push([
        timestamp, gameDate || '', filmMinute || '', submittedBy || playerName, playerName, 'coach',
        '', '', '', '', '', '', '', '', '',
        coachGrades?.Passing || '', coachGrades?.['Take Aways'] || '', coachGrades?.Touches || '',
        coachGrades?.Control || '', coachGrades?.Recovery || ''
      ])
    }

    // Try Google Sheets API; if no service account configured just return success
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const token = await getGoogleToken()
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Reports!A:T:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: rows })
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
