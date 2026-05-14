export const dynamic = 'force-dynamic'

// app/api/integrations/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  const { data, error } = await (supabaseAdmin as any)
    .from('api_integrations')
    .update({
      name:      body.name,
      url:       body.url,
      api_key:   body.api_key   ?? null,
      secret:    body.secret    ?? null,
      auth_type: body.auth_type ?? 'yampi',
      active:    body.active    ?? true,
      status:    body.status    ?? 'disconnected',
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await (supabaseAdmin as any)
    .from('api_integrations')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
