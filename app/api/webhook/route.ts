export const dynamic = 'force-dynamic'

// app/api/webhook/route.ts
// Compatibilidade: permite usar /api/webhook ou /api/yampi-webhook na Yampi.
export { GET, POST } from '../yampi-webhook/route'
