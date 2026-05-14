export const dynamic = 'force-dynamic'

// app/api/errors/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/errors — listar logs do sistema
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const level  = searchParams.get('level')
    const limit  = parseInt(searchParams.get('limit') || '100')

    let query = (supabaseAdmin as any)
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (level) query = query.eq('level', level)

    const { data, error } = await query

    if (error) {
      // Se a tabela não existe ainda, retorna vazio
      if (error.code === '42P01') {
        return NextResponse.json({ data: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/errors — registrar log
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { data, error } = await (supabaseAdmin as any)
      .from('system_logs')
      .insert({
        level:   body.level   || 'info',
        message: body.message || '',
        source:  body.source  || null,
        details: body.details || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/errors — limpar todos os logs
export async function DELETE() {
  try {
    await (supabaseAdmin as any)
      .from('system_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
