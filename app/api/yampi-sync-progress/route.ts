export const dynamic = 'force-dynamic'

// app/api/yampi-sync-progress/route.ts
// Sync com progresso via Server-Sent Events (SSE)
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const YAMPI_API_BASE = 'https://api.dooki.com.br/v2'
const EXPRESS_CEPS   = ['35585-000', '37925-000']
const MAX_PAGES      = 200

const ELIGIBLE = [
  // Status confirmados na Yampi
  'authorized',
  'paid',
  'invoiced',
  'handling_products',
  'ready_for_shipping',
  'ready_for_pickup',
  'created',
  // Variantes alternativas
  'payment_approved',
  'separating',
  'ready_to_ship',
  'payment_confirmed',
  'processing',
]

function send(ctrl: ReadableStreamDefaultController, data: object) {
  ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
}

async function yampiGet(alias: string, path: string, token: string, secret: string) {
  const res = await fetch(`${YAMPI_API_BASE}/${alias}/${path}`, {
    headers: { 'User-Token': token, 'User-Secret-Key': secret, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  const json = await res.json().catch(() => null)
  return { res, json }
}

function extractArray(json: any): any[] {
  if (Array.isArray(json))            return json
  if (Array.isArray(json?.data))      return json.data
  if (Array.isArray(json?.data?.data)) return json.data.data
  return []
}

function getOrderId(order: any): string | null {
  const d = order?.data || order
  return String(d?.id || d?.order_id || d?.number || '').trim() || null
}

function getStatusAlias(order: any): string {
  const d = order?.data || order
  return d?.status?.alias || d?.status_alias || d?.status || ''
}

function extractProduct(data: any): string | null {
  const items = data?.items?.data || data?.items || []
  if (!items.length) return null
  return items.map((item: any) => {
    const qty  = item.quantity || item.qty || 1
    const name = item.product?.data?.title || item.product?.title || item.name || item.title || item.sku || ''
    return name ? `${qty}x ${name}` : ''
  }).filter(Boolean).join('\n') || null
}

async function importOrder(order: any): Promise<{ imported: boolean; skipped: boolean; error?: string }> {
  const data    = order?.data || order
  const orderId = getOrderId(order)
  if (!orderId) return { imported: false, skipped: false, error: 'Sem ID' }

  const statusAlias = getStatusAlias(order)
  if (statusAlias && !ELIGIBLE.includes(statusAlias)) return { imported: false, skipped: true }

  const { data: existing } = await (supabaseAdmin as any)
    .from('shipments').select('id').eq('order_id', orderId).maybeSingle()
  if (existing) return { imported: false, skipped: true }

  const shipping = data.shipping_address?.data || data.shipping_address || data.shipping?.address?.data || data.shipping?.address || {}
  const customer = data.customer?.data || data.customer || data.buyer?.data || data.buyer || {}
  const cepRaw   = (shipping.zipcode || shipping.zip_code || shipping.cep || data.zipcode || '').toString().replace(/\D/g, '')
  const cep      = cepRaw.length === 8 ? `${cepRaw.slice(0,5)}-${cepRaw.slice(5)}` : cepRaw || '00000-000'
  const firstName = customer.first_name || customer.name?.split(' ')[0] || ''
  const lastName  = customer.last_name  || customer.name?.split(' ').slice(1).join(' ') || ''
  const fullName  = `${firstName} ${lastName}`.trim() || 'Cliente'
  const value     = parseFloat(data.value || data.total || data.subtotal || '0') || 0
  const invoices  = data.invoices?.data || data.invoices || []
  const invoice   = invoices[0] || null
  const nfeChave  = (invoice?.access_key || invoice?.chave_acesso || invoice?.key || '').replace(/\D/g, '') || null

  const { error } = await (supabaseAdmin as any).from('shipments').insert({
    order_id:       orderId,
    carrier:        'jt',
    status:         'pending',
    recipient_name: fullName,
    recipient_phone: customer.phone || customer.mobile || null,
    recipient_cep:  cep,
    recipient_city: shipping.city  || data.city  || '',
    recipient_state: shipping.state || data.state || '',
    recipient_addr: shipping.street || shipping.address || data.address || '',
    recipient_num:  String(shipping.number || data.number || ''),
    recipient_comp: shipping.complement || '',
    value_brl:      value,
    weight_kg:      0.5,
    is_express:     EXPRESS_CEPS.includes(cep),
    product_name:   extractProduct(data),
    ordered_at:     data.created_at || data.date || null,
    nfe_chave:      nfeChave?.length === 44 ? nfeChave : null,
  })

  if (error) return { imported: false, skipped: false, error: error.message }
  return { imported: true, skipped: false }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { yampi_token, secret, alias, url } = body

  // Resolve alias
  let resolvedAlias = alias || ''
  if (!resolvedAlias && url) {
    const m = url.match(/dooki\.com\.br\/v2\/([^/]+)/)
    if (m) resolvedAlias = m[1]
    else resolvedAlias = url.replace(/^https?:\/\//, '').split('/')[0]
  }
  resolvedAlias = resolvedAlias.replace(/^https?:\/\/[^/]+\/v\d+\//, '').split('/')[0].trim()

  const stream = new ReadableStream({
    async start(ctrl) {
      let synced = 0, skipped = 0, errors = 0, totalProcessed = 0

      send(ctrl, { type: 'start', message: 'Iniciando sincronização...' })

      for (let page = 1; page <= MAX_PAGES; page++) {
        try {
          send(ctrl, { type: 'progress', page, synced, skipped, errors, message: `Buscando página ${page}...` })

          const { res, json } = await yampiGet(
            resolvedAlias,
            `orders?limit=50&page=${page}&include=invoices,items.product`,
            yampi_token,
            secret || ''
          )

          if (!res.ok) {
            send(ctrl, { type: 'error', message: `Erro HTTP ${res.status} na página ${page}` })
            break
          }

          const orders = extractArray(json)
          if (!orders.length) break

          for (const order of orders) {
            totalProcessed++
            const result = await importOrder(order)
            if (result.imported) synced++
            else if (result.skipped) skipped++
            else errors++

            // Envia progresso a cada 10 pedidos
            if (totalProcessed % 10 === 0) {
              send(ctrl, { type: 'progress', page, synced, skipped, errors, totalProcessed, message: `Página ${page} — ${totalProcessed} processados` })
            }
          }

          if (orders.length < 50) break
        } catch (e: any) {
          send(ctrl, { type: 'error', message: `Erro na página ${page}: ${e.message}` })
          break
        }
      }

      send(ctrl, { type: 'done', synced, skipped, errors, totalProcessed, message: `Concluído! ${synced} novos pedidos importados.` })
      ctrl.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
