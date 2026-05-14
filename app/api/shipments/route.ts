export const dynamic = 'force-dynamic'

// app/api/shipments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/shipments — lista com filtros
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status')
  const is_express = searchParams.get('express')
  const carrier    = searchParams.get('carrier')
  const cep        = searchParams.get('cep')
  const limit      = parseInt(searchParams.get('limit') ?? '50')
  const offset     = parseInt(searchParams.get('offset') ?? '0')

  let query = supabaseAdmin
    .from('shipments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)            query = query.eq('status', status)
  if (is_express === '1') query = query.eq('is_express', true)
  if (carrier)           query = query.eq('carrier', carrier)
  if (cep)               query = query.eq('recipient_cep', cep)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count })
}

// POST /api/shipments — criar envio
export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('shipments')
    .insert({
      order_id:        body.order_id,
      carrier:         body.carrier,
      recipient_name:  body.recipient_name,
      recipient_phone: body.recipient_phone,
      recipient_cep:   body.recipient_cep,
      recipient_city:  body.recipient_city,
      recipient_state: body.recipient_state,
      recipient_addr:  body.recipient_addr,
      recipient_num:   body.recipient_num,
      recipient_comp:  body.recipient_comp,
      sender_cep:      body.sender_cep,
      sender_city:     body.sender_city,
      sender_state:    body.sender_state,
      weight_kg:       body.weight_kg,
      length_cm:       body.length_cm,
      width_cm:        body.width_cm,
      height_cm:       body.height_cm,
      value_brl:       body.value_brl,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dispara webhook se o envio for express
  if (data.is_express) {
    await dispatchWebhook('express.queue_entry', data)
  }

  return NextResponse.json({ data }, { status: 201 })
}

// ---- helper interno ----
async function dispatchWebhook(event: string, payload: unknown) {
  const { data: hooks } = await supabaseAdmin
    .from('webhooks')
    .select('*')
    .eq('active', true)
    .contains('events', [event])

  if (!hooks) return

  for (const hook of hooks) {
    const start = Date.now()
    try {
      const res = await fetch(hook.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-LogLife-Event': event },
        body:    JSON.stringify({ event, data: payload }),
      })
      await supabaseAdmin.from('webhook_logs').insert({
        webhook_id:  hook.id,
        event,
        payload:     payload as Record<string, unknown>,
        status_code: res.status,
        response_ms: Date.now() - start,
        success:     res.ok,
      })
    } catch {
      await supabaseAdmin.from('webhook_logs').insert({
        webhook_id: hook.id,
        event,
        payload:    payload as Record<string, unknown>,
        success:    false,
        response_ms: Date.now() - start,
      })
    }
  }
}
