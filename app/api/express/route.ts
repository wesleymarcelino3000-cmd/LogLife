export const dynamic = 'force-dynamic'

// app/api/express/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type QueueRow = {
  id: string
  shipment_id: string
  cep: string
  status: string
  dispatched_at?: string
  created_at: string
  shipment?: {
    id: string
    order_id: string
    tracking_code: string
    carrier: string
    recipient_name: string
    recipient_cep: string
    recipient_city: string
    weight_kg: number
    value_brl: number
    created_at: string
  }
}

// GET /api/express — fila Entregar Agora
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cep    = searchParams.get('cep')
  const status = searchParams.get('status') ?? 'waiting'

  let query = supabaseAdmin
    .from('express_queue')
    .select(`
      *,
      shipment:shipments (
        id, order_id, tracking_code, carrier,
        recipient_name, recipient_cep, recipient_city,
        weight_kg, value_brl, created_at
      )
    `)
    .eq('status', status)
    .order('created_at', { ascending: true })

  if (cep) query = query.eq('cep', cep)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as QueueRow[]
  const stats = {
    total:   rows.length,
    pimenta: rows.filter(r => r.cep === '35585-000').length,
    piumhi:  rows.filter(r => r.cep === '37925-000').length,
  }

  return NextResponse.json({ data: rows, stats })
}

// POST /api/express/dispatch — despachar toda a fila (ou por CEP)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cep, ids } = body

  let query = supabaseAdmin
    .from('express_queue')
    .select('*, shipment:shipments(*)')
    .eq('status', 'waiting')

  if (cep)         query = query.eq('cep', cep)
  if (ids?.length) query = query.in('id', ids)

  const { data: queue, error: fetchErr } = await query
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const queueRows = (queue ?? []) as QueueRow[]
  if (!queueRows.length) return NextResponse.json({ message: 'Fila vazia', dispatched: 0 })

  const queueIds    = queueRows.map(q => q.id)
  const shipmentIds = queueRows.map(q => q.shipment_id)
  const now         = new Date().toISOString()

  const { error: qErr } = await supabaseAdmin
    .from('express_queue')
    .update({ status: 'dispatched', dispatched_at: now })
    .in('id', queueIds)

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  await supabaseAdmin
    .from('shipments')
    .update({ status: 'posted', posted_at: now })
    .in('id', shipmentIds)

  const labelInserts = queueRows.map(q => ({
    shipment_id: q.shipment_id,
    carrier:     q.shipment?.carrier ?? 'jt',
    status:      'printing' as const,
  }))
  await supabaseAdmin.from('labels').insert(labelInserts)

  await dispatchWebhook('express.dispatched', {
    dispatched_count: queueRows.length,
    queue_ids:        queueIds,
    cep_filter:       cep ?? null,
    dispatched_at:    now,
  })

  return NextResponse.json({
    message:    `${queueRows.length} pedidos despachados com sucesso`,
    dispatched: queueRows.length,
    ids:        queueIds,
  })
}

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
        webhook_id:  hook.id,
        event,
        payload:     payload as Record<string, unknown>,
        success:     false,
        response_ms: Date.now() - start,
      })
    }
  }
}
