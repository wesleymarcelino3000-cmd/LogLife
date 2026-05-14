# LogLife — Shipping Management OS

Sistema de gestão de envios com integração Yampi, J&T Express e Loggi.  
Stack: **Next.js 14 · Supabase · Vercel**

---

## 1. Estrutura do projeto

```
loglife/
├── app/
│   └── api/
│       ├── shipments/route.ts   — CRUD de envios
│       ├── express/route.ts     — Fila Entregar Agora
│       ├── labels/route.ts      — Fila de etiquetas
│       ├── freight/route.ts     — Simulador de frete
│       ├── tickets/route.ts     — Suporte / tickets
│       └── webhooks/route.ts    — Webhooks
├── lib/
│   └── supabase.ts              — Clients Supabase
├── types/
│   └── database.ts              — Tipos TypeScript
├── sql/
│   └── schema.sql               — Schema completo do banco
└── .env.example                 — Template de variáveis
```

---

## 2. Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) → seu projeto
2. Vá em **SQL Editor** → **New query**
3. Cole o conteúdo de `sql/schema.sql` e execute
4. As tabelas, triggers e CEPs (Pimenta + Piumhi) serão criados automaticamente

---

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |

---

## 4. Instalar e rodar

```bash
npm install
npm run dev
```

---

## 5. Deploy no Vercel

```bash
npx vercel
```

Adicione as variáveis de ambiente em:  
**Vercel → Seu projeto → Settings → Environment Variables**

---

## 6. API Reference

### Envios
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/shipments` | Listar envios |
| GET | `/api/shipments?status=in_transit` | Filtrar por status |
| GET | `/api/shipments?express=1` | Somente envios express |
| POST | `/api/shipments` | Criar envio |

### Fila Entregar Agora
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/express` | Listar fila (Pimenta + Piumhi) |
| GET | `/api/express?cep=35585-000` | Filtrar por CEP |
| POST | `/api/express` | Despachar toda a fila |
| POST | `/api/express` body `{cep:"35585-000"}` | Despachar por CEP |

### Simulador de Frete
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/freight` | Simular cotação |

```json
{
  "origin_cep": "01310-100",
  "dest_cep": "35585-000",
  "weight_kg": 1.5,
  "value_brl": 250.00,
  "length_cm": 30,
  "width_cm": 20,
  "height_cm": 15
}
```

### Etiquetas
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/labels?status=pending` | Fila de etiquetas |
| POST | `/api/labels` | Gerar etiqueta |

### Tickets
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/tickets` | Listar tickets |
| POST | `/api/tickets` | Criar ticket |

### Webhooks
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/webhooks` | Listar webhooks |
| POST | `/api/webhooks` | Cadastrar webhook |

**Eventos disponíveis:**
- `shipment.created`
- `shipment.delivered`
- `shipment.failed`
- `shipment.returned`
- `express.queue_entry` — pedido entrou na fila Pimenta/Piumhi
- `express.dispatched`  — lote despachado
- `label.created`

---

## 7. Lógica Entregar Agora

Quando um shipment é criado com `recipient_cep` igual a `35585-000` (Pimenta) ou `37925-000` (Piumhi):

1. O trigger `trg_check_express_cep` detecta automaticamente
2. Marca `is_express = true` no shipment
3. Insere na tabela `express_queue`
4. A API dispara o webhook `express.queue_entry`

Para adicionar novos CEPs prioritários:
```sql
insert into express_ceps (cep, city, state)
values ('00000-000', 'Cidade', 'MG');
```
