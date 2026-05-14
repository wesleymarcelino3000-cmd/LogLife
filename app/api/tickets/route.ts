export const dynamic = 'force-dynamic'

// app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const limit    = parseInt(searchParams.get('limit') ?? '50')
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  let query = supabaseAdmin
    .from('tickets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)   query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert({
      shipment_id: body.shipment_id ?? null,
      title:       body.title,
      description: body.description ?? null,
      priority:    body.priority ?? 'medium',
      opened_by:   body.opened_by ?? null,
      carrier:     body.carrier ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
