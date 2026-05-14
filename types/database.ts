// types/database.ts
export type Carrier = 'jt' | 'loggi' | 'yampi'
export type ShipmentStatus = 'pending' | 'posted' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned'
export type LabelStatus    = 'pending' | 'printing' | 'printed' | 'error'
export type ExpressStatus  = 'waiting' | 'dispatched' | 'delivered' | 'failed'
export type TicketPriority = 'low' | 'medium' | 'high'
export type TicketStatus   = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface Shipment {
  id:              string
  order_id:        string
  tracking_code:   string | null
  carrier:         Carrier
  status:          ShipmentStatus
  sender_name:     string | null
  sender_cep:      string | null
  sender_city:     string | null
  sender_state:    string | null
  recipient_name:  string
  recipient_phone: string | null
  recipient_cep:   string
  recipient_city:  string
  recipient_state: string
  recipient_addr:  string | null
  recipient_num:   string | null
  recipient_comp:  string | null
  weight_kg:       number | null
  length_cm:       number | null
  width_cm:        number | null
  height_cm:       number | null
  value_brl:       number | null
  is_express:      boolean
  created_at:      string
  updated_at:      string
  posted_at:       string | null
  delivered_at:    string | null
}

export interface Label {
  id:          string
  shipment_id: string
  carrier:     string
  status:      LabelStatus
  label_url:   string | null
  created_at:  string
}

export interface ExpressQueue {
  id:            string
  shipment_id:   string
  cep:           string
  city:          string
  status:        ExpressStatus
  dispatched_at: string | null
  created_at:    string
  shipment?:     Shipment
}

export interface ExpressCep {
  id:         string
  cep:        string
  city:       string
  state:      string
  active:     boolean
  created_at: string
}

export interface Ticket {
  id:          string
  number:      number
  shipment_id: string | null
  title:       string
  description: string | null
  priority:    TicketPriority
  status:      TicketStatus
  opened_by:   string | null
  carrier:     string | null
  created_at:  string
  updated_at:  string
  resolved_at: string | null
}

export interface Webhook {
  id:         string
  name:       string
  url:        string
  events:     string[]
  active:     boolean
  secret:     string | null
  created_at: string
}

export interface WebhookLog {
  id:          string
  webhook_id:  string
  event:       string
  payload:     Record<string, unknown>
  status_code: number | null
  response_ms: number | null
  success:     boolean
  created_at:  string
}

export interface FreightQuote {
  carrier:   Carrier
  name:      string
  price_brl: number
  days_min:  number
  days_max:  number
}

export interface Database {
  public: {
    Tables: {
      shipments:      { Row: Shipment;      Insert: Partial<Shipment>;      Update: Partial<Shipment> }
      labels:         { Row: Label;         Insert: Partial<Label>;         Update: Partial<Label> }
      express_queue:  { Row: ExpressQueue;  Insert: Partial<ExpressQueue>;  Update: Partial<ExpressQueue> }
      express_ceps:   { Row: ExpressCep;    Insert: Partial<ExpressCep>;    Update: Partial<ExpressCep> }
      tickets:        { Row: Ticket;        Insert: Partial<Ticket>;        Update: Partial<Ticket> }
      webhooks:       { Row: Webhook;       Insert: Partial<Webhook>;       Update: Partial<Webhook> }
      webhook_logs:   { Row: WebhookLog;    Insert: Partial<WebhookLog>;    Update: Partial<WebhookLog> }
    }
  }
}
