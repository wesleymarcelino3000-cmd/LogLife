// app/api/integrations/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('api_integrations')
      .select('id, name, url, api_key, secret, auth_type, status, active, calls_today, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('GET integrations error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('GET integrations exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.name || !body.url) {
      return NextResponse.json({ error: 'name e url são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin as any)
      .from('api_integrations')
      .insert({
        name:      body.name,
        url:       body.url,
        api_key:   body.api_key   || null,
        secret:    body.secret !== undefined ? (body.secret || null) : undefined,
        auth_type: body.auth_type || 'yampi',
        status:    'disconnected',
        active:    true,
        calls_today: 0,
      })
      .select('id, name, url, api_key, secret, auth_type, status, active, calls_today, created_at')
      .single()

    if (error) {
      console.error('POST integrations error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (e: any) {
    console.error('POST integrations exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT e DELETE pelo query param ?id=
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const body = await req.json()

    const { data, error } = await (supabaseAdmin as any)
      .from('api_integrations')
      .update({
        name:      body.name,
        url:       body.url,
        api_key:   body.api_key   || null,
        secret:    body.secret !== undefined ? (body.secret || null) : undefined,
        auth_type: body.auth_type || 'yampi',
        active:    body.active    ?? true,
        status:    body.status    || 'disconnected',
      })
      .eq('id', id)
      .select('id, name, url, api_key, secret, auth_type, status, active, calls_today')
      .single()

    if (error) {
      console.error('PUT integrations error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const { error } = await (supabaseAdmin as any)
      .from('api_integrations')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
