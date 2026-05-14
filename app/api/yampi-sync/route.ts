export const dynamic = 'force-dynamic'

// app/api/yampi-sync/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const EXPRESS_CEPS = ['35585-000', '37925-000']
const YAMPI_API_BASE = 'https://api.dooki.com.br/v2'

// Apenas esses status são importados
const ELIGIBLE_STATUS_ALIASES = [
  'authorized',
  'payment_approved',
  'separating',
  'invoiced',
  'ready_to_ship',
]

const STATUS_LABELS: Record<string, string> = {
  authorized:       'Pedido autorizado',
  payment_approved: 'Pagamento aprovado',
  separating:       'Produtos em separação',
  invoiced:         'Faturado',
  ready_to_ship:    'Pronto para envio',
}

function clean(value: unknown) {
  return String(value || '').trim()
}

function normalizeYampiAlias(value: unknown) {
  const raw = clean(value)
  if (!raw) return ''

  // Aceita tanto o alias puro, ex: melasonina, quanto a URL completa,
  // ex: https://api.dooki.com.br/v2/melasonina
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/').filter(Boolean)
    const v2Index = parts.findIndex((part) => part.toLowerCase() === 'v2')
    if (v2Index >= 0 && parts[v2Index + 1]) return clean(parts[v2Index + 1])
    if (parts.length > 0) return clean(parts[parts.length - 1])
    return clean(url.hostname.split('.')[0])
  } catch {
    const parts = raw.split('/').filter(Boolean)
    const v2Index = parts.findIndex((part) => part.toLowerCase() === 'v2')
    if (v2Index >= 0 && parts[v2Index + 1]) return clean(parts[v2Index + 1])
    return clean(parts[parts.length - 1] || raw)
  }
}

function maskSecret(value: string) {
  if (!value) return 'não configurado'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

async function readYampiResponse(res: Response) {
  const text = await res.text()
  try {
    return { text, json: text ? JSON.parse(text) : null }
  } catch {
    return { text, json: null }
  }
}

async function yampiGet(alias: string, path: string, yampiToken: string, yampiSecret: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const url = `${YAMPI_API_BASE}/${encodeURIComponent(alias)}${path}`
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Token': yampiToken,
        'User-Secret-Key': yampiSecret,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    const parsed = await readYampiResponse(res)
    return { res, ...parsed, url }
  } finally {
    clearTimeout(timeout)
  }
}

function extractArray(json: any): any[] {
  if (Array.isArray(json)) return json
  if (Array.isArray(json?.data)) return json.data
  if (Array.isArray(json?.statuses)) return json.statuses
  if (Array.isArray(json?.data?.data)) return json.data.data
  return []
}

function getStatusAlias(status: any) {
  const data = status?.data || status || {}
  return clean(data.alias || data.key || data.slug || data.status_alias)
}

function getStatusLabel(status: any, alias: string) {
  const data = status?.data || status || {}
  return clean(data.name || data.label || data.title || STATUS_LABELS[alias] || alias)
}

async function loadYampiStatuses(alias: string, yampiToken: string, yampiSecret: string) {
  const attempts = [
    '/checkout/statuses',
    '/orders/statuses',
  ]

  const details: string[] = []

  for (const path of attempts) {
    try {
      const result = await yampiGet(alias, path, yampiToken, yampiSecret)
      const apiMessage = result.json?.message || result.json?.error || result.text || 'Sem resposta da API'

      if (!result.res.ok) {
        details.push(`${path}: HTTP ${result.res.status} - ${String(apiMessage).slice(0, 300)}`)
        continue
      }

      const statuses = extractArray(result.json)
        .map((status) => {
          const key = getStatusAlias(status)
          return key ? { key, label: getStatusLabel(status, key) } : null
        })
        .filter(Boolean) as Array<{ key: string; label: string }>

      if (statuses.length > 0) {
        return { statuses, details }
      }

      details.push(`${path}: resposta sem lista de status`)
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Timeout ao consultar status da Yampi' : e?.message || 'Erro desconhecido'
      details.push(`${path}: ${msg}`)
    }
  }

  return { statuses: [], details }
}

function buildOrderQuery(page = 1) {
  // IMPORTANTE: a API da Yampi/Dooki pode retornar HTTP 500 quando usa
  // include=customer,shipping_address ou q[status_alias_eq] em algumas contas.
  // Por isso buscamos pedidos de forma simples e filtramos localmente.
  const params = new URLSearchParams()
  params.set('limit', '50')
  params.set('page', String(page))
  return `/orders?${params.toString()}`
}

function extractOrderPayload(order: any) {
  return order?.data || order || {}
}

function getOrderStatusAlias(order: any) {
  const data = extractOrderPayload(order)
  const status = data.status?.data || data.status || data.order_status?.data || data.order_status || {}
  return clean(
    data.status_alias ||
    data.status?.alias ||
    data.status?.data?.alias ||
    status.alias ||
    status.key ||
    status.slug ||
    ''
  )
}

function getOrderId(order: any) {
  const data = extractOrderPayload(order)
  return String(data?.id || data?.number || data?.code || data?.token || '').trim()
}

async function importOrder(order: any) {
  const data = extractOrderPayload(order)
  const orderId = getOrderId(data)
  if (!orderId) return { imported: false, skipped: false, error: 'Pedido sem ID' }

  // Filtra apenas status elegíveis
  const orderStatusAlias = getOrderStatusAlias(order)
  if (orderStatusAlias && !ELIGIBLE_STATUS_ALIASES.includes(orderStatusAlias)) {
    return { imported: false, skipped: true }
  }

  const shipping = data.shipping_address?.data || data.shipping_address || data.shipping?.address?.data || data.shipping?.address || {}
  const customer = data.customer?.data || data.customer || data.buyer?.data || data.buyer || {}

  // Extrai nome do produto dos itens do pedido
  const items = data.items?.data || data.items || []
  const productName = items.length > 0
    ? items.map((item: any) => {
        const qty = item.quantity || item.qty || 1
        const name = item.product?.data?.title || item.product?.title || item.name || item.title || item.sku || ''
        return name ? `${qty}x ${name}` : ''
      }).filter(Boolean).join('\n')
    : null

  const cepRaw = (
    shipping.zipcode || shipping.zip_code || shipping.cep ||
    data.zipcode || ''
  ).toString().replace(/\D/g, '')

  const cep = cepRaw.length === 8
    ? `${cepRaw.slice(0, 5)}-${cepRaw.slice(5)}`
    : cepRaw || '00000-000'

  const isExpress = EXPRESS_CEPS.includes(cep)

  const { data: existing } = await (supabaseAdmin as any)
    .from('shipments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existing) return { imported: false, skipped: true }

  const firstName = customer.first_name || customer.name?.split(' ')[0] || ''
  const lastName = customer.last_name || customer.name?.split(' ').slice(1).join(' ') || ''
  const fullName = `${firstName} ${lastName}`.trim() || customer.name || 'Cliente'

  const value = parseFloat(
    data.value || data.total || data.subtotal || data.total_value || '0'
  ) || 0

  const { error: insertErr } = await (supabaseAdmin as any)
    .from('shipments')
    .insert({
      order_id: orderId,
      carrier: 'jt',
      status: 'pending',
      recipient_name: fullName,
      recipient_phone: customer.phone || customer.mobile || null,
      recipient_cep: cep,
      recipient_city: shipping.city || data.city || '',
      recipient_state: shipping.state || data.state || '',
      recipient_addr: shipping.street || shipping.address || data.address || '',
      recipient_num: String(shipping.number || data.number || ''),
      recipient_comp: shipping.complement || '',
      value_brl: value,
      weight_kg: 0.5,
      is_express: isExpress,
      product_name: productName,
    })

  if (insertErr) return { imported: false, skipped: false, error: insertErr.message }
  return { imported: true, skipped: false }
}

export async function POST(req: NextRequest) {
  let body: any = {}

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido na requisição' }, { status: 400 })
  }

  // Prioridade:
  // 1) variáveis de ambiente do servidor/Vercel
  // 2) dados salvos no Supabase e enviados pelo painel
  const yampiToken = clean(process.env.YAMPI_TOKEN || body.yampi_token)
  const yampiSecret = clean(process.env.YAMPI_SECRET || body.secret)
  const alias = normalizeYampiAlias(process.env.YAMPI_ALIAS || body.alias || body.url)

  if (!yampiToken || !yampiSecret || !alias) {
    const missing = [
      !yampiToken ? 'YAMPI_TOKEN ou yampi_token' : null,
      !yampiSecret ? 'YAMPI_SECRET ou secret' : null,
      !alias ? 'YAMPI_ALIAS ou alias' : null,
    ].filter(Boolean)

    return NextResponse.json({
      error: 'Credenciais da Yampi incompletas',
      missing,
      hint: 'Configure YAMPI_TOKEN, YAMPI_SECRET e YAMPI_ALIAS nas variáveis de ambiente do Vercel ou preencha Token, Secret e Alias/URL em API → Minhas APIs.',
    }, { status: 400 })
  }

  let synced = 0
  let skipped = 0
  let errors = 0
  const errorDetails: string[] = []

  console.log('[Yampi Sync] Iniciando sincronização', {
    alias,
    token: maskSecret(yampiToken),
    secret: maskSecret(yampiSecret),
  })

  const statusResult = await loadYampiStatuses(alias, yampiToken, yampiSecret)
  const statuses = statusResult.statuses

  if (statusResult.details.length) {
    console.warn('[Yampi Sync] Detalhes ao buscar status', statusResult.details)
  }

  const knownStatusAliases = statuses.map((s) => s.key).filter(Boolean)
  const MAX_PAGES = 200 // até 10000 pedidos por sincronização

  if (statuses.length === 0) {
    errorDetails.push(`Não foi possível listar os status da Yampi. Detalhes: ${statusResult.details.join(' | ') || 'sem detalhes'}`)
  }

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const result = await yampiGet(alias, buildOrderQuery(page), yampiToken, yampiSecret)
      const apiMessage = result.json?.message || result.json?.error || result.text || 'Sem resposta da API'

      if (!result.res.ok) {
        errors++
        const shortMessage = String(apiMessage).slice(0, 700)
        console.error('[Yampi Sync] Erro na API', { page, http_status: result.res.status, response: shortMessage })
        errorDetails.push(`Pedidos página ${page}: HTTP ${result.res.status} - ${shortMessage}`)
        break // para em erro de autenticação
      }

      const orders = extractArray(result.json)
      if (orders.length === 0) break // sem mais pedidos

      for (const order of orders) {
        try {
          const orderStatusAlias = getOrderStatusAlias(order)

          if (knownStatusAliases.length > 0 && orderStatusAlias && !knownStatusAliases.includes(orderStatusAlias)) {
            skipped++
            continue
          }

          const imported = await importOrder(order)
          if (imported.imported) synced++
          else if (imported.skipped) skipped++
          else if (imported.error) {
            errors++
            errorDetails.push(`Pedido ${getOrderId(order) || 'sem id'}: ${imported.error}`)
          }
        } catch (e: any) {
          errors++
          errorDetails.push(`Pedido ${getOrderId(order) || 'sem id'}: ${e.message}`)
        }
      }

      if (orders.length < 50) break // última página
    } catch (e: any) {
      errors++
      const msg = e?.name === 'AbortError' ? 'Timeout ao consultar a Yampi' : e.message
      console.error('[Yampi Sync] Exceção', { page, error: msg })
      errorDetails.push(`Pedidos página ${page}: ${msg}`)
      break
    }
  }

  try {
    const level = errors > 0 && synced === 0 ? 'error' : errors > 0 ? 'warning' : 'success'
    await (supabaseAdmin as any).from('system_logs').insert({
      level,
      message: `Sincronização Yampi: ${synced} importados, ${skipped} existentes, ${errors} erros`,
      source: 'yampi-sync',
      details: {
        synced,
        skipped,
        errors,
        alias,
        statuses_used: knownStatusAliases,
        status_lookup_details: statusResult.details,
        error_details: errorDetails,
      },
    })
  } catch {}

  return NextResponse.json({
    message: 'Sincronização concluída',
    synced,
    skipped,
    errors,
    statuses_used: statuses.map((s) => ({ key: s.key, label: s.label })),
    error_details: errorDetails,
  })
}
