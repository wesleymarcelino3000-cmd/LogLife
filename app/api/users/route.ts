// app/api/users/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SALT = 'loglife2024'

export async function GET() {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('app_users')
      .select('id, username, name, role, active, created_at')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, name, password, role } = body

    if (!username || !password || !name) {
      return NextResponse.json({ error: 'Usuário, nome e senha são obrigatórios' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    const password_hash = crypto
      .createHash('sha256')
      .update(password + SALT)
      .digest('hex')

    const { data, error } = await (supabaseAdmin as any)
      .from('app_users')
      .insert({ username: username.toLowerCase().trim(), name, password_hash, salt: SALT, role: role || 'operator' })
      .select('id, username, name, role')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Usuário já existe' }, { status: 400 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ user: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
