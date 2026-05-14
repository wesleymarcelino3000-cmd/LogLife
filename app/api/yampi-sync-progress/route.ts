export const dynamic = 'force-dynamic'

// app/api/yampi-sync-progress/route.ts
// Sync com progresso via Server-Sent Events (SSE)
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const YAMPI_API_BASE = 'https://api.dooki.com.br/v2'
const EXPRESS_CEPS   = ['35585-000', '37925-000']
const MAX_PAGES      = 200

// Status que entram na Fila de Etiquetas / Fila de Envio
const ELIGIBLE = [
  'authorized',          // Pedido autorizado
  'paid',                // Pagamento aprovado
  'payment_approved',
  'handling_products',   // Produtos em separação
  'separating',
  'invoiced',            // Faturado
  'ready_for_shipping',  // Pronto para envio
  'ready_to_ship',
]

function send(ctrl: ReadableStreamDefaultController, data: object) {
  ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
}

function clean(v: unknown) { return String(v || '').trim() }

function envAliases() {
  const aliases = [
    process.env.YAMPI_ALIAS_1,
    process.env.YAMPI_ALIAS_2,
    process.env.YAMPI_ALIAS_3,
    process.env.YAMPI_ALIAS,
  ].map(clean).filter(Boolean)
  return Array.from(new Set(aliases))
}

async function yampiGet(alias: string, path: string, token: string, secret: string) {
  const res = await fetch(`${YAMPI_API_BASE}/${encodeURIComponent(alias)}/${path}`, {
    headers: { 'User-Token': token, 'User-Secret-Key': secret, 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  const json = await res.json().catch(() => null)
  return { res, json }
}

function extractArray(json: any): any[] {
  if (Array.isArray(json))             return json
  if (Array.isArray(json?.data))       return json.data
  if (Array.isArray(json?.data?.data)) return json.data.data
  return []
}

function dataOf(order: any) { return order?.data || order || {} }

function getOrderId(order: any): string | null {
  const d = dataOf(order)
  return String(d?.id || d?.order_id || d?.number || d?.code || d?.token || '').trim() || null
}

function getStatusAlias(order: any): string {
  const d = dataOf(order)
  const status = d.status?.data || d.status || d.order_status?.data || d.order_status || {}
  return clean(d.status_alias || d.status?.alias || d.status?.data?.alias || status.alias || status.key || status.slug || '')
}

function extractProduct(data: any): string | null {
  const items = data?.items?.data || data?.items || []
  if (!items.length) return null
  const names = items.map((item: any) => {
    const qty  = item.quantity || item.qty || 1
    const name =
      item.product?.data?.title || item.product?.title ||
      item.product?.data?.name  || item.product?.name  ||
      (typeof item.product === 'string' ? item.product : '') ||
      (typeof item.name    === 'string' ? item.name    : '') ||
      (typeof item.title   === 'string' ? item.title   : '') ||
      item.sku || ''
    return name ? `${qty}x ${name}` : ''
  }).filter(Boolean)
  return names.length ? names.join('\n') : null
}

async function importOrder(order: any, storeAlias: string): Promise<{ imported: boolean; skipped: boolean; updated?: boolean; error?: string }> {
  const data    = dataOf(order)
  const orderId = getOrderId(order)
  if (!orderId) return { imported: false, skipped: false, error: 'Sem ID' }

  const statusAlias = getStatusAlias(order)
  if (statusAlias && !ELIGIBLE.includes(statusAlias)) return { imported: false, skipped: true }

  const shipping = data.shipping_address?.data || data.shipping_address || data.shipping?.address?.data || data.shipping?.address || {}
  const customer = data.customer?.data || data.customer || data.buyer?.data || data.buyer || {}
  const cepRaw   = (shipping.zipcode || shipping.zip_code || shipping.cep || data.zipcode || '').toString().replace(/\D/g, '')
  const cep      = cepRaw.length === 8 ? `${cepRaw.slice(0,5)}-${cepRaw.slice(5)}` : cepRaw || '00000-000'
  const firstName = customer.first_name || customer.name?.split(' ')[0] || ''
  const lastName  = customer.last_name  || customer.name?.split(' ').slice(1).join(' ') || ''
  const fullName  = `${firstName} ${lastName}`.trim() || customer.name || 'Cliente'
  const value     = parseFloat(data.value || data.total || data.subtotal || data.total_value || '0') || 0
  const invoices  = data.invoices?.data || data.invoices || []
  const invoice   = invoices[0] || null
  const nfeChave  = (invoice?.access_key || invoice?.chave_acesso || invoice?.key || '').replace(/\D/g, '') || null

  const shipmentPayload = {
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
    ordered_at:     data.created_at || data.date || data.ordered_at || null,
    nfe_chave:      nfeChave?.length === 44 ? nfeChave : null,
  }

  const { data: existing } = await (supabaseAdmin as any)
    .from('shipments').select('id').eq('order_id', orderId).maybeSingle()

  if (existing) {
    const { error } = await (supabaseAdmin as any).from('shipments').update(shipmentPayload).eq('id', existing.id)
    if (error) return { imported: false, skipped: false, error: error.message }
    return { imported: false, skipped: false, updated: true }
  }

  const { error } = await (supabaseAdmin as any).from('shipments').insert({ order_id: orderId, ...shipmentPayload })
  if (error) return { imported: false, skipped: false, error: error.message }
  return { imported: true, skipped: false }
}

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch {}

  const token = clean(process.env.YAMPI_TOKEN || body.yampi_token)
  const secret = clean(process.env.YAMPI_SECRET || body.secret)
  const aliases = (Array.isArray(body.aliases) && body.aliases.length ? body.aliases : envAliases()).map(clean).filter(Boolean)

  const stream = new ReadableStream({
    async start(ctrl) {
      let synced = 0, skipped = 0, errors = 0, updated = 0, totalProcessed = 0

      if (!token || !secret || aliases.length === 0) {
        send(ctrl, { type: 'error', message: 'Configure YAMPI_TOKEN, YAMPI_SECRET e YAMPI_ALIAS_1/YAMPI_ALIAS_2/YAMPI_ALIAS_3 no Vercel.' })
        send(ctrl, { type: 'done', synced, skipped, errors: errors + 1, updated, totalProcessed, lastPage: 0 })
        ctrl.close()
        return
      }

      send(ctrl, { type: 'start', message: `Iniciando sincronização de ${aliases.length} lojas Yampi...` })

      for (const alias of aliases) {
        send(ctrl, { type: 'progress', page: 1, synced, skipped, errors, updated, totalProcessed, message: `Loja ${alias}: iniciando...` })

        for (let page = 1; page <= MAX_PAGES; page++) {
          try {
            send(ctrl, { type: 'progress', page, synced, skipped, errors, updated, totalProcessed, message: `Loja ${alias}: buscando página ${page}...` })

            const { res, json } = await yampiGet(
              alias,
              `orders?limit=50&page=${page}&include=invoices,items.product,customer,shipping_address&sort=-id`,
              token,
              secret
            )

            if (!res.ok) {
              errors++
              send(ctrl, { type: 'error', message: `Loja ${alias}: erro HTTP ${res.status} na página ${page}` })
              break
            }

            const orders = extractArray(json)
            if (!orders.length) break

            for (const order of orders) {
              totalProcessed++
              const result = await importOrder(order, alias)
              if (result.imported) synced++
              else if (result.updated) updated++
              else if (result.skipped) skipped++
              else errors++

              if (totalProcessed % 10 === 0) {
                send(ctrl, { type: 'progress', page, synced, skipped, errors, updated, totalProcessed, message: `${totalProcessed} pedidos processados — ${synced} novos, ${updated} atualizados` })
              }
            }

            if (orders.length < 50) break
            await new Promise(r => setTimeout(r, 250))
          } catch (e: any) {
            errors++
            send(ctrl, { type: 'error', message: `Loja ${alias}: ${e?.message || 'erro desconhecido'}` })
            break
          }
        }
      }

      try {
        await (supabaseAdmin as any).from('system_logs').insert({
          level: errors ? 'warning' : 'success',
          message: `Sincronização Yampi: ${synced} novos, ${updated} atualizados, ${skipped} ignorados, ${errors} erros`,
          source: 'yampi-sync-progress',
          details: { aliases, synced, updated, skipped, errors, totalProcessed, statuses: ELIGIBLE },
        })
      } catch {}

      send(ctrl, { type: 'done', synced, skipped, errors, updated, totalProcessed, lastPage: MAX_PAGES, message: `Concluído! ${synced} novos e ${updated} atualizados.` })
      ctrl.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
