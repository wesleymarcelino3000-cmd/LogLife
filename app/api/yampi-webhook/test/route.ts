// app/api/yampi-webhook/test/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const EXPRESS_CEPS = ['35585-000', '37925-000']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Simula um pedido de teste
    const cepRaw = (body.cep || '01310100').replace(/\D/g, '')
    const cep = cepRaw.length === 8 ? `${cepRaw.slice(0,5)}-${cepRaw.slice(5)}` : '01310-100'
    const isExpress = EXPRESS_CEPS.includes(cep)

    // Gera order_id único para teste
    const orderId = `TEST_${Date.now()}`

    const { data, error } = await (supabaseAdmin as any)
      .from('shipments')
      .insert({
        order_id:        orderId,
        carrier:         body.carrier || 'jt',
        status:          'pending',
        recipient_name:  body.name || 'Cliente Teste',
        recipient_phone: body.phone || null,
        recipient_cep:   cep,
        recipient_city:  body.city || 'São Paulo',
        recipient_state: body.state || 'SP',
        recipient_addr:  body.address || 'Rua de Teste',
        recipient_num:   body.number || '123',
        recipient_comp:  '',
        value_brl:       parseFloat(body.value || '100'),
        weight_kg:       parseFloat(body.weight || '0.5'),
        is_express:      isExpress,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log
    await (supabaseAdmin as any).from('system_logs').insert({
      level:   'info',
      message: `Pedido de teste criado: ${orderId}${isExpress ? ' ⚡ EXPRESS' : ''}`,
      source:  'yampi-webhook-test',
      details: { order_id: orderId, cep, is_express: isExpress },
    })

    return NextResponse.json({
      success:    true,
      order_id:   orderId,
      is_express: isExpress,
      cep,
      message:    isExpress 
        ? `✅ Pedido criado e adicionado à fila Entregar Agora (${cep})!`
        : `✅ Pedido de teste criado com sucesso!`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
