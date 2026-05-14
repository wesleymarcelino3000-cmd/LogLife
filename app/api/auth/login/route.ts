// app/api/auth/login/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 })
    }

    // Busca usuário pelo username na tabela users
    const { data: user, error } = await (supabaseAdmin as any)
      .from('app_users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('active', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    // Verifica senha com bcrypt simples (hash stored in db)
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(password + user.salt).digest('hex')

    if (hash !== user.password_hash) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    // Cria sessão simples via cookie
    const session = {
      id:       user.id,
      username: user.username,
      name:     user.name,
      role:     user.role,
      expires:  Date.now() + 24 * 60 * 60 * 1000, // 24h
    }

    const sessionStr = Buffer.from(JSON.stringify(session)).toString('base64')

    const response = NextResponse.json({ success: true, user: { username: user.username, name: user.name, role: user.role } })
    response.cookies.set('loglife_session', sessionStr, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    })

    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
