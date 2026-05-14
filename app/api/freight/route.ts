export const dynamic = 'force-dynamic'

// app/api/freight/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { FreightQuote, Carrier } from '@/types/database'

// CEPs express — detectar automaticamente
const EXPRESS_CEPS = ['35585-000', '37925-000']

// POST /api/freight/simulate
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { origin_cep, dest_cep, weight_kg, value_brl, length_cm, width_cm, height_cm } = body

  if (!origin_cep || !dest_cep || !weight_kg) {
    return NextResponse.json({ error: 'origin_cep, dest_cep e weight_kg são obrigatórios' }, { status: 400 })
  }

  // Calcula peso cúbico (regra geral: L×C×A / 6000)
  const cubic_weight = length_cm && width_cm && height_cm
    ? (length_cm * width_cm * height_cm) / 6000
    : 0
  const effective_weight = Math.max(weight_kg, cubic_weight)

  // Simulação de preços por transportadora
  // Em produção: substituir por chamadas reais às APIs de J&T, Loggi e Yampi
  const quotes: FreightQuote[] = simulateQuotes(
    origin_cep,
    dest_cep,
    effective_weight,
    value_brl ?? 0,
  )

  const is_express = EXPRESS_CEPS.includes(dest_cep)

  // Salva histórico
  await supabaseAdmin.from('freight_quotes').insert({
    origin_cep,
    dest_cep,
    weight_kg: effective_weight,
    value_brl,
    quotes,
  })

  return NextResponse.json({ quotes, is_express, effective_weight })
}

// ---- Simulação de cotação ----
function simulateQuotes(
  origin: string,
  dest: string,
  weight: number,
  value: number,
): FreightQuote[] {
  // Fator de distância aproximado por estado destino
  const destState = getStateFromCep(dest)
  const originState = getStateFromCep(origin)
  const isSameState = destState === originState
  const distFactor  = isSameState ? 1 : destState === 'MG' ? 1.2 : 1.8

  const base = weight * 8.5 * distFactor
  const insurance = value * 0.003  // 0.3% do valor declarado

  const carriers: Array<{ carrier: Carrier; name: string; markup: number; dMin: number; dMax: number }> = [
    { carrier: 'jt',    name: 'J&T Express', markup: 1.00, dMin: 1, dMax: 3 },
    { carrier: 'loggi', name: 'Loggi',        markup: 1.28, dMin: 1, dMax: 2 },
    { carrier: 'yampi', name: 'Yampi',         markup: 1.55, dMin: 2, dMax: 5 },
  ]

  return carriers
    .map(c => ({
      carrier:   c.carrier,
      name:      c.name,
      price_brl: parseFloat(((base + insurance) * c.markup).toFixed(2)),
      days_min:  isSameState ? Math.max(1, c.dMin - 1) : c.dMin,
      days_max:  isSameState ? Math.max(1, c.dMax - 1) : c.dMax,
    }))
    .sort((a, b) => a.price_brl - b.price_brl)
}

function getStateFromCep(cep: string): string {
  const prefix = parseInt(cep.replace(/\D/g, '').substring(0, 5))
  if (prefix >= 1000000 && prefix <= 19999999) return 'SP'
  if (prefix >= 20000000 && prefix <= 28999999) return 'RJ'
  if (prefix >= 30000000 && prefix <= 39999999) return 'MG'
  if (prefix >= 40000000 && prefix <= 48999999) return 'BA'
  if (prefix >= 49000000 && prefix <= 49999999) return 'SE'
  if (prefix >= 50000000 && prefix <= 56999999) return 'PE'
  if (prefix >= 57000000 && prefix <= 57999999) return 'AL'
  if (prefix >= 58000000 && prefix <= 58999999) return 'PB'
  if (prefix >= 59000000 && prefix <= 59999999) return 'RN'
  if (prefix >= 60000000 && prefix <= 63999999) return 'CE'
  if (prefix >= 64000000 && prefix <= 64999999) return 'PI'
  if (prefix >= 65000000 && prefix <= 65999999) return 'MA'
  if (prefix >= 66000000 && prefix <= 68899999) return 'PA'
  if (prefix >= 68900000 && prefix <= 68999999) return 'AP'
  if (prefix >= 69000000 && prefix <= 69299999) return 'AM'
  if (prefix >= 69300000 && prefix <= 69399999) return 'RR'
  if (prefix >= 69400000 && prefix <= 69899999) return 'AM'
  if (prefix >= 69900000 && prefix <= 69999999) return 'AC'
  if (prefix >= 70000000 && prefix <= 72799999) return 'DF'
  if (prefix >= 72800000 && prefix <= 72999999) return 'GO'
  if (prefix >= 73000000 && prefix <= 76799999) return 'GO'
  if (prefix >= 76800000 && prefix <= 76999999) return 'RO'
  if (prefix >= 77000000 && prefix <= 77999999) return 'TO'
  if (prefix >= 78000000 && prefix <= 78899999) return 'MT'
  if (prefix >= 78900000 && prefix <= 78999999) return 'MS' // parcial
  if (prefix >= 79000000 && prefix <= 79999999) return 'MS'
  if (prefix >= 80000000 && prefix <= 87999999) return 'PR'
  if (prefix >= 88000000 && prefix <= 89999999) return 'SC'
  if (prefix >= 90000000 && prefix <= 99999999) return 'RS'
  return 'BR'
}
