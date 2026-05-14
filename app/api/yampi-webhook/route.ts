// app/api/yampi-webhook/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const EXPRESS_CEPS = ['35585-000', '37925-000']

// Mapeamento de status Yampi → status interno
const STATUS_MAP: Record<string, string> = {
  'pending':          'pending',
  'authorized':       'pending',
  'payment_approved': 'pending',
  'paid':             'pending',
  'handling_products':'pending',
  'ready_for_shipping':'pending',
  'created':          'pending',
  'separating':       'pending',
  'invoiced':         'pending',
  'ready_to_ship':    'pending',
  'shipped':          'in_transit',
  'delivered':        'delivered',
  'canceled':         'failed',
  'returned':         'returned',
}

// GET — retorna a URL para configurar na Yampi
export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'log-life-brown.vercel.app'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const webhookUrl = `${proto}://${host}/api/yampi-webhook`

  return NextResponse.json({
    webhook_url: webhookUrl,
    method: 'POST',
    description: 'URL para configurar nos webhooks da Yampi',
    events_supported: [
      'order.created',
      'order.status.authorized',
      'order.status.payment_approved',
      'order.status.separating',
      'order.status.invoiced',
      'order.status.ready_to_ship',
      'order.status.shipped',
      'order.status.delivered',
      'order.status.canceled',
      'order.status.returned',
    ],
    instructions: [
      '1. Acesse sua loja na Yampi',
      '2. Vá em Configurações → Webhooks',
      '3. Clique em + Novo Webhook',
      '4. Cole a webhook_url acima',
      '5. Selecione os eventos desejados',
      '6. Salve e ative o webhook',
    ],
  })
}

// POST — recebe eventos da Yampi
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Log do evento recebido
    const event   = body.event || body.type || 'unknown'
    const order   = body.data || body.order || body.resource || {}
    const orderId = String(order.id || order.order_id || '')

    console.log(`[Yampi Webhook] Event: ${event}, Order: ${orderId}`)

    // Salva log no banco
    await (supabaseAdmin as any)
      .from('webhook_logs')
      .insert({
        webhook_id:  null,
        event:       `yampi.${event}`,
        payload:     body,
        status_code: 200,
        success:     true,
      })

    if (!orderId) {
      return NextResponse.json({ received: true, message: 'Evento sem order_id ignorado' })
    }

    // Extrai dados do pedido
    const shipping  = order.shipping_address || order.address || {}
    const customer  = order.customer?.data || order.customer || {}
    const cepRaw    = (shipping.zipcode || shipping.zip_code || shipping.cep || '').replace(/\D/g, '')
    const cep       = cepRaw.length === 8 ? `${cepRaw.slice(0,5)}-${cepRaw.slice(5)}` : ''
    const isExpress = EXPRESS_CEPS.includes(cep)
    const yampiStatus = order.status?.alias || order.status || ''
    const internalStatus = STATUS_MAP[yampiStatus] || 'pending'

    // Verifica se pedido já existe
    const { data: existing } = await (supabaseAdmin as any)
      .from('shipments')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle()

    if (existing) {
      // Atualiza status se pedido já existe
      await (supabaseAdmin as any)
        .from('shipments')
        .update({
          status:       internalStatus,
          delivered_at: internalStatus === 'delivered' ? new Date().toISOString() : null,
        })
        .eq('order_id', orderId)

      console.log(`[Yampi Webhook] Updated order ${orderId} → ${internalStatus}`)
      return NextResponse.json({ received: true, action: 'updated', order_id: orderId, status: internalStatus })
    }

    // Cria novo pedido se não existe e status é elegível
    const eligibleStatuses = ['authorized','payment_approved','separating','invoiced','ready_to_ship','paid','handling_products','ready_for_shipping','created']
    if (!eligibleStatuses.includes(yampiStatus)) {
      return NextResponse.json({ received: true, action: 'skipped', reason: `Status ${yampiStatus} não elegível para criação` })
    }

    const { data: newShipment, error: insertErr } = await (supabaseAdmin as any)
      .from('shipments')
      .insert({
        order_id:        orderId,
        carrier:         'jt',
        status:          internalStatus,
        recipient_name:  `${customer.first_name||''} ${customer.last_name||''}`.trim() || 'Cliente',
        recipient_phone: customer.phone || null,
        recipient_cep:   cep,
        recipient_city:  shipping.city || '',
        recipient_state: shipping.state || '',
        recipient_addr:  shipping.street || shipping.address || '',
        recipient_num:   shipping.number || '',
        recipient_comp:  shipping.complement || '',
        value_brl:       parseFloat(order.value || order.total || '0'),
        weight_kg:       0.5,
        is_express:      isExpress,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[Yampi Webhook] Insert error:', insertErr)
      return NextResponse.json({ received: true, action: 'error', error: insertErr.message }, { status: 500 })
    }

    console.log(`[Yampi Webhook] Created order ${orderId}, express: ${isExpress}`)
    return NextResponse.json({
      received:   true,
      action:     'created',
      order_id:   orderId,
      is_express: isExpress,
      status:     internalStatus,
    })

  } catch (e: any) {
    console.error('[Yampi Webhook] Error:', e)
    return NextResponse.json({ received: true, error: e.message }, { status: 500 })
  }
}
