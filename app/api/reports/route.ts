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

interface StatSet {
  pass: number; complete: number; goals: number; assists: number
  shotOnGoal: number; shotNotOnGoal: number; takeAway: number
  loseBallDribbling: number; dangerousBallMiddle: number; badTouch: number
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v))
}

function scoreFromStats(s: StatSet): number {
  const passComp = s.pass > 0 ? (s.complete / s.pass) * 100 : 0
  let passScore: number
  if (passComp >= 90) passScore = 100
  else if (passComp >= 80) passScore = 80 + (passComp - 80) * 2
  else if (passComp >= 70) passScore = 60 + (passComp - 70) * 2
  else if (passComp >= 60) passScore = 40 + (passComp - 60) * 2
  else passScore = Math.max(0, passComp * 0.67)
  const passVol = s.pass > 0 ? clamp(Math.log(s.pass + 1) / Math.log(41) * 100) : 0
  const takeScore   = clamp(s.takeAway * 10)
  const sogScore    = clamp(s.shotOnGoal * 12)
  const goalScore   = clamp(s.goals * 25)
  const assistScore = clamp(s.assists * 15)
  const sngScore    = clamp(s.shotNotOnGoal * 5)
  const loseBallPen = clamp(s.loseBallDribbling * 12 + Math.max(0, s.loseBallDribbling - 3) * 6)
  const dangerPen   = clamp(s.dangerousBallMiddle * 10 + Math.max(0, s.dangerousBallMiddle - 3) * 5)
  const badTouchPen = clamp(s.badTouch * 8 + Math.max(0, s.badTouch - 4) * 4)
  const raw = passScore * 0.35 + passVol * 0.10 + takeScore * 0.15 + sogScore * 0.15 +
    goalScore * 0.15 + assistScore * 0.05 + sngScore * 0.05 -
    loseBallPen * 0.10 - dangerPen * 0.10 - badTouchPen * 0.10
  return clamp(raw)
}

function scoreToGrade(score: number): string {
  if (score >= 96) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 86) return 'B+'
  if (score >= 82) return 'B'
  if (score >= 78) return 'B-'
  if (score >= 74) return 'C+'
  if (score >= 70) return 'C'
  if (score >= 66) return 'C-'
  if (score >= 62) return 'D+'
  if (score >= 58) return 'D'
  if (score >= 54) return 'D-'
  return 'F'
}

function mergeStats(a: StatSet, b: StatSet | null, bWeight = 0.5): StatSet {
  if (!b) return a
  const w = bWeight
  const blend = (av: number, bv: number) => Math.round(av * (1 - w) + bv * w)
  return {
    pass: blend(a.pass, b.pass), complete: blend(a.complete, b.complete),
    goals: blend(a.goals, b.goals), assists: blend(a.assists, b.assists),
    shotOnGoal: blend(a.shotOnGoal, b.shotOnGoal), shotNotOnGoal: blend(a.shotNotOnGoal, b.shotNotOnGoal),
    takeAway: blend(a.takeAway, b.takeAway), loseBallDribbling: blend(a.loseBallDribbling, b.loseBallDribbling),
    dangerousBallMiddle: blend(a.dangerousBallMiddle, b.dangerousBallMiddle), badTouch: blend(a.badTouch, b.badTouch),
  }
}

function toStatSet(r: Record<string, number>): StatSet {
  return {
    pass: r.pass || 0, complete: r.complete || 0, goals: r.goals || 0, assists: r.assists || 0,
    shotOnGoal: r.shotOnGoal || 0, shotNotOnGoal: r.shotNotOnGoal || 0, takeAway: r.takeAway || 0,
    loseBallDribbling: r.loseBallDribbling || 0, dangerousBallMiddle: r.dangerousBallMiddle || 0, badTouch: r.badTouch || 0,
  }
}

export async function GET() {
  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Reports!A:W' })
    const rows = resp.data.values ?? []
    if (rows.length < 2) return NextResponse.json({ reports: [] }, { headers: { 'cache-control': 'no-store' } })

    const rawReports = rows.slice(1).filter((r: string[]) => r[0]).map((r: string[]) => ({
      timestamp: r[0] ?? '', gameId: r[1] ?? '', gameLabel: r[2] ?? '',
      submittedBy: r[3] ?? '', player: r[4] ?? '', type: r[5] ?? 'self',
      stats: {
        pass: Number(r[6]) || 0, complete: Number(r[7]) || 0,
        goals: Number(r[8]) || 0, assists: Number(r[9]) || 0,
        shotOnGoal: Number(r[10]) || 0, shotNotOnGoal: Number(r[11]) || 0,
        takeAway: Number(r[12]) || 0, loseBallDribbling: Number(r[13]) || 0,
        dangerousBallMiddle: Number(r[14]) || 0, badTouch: Number(r[15]) || 0,
      },
      filmMinute: r[16] ?? '', notes: r[17] ?? '',
      grades: { Passing: r[18] ?? '', TakeAways: r[19] ?? '', Touches: r[20] ?? '', Control: r[21] ?? '', Recovery: r[22] ?? '' },
      perfGrade: '' as string,
      perfScore: 0 as number,
    }))

    const playerGameMap: Record<string, { self: typeof rawReports[0] | null; peers: typeof rawReports[0][] }> = {}
    for (const r of rawReports) {
      const key = r.player + '::' + r.gameId
      if (!playerGameMap[key]) playerGameMap[key] = { self: null, peers: [] }
      if (r.type === 'self') playerGameMap[key].self = r
      else if (r.type === 'peer') playerGameMap[key].peers.push(r)
    }

    for (const key of Object.keys(playerGameMap)) {
      const { self, peers } = playerGameMap[key]
      if (!self) continue
      const selfSet = toStatSet(self.stats)
      let peerSet: StatSet | null = null
      if (peers.length > 0) {
        const totals: StatSet = { pass:0,complete:0,goals:0,assists:0,shotOnGoal:0,shotNotOnGoal:0,takeAway:0,loseBallDribbling:0,dangerousBallMiddle:0,badTouch:0 }
        for (const p of peers) for (const k of Object.keys(totals) as (keyof StatSet)[]) totals[k] += p.stats[k] || 0
        for (const k of Object.keys(totals) as (keyof StatSet)[]) (totals[k] as number) = Math.round(totals[k] / peers.length)
        peerSet = totals
      }
      const blended = mergeStats(selfSet, peerSet, 0.4)
      const score = scoreFromStats(blended)
      self.perfGrade = scoreToGrade(score)
      self.perfScore = Math.round(score)
    }

    return NextResponse.json({ reports: rawReports }, { headers: { 'cache-control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Reports API error:', msg)
    return NextResponse.json({ error: msg, reports: [] }, { status: 500 })
  }
}
