export const dynamic = 'force-dynamic'

// app/api/nfe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const YAMPI_API_BASE = 'https://api.dooki.com.br/v2'

async function yampiGet(alias: string, path: string, token: string, secret: string) {
  const res = await fetch(`${YAMPI_API_BASE}/${alias}/${path}`, {
    headers: {
      'User-Token': token,
      'User-Secret-Key': secret,
      'Content-Type': 'application/json',
    },
  })
  const json = await res.json().catch(() => null)
  return { res, json }
}

// GET /api/nfe?shipment_id=xxx — busca NF-e da Yampi
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const shipmentId = searchParams.get('shipment_id')
  if (!shipmentId) return NextResponse.json({ error: 'shipment_id obrigatório' }, { status: 400 })

  const { data: shipment } = await supabaseAdmin
    .from('shipments').select('*').eq('id', shipmentId).single()

  if (!shipment) return NextResponse.json({ error: 'Shipment não encontrado' }, { status: 404 })

  // Se já tem chave salva, retorna direto
  if (shipment.nfe_chave) {
    return NextResponse.json({
      chave_acesso: shipment.nfe_chave,
      numero: shipment.nfe_numero,
      serie: shipment.nfe_serie,
      xml_url: shipment.nfe_xml_url,
      cached: true,
    })
  }

  // Busca credenciais Yampi
  const { data: integration } = await supabaseAdmin
    .from('integrations').select('*').eq('provider', 'yampi').eq('active', true).single()

  if (!integration) return NextResponse.json({ error: 'Integração Yampi não configurada' }, { status: 400 })

  const alias  = integration.alias  || integration.config?.alias
  const token  = integration.token  || integration.config?.token
  const secret = integration.secret || integration.config?.secret

  // Busca pedido na Yampi com invoices
  const { res, json } = await yampiGet(alias, `orders/${shipment.order_id}?include=invoices`, token, secret)
  if (!res.ok) return NextResponse.json({ error: `Erro na Yampi: ${json?.message || res.status}` }, { status: 502 })

  const order    = json?.data || json
  const invoices = order?.invoices?.data || order?.invoices || []
  const invoice  = invoices[0] || null

  const chave  = invoice?.access_key || invoice?.chave_acesso || invoice?.key || null
  const numero = invoice?.number     || invoice?.numero       || null
  const serie  = invoice?.serie      || invoice?.series       || null
  const xmlUrl = invoice?.xml_url    || invoice?.xml          || null

  if (!chave) {
    return NextResponse.json({
      error: 'NF-e ainda não disponível para este pedido',
      details: `Status: ${order?.status?.alias || 'desconhecido'}`,
    }, { status: 404 })
  }

  const chaveClean = chave.replace(/\D/g, '')
  if (chaveClean.length !== 44) {
    return NextResponse.json({ error: `Chave inválida: ${chaveClean.length} dígitos` }, { status: 422 })
  }

  // Salva no Supabase
  await supabaseAdmin.from('shipments').update({
    nfe_chave: chaveClean,
    nfe_numero: numero,
    nfe_serie: serie,
    nfe_xml_url: xmlUrl,
  }).eq('id', shipmentId)

  return NextResponse.json({ chave_acesso: chaveClean, numero, serie, xml_url: xmlUrl, cached: false })
}

// POST /api/nfe — inserir chave manualmente
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { shipment_id, chave_acesso } = body

  if (!shipment_id || !chave_acesso)
    return NextResponse.json({ error: 'shipment_id e chave_acesso obrigatórios' }, { status: 400 })

  const chaveClean = chave_acesso.replace(/\D/g, '')
  if (chaveClean.length !== 44)
    return NextResponse.json({ error: `Chave inválida: ${chaveClean.length} dígitos (esperado 44)` }, { status: 422 })

  const { error } = await supabaseAdmin
    .from('shipments').update({ nfe_chave: chaveClean }).eq('id', shipment_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, chave_acesso: chaveClean })
}
