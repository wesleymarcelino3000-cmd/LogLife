export const dynamic = 'force-dynamic'

// app/api/labels/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'
  const limit  = parseInt(searchParams.get('limit') ?? '50')

  const { data, error, count } = await supabaseAdmin
    .from('labels')
    .select('*, shipment:shipments(order_id, recipient_name, recipient_cep, recipient_city, carrier, weight_kg, value_brl)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Gera etiqueta para um shipment
  const { data: shipment } = await supabaseAdmin
    .from('shipments')
    .select('*')
    .eq('id', body.shipment_id)
    .single()

  if (!shipment) return NextResponse.json({ error: 'Shipment não encontrado' }, { status: 404 })

  // Em produção: chamar API da transportadora para gerar URL real
  const label_url = `https://loglife.app/labels/${shipment.id}.pdf`

  const { data, error } = await supabaseAdmin
    .from('labels')
    .insert({
      shipment_id: body.shipment_id,
      carrier:     shipment.carrier,
      status:      'printed',
      label_url,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
