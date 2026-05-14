// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get('loglife_session')
  if (!sessionCookie) return NextResponse.json({ user: null }, { status: 401 })

  try {
    const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())
    if (session.expires < Date.now()) return NextResponse.json({ user: null }, { status: 401 })
    return NextResponse.json({ user: session })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
