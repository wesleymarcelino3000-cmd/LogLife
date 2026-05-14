'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = 'force-dynamic'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EXPRESS_CEPS: Record<string, string> = {
  '35585': 'Pimenta, MG',
  '37925': 'Piumhi, MG',
}

type Page = 'dashboard'|'express'|'labels'|'create-label'|'shipments'|'simulator'|'tickets'|'configs'|'api'|'webhook'|'errors'

const pages: Record<Page, string> = {
  dashboard:    'Dashboard',
  express:      'Entregar Agora',
  labels:       'Fila de Etiquetas',
  'create-label': 'Criar Etiqueta',
  shipments:    'Envios',
  simulator:    'Simulador de Frete',
  tickets:      'Tickets',
  configs:      'Configurações',
  api:          'API',
  webhook:      'Webhooks',
  errors:       'Central de Erros',
}

export default function Home() {
  const [page, setPage]   = useState<Page>('dashboard')
  const [configTab, setConfigTab] = useState(0)

  // Toggles configurações
  const [autoLabel,      setAutoLabel]      = useState(true)
  const [emailNotif,     setEmailNotif]     = useState(true)
  const [autoTrack,      setAutoTrack]      = useState(false)
  const [sandbox,        setSandbox]        = useState(false)
  const [customLabel,    setCustomLabel]    = useState(false)
  const [nfe,            setNfe]            = useState(false)
  const [nfeAuto,        setNfeAuto]        = useState(false)
  const [nfeSerie,       setNfeSerie]       = useState('1')
  const [nfeAmbiente,    setNfeAmbiente]    = useState<'homologacao'|'producao'>('homologacao')

  // Simulador
  const [destCep,        setDestCep]        = useState('')
  const [expressCepCity, setExpressCepCity] = useState('')
  const [simDone,        setSimDone]        = useState(false)

  // Criar etiqueta
  const [labelForm, setLabelForm] = useState({
    carrier: 'jt', order_id: '', recipient_name: '', recipient_phone: '',
    recipient_cep: '', recipient_city: '', recipient_state: 'MG',
    recipient_addr: '', recipient_num: '', recipient_comp: '',
    weight: '', length: '', width: '', height: '', value: '',
    obs: '',
  })
  const [labelCreated, setLabelCreated] = useState(false)
  const [labelCepCity, setLabelCepCity] = useState('')

  // Auth
  const [user, setUser]               = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUser, setNewUser]         = useState({username:'',name:'',password:'',role:'operator'})
  const [userSaving, setUserSaving]   = useState(false)
  const [userToast, setUserToast]     = useState('')

  useEffect(()=>{
    if(typeof window === 'undefined') return
    fetch('/api/auth/me')
      .then(r=>r.json())
      .then(j=>{
        if(!j.user){ window.location.href='/login'; return }
        setUser(j.user)
        setAuthChecked(true)
      })
      .catch(()=>{ window.location.href='/login' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  async function handleLogout(){
    await fetch('/api/auth/logout',{method:'POST'})
    window.location.href='/login'
  }

  async function createUser(){
    if(!newUser.username||!newUser.password||!newUser.name){setUserToast('❌ Usuário, nome e senha obrigatórios');return}
    setUserSaving(true)
    try{
      const r = await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newUser)})
      const j = await r.json()
      if(j.user){setShowCreateUser(false);setNewUser({username:'',name:'',password:'',role:'operator'});setUserToast('✅ Usuário criado!')}
      else setUserToast('❌ '+(j.error||'Erro ao criar'))
    }catch{setUserToast('❌ Erro de conexão')}
    setUserSaving(false)
    setTimeout(()=>setUserToast(''),4000)
  }

  // APIs state — gerenciado no Home para evitar hidratação
  const [apis, setApis]       = useState<any[]>([])
  const [apisLoaded, setApisLoaded] = useState(false)

  useEffect(()=>{
    // Só roda no cliente
    if(typeof window === 'undefined') return
    if(apisLoaded) return
    fetch('/api/integrations')
      .then(r=>r.json())
      .then(d=>{if(Array.isArray(d.data))setApis(d.data)})
      .catch(e=>console.error('Erro ao carregar APIs:',e))
      .finally(()=>setApisLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // API key
  const [keyVisible, setKeyVisible] = useState(false)
  const apiKey = 'll_prod_sk_••••••••••••••••••••••••••••••••'

  // Yampi sync
  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState<{synced:number;skipped:number;errors:number}|null>(null)
  const [syncToast, setSyncToast]   = useState('')
  const [syncProgress, setSyncProgress] = useState<{page:number;synced:number;skipped:number;errors:number;totalProcessed:number;message:string}|null>(null)

  // Teste de webhook (pedido simulado)
  async function testWebhook(cep?: string) {
    const testData = {
      name: 'Cliente Teste LogLife',
      cep: cep || '35585-000',
      city: cep === '37925-000' ? 'Piumhi' : cep ? 'São Paulo' : 'Pimenta',
      state: 'MG',
      address: 'Rua de Teste',
      number: '123',
      value: '150.00',
      weight: '0.5',
      carrier: 'jt',
    }
    try {
      const r = await fetch('/api/yampi-webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      })
      const j = await r.json()
      if (j.success) setSyncToast(j.message)
      else setSyncToast('❌ ' + (j.error || 'Erro no teste'))
    } catch { setSyncToast('❌ Erro de conexão') }
    setTimeout(() => setSyncToast(''), 5000)
  }

  async function runYampiSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncProgress(null)
    try {
      const apisRes = await fetch('/api/integrations')
      const apisData = await apisRes.json()
      const yampi = (apisData.data || []).find((a: {name:string}) => a.name.toLowerCase().includes('yampi'))
      if (!yampi || !yampi.api_key) {
        setSyncToast('❌ Configure o token da Yampi em API → Minhas APIs primeiro')
        setSyncing(false)
        setTimeout(() => setSyncToast(''), 4000)
        return
      }

      const r = await fetch('/api/yampi-sync-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yampi_token: yampi.api_key, secret: yampi.secret || '', alias: yampi.url, url: yampi.url }),
      })

      const reader = r.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Sem stream')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'progress') {
              setSyncProgress({ page: data.page, synced: data.synced, skipped: data.skipped, errors: data.errors, totalProcessed: data.totalProcessed || 0, message: data.message })
            } else if (data.type === 'done') {
              setSyncResult({ synced: data.synced, skipped: data.skipped, errors: data.errors })
              setSyncProgress(null)
              setSyncToast(`✅ Sincronizado! ${data.synced} novos pedidos importados`)
              loadShipments()
            } else if (data.type === 'error') {
              setSyncToast(`❌ ${data.message}`)
            }
          } catch {}
        }
      }
    } catch {
      setSyncToast('❌ Erro ao sincronizar com Yampi')
    }
    setSyncing(false)
    setSyncProgress(null)
    setTimeout(() => setSyncToast(''), 5000)
  }

  function nav(p: Page) {
    setPage(p)
    setLabelCreated(false)
    setSimDone(false)
  }

  function handleDestCep(v: string) {
    setDestCep(v)
    const d = v.replace(/\D/g,'').substring(0,5)
    setExpressCepCity(EXPRESS_CEPS[d] ?? '')
  }

  function handleLabelCep(v: string) {
    setLabelForm(f => ({...f, recipient_cep: v}))
    const d = v.replace(/\D/g,'').substring(0,5)
    const city = EXPRESS_CEPS[d]
    setLabelCepCity(city ?? '')
    if (city) setLabelForm(f => ({...f, recipient_city: city.split(',')[0], recipient_state: 'MG'}))
  }

  function submitLabel(e: React.FormEvent) {
    e.preventDefault()
    setLabelCreated(true)
  }

  const Toggle = ({on, set}: {on: boolean; set: (v: boolean)=>void}) => (
    <div className={`tog${on?' on':''}`} onClick={()=>set(!on)}></div>
  )

  // Auth guard - AFTER all useState hooks
  if(!authChecked) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0a0b0f',color:'#9499b3',fontSize:14,fontFamily:'system-ui'}}>
      ⏳ Carregando...
    </div>
  )

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box;}
        :root{
          --bg:#0a0b0f;--bg2:#0f1117;--bg3:#14161e;--surface:#1a1d27;--surface2:#1f2230;
          --border:#2a2d3e;--border2:#333649;--text:#f0f1f5;--text2:#9499b3;--text3:#5c6080;
          --accent:#6366f1;--ag:rgba(99,102,241,0.15);
          --green:#22c55e;--amber:#f59e0b;--red:#ef4444;--blue:#3b82f6;--purple:#a855f7;
          --express:#ff4d00;--eg:rgba(255,77,0,0.12);
        }
        body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex;min-height:100vh;font-size:14px;}
        .sidebar{width:220px;min-width:220px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;overflow-y:auto;}
        .logo{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
        .logo-icon{width:34px;height:34px;background:var(--accent);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;}
        .logo-text{font-size:17px;font-weight:700;}
        .logo-sub{font-size:9px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;}
        .nav{padding:12px 10px;flex:1;display:flex;flex-direction:column;gap:2px;}
        .nav-sec{font-size:9px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;padding:10px 10px 6px;}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;cursor:pointer;color:var(--text2);font-size:13px;font-weight:500;transition:all .15s;border:1px solid transparent;}
        .nav-item:hover{background:var(--surface);color:var(--text);}
        .nav-item.active{background:var(--ag);color:#818cf8;border-color:rgba(99,102,241,0.25);}
        .nav-item.active .ni{color:var(--accent);}
        .nav-item.enav.active{background:var(--eg);color:#ff6b35;border-color:rgba(255,77,0,0.3);}
        .nav-item.enav.active .ni{color:var(--express);}
        .nav-item.enav:hover{background:var(--eg);color:#ff6b35;}
        .ni{font-size:16px;width:20px;text-align:center;}
        .epulse{width:8px;height:8px;border-radius:50%;background:var(--express);animation:ep 1.5s ease-out infinite;}
        @keyframes ep{0%{box-shadow:0 0 0 0 rgba(255,77,0,0.6);}100%{box-shadow:0 0 0 8px rgba(255,77,0,0);}}
        .nbadge{color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
        .sf{padding:14px;border-top:1px solid var(--border);}
        .uc{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;}
        .uc:hover{background:var(--surface);}
        .av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;}
        .main{margin-left:220px;flex:1;display:flex;flex-direction:column;min-height:100vh;}
        .topbar{background:var(--bg2);border-bottom:1px solid var(--border);padding:0 24px;height:56px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:5;}
        .ptitle{font-size:16px;font-weight:700;flex:1;}
        .tactions{display:flex;align-items:center;gap:10px;}
        .search{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 12px;width:200px;}
        .search input{background:none;border:none;outline:none;color:var(--text);font-size:13px;width:100%;}
        .search input::placeholder{color:var(--text3);}
        .btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;transition:all .15s;}
        .btn-primary{background:var(--accent);color:#fff;}
        .btn-primary:hover{background:#5254d4;}
        .btn-ghost{background:var(--surface);color:var(--text2);border:1px solid var(--border);}
        .btn-ghost:hover{background:var(--surface2);color:var(--text);}
        .btn-express{background:var(--express);color:#fff;}
        .btn-success{background:var(--green);color:#fff;}
        .iBtn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;color:var(--text2);font-size:16px;}
        .content{padding:24px;flex:1;}
        .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;}
        .card+.card{margin-top:14px;}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .g3{display:grid;grid-template-columns:2fr 1fr;gap:14px;}
        .ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
        .ct{font-size:13px;font-weight:700;}
        .cs{font-size:11px;color:var(--text3);}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;}
        .stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;position:relative;overflow:hidden;}
        .stat.ex-stat{border-color:rgba(255,77,0,0.25);cursor:pointer;}
        .slabel{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
        .sval{font-size:26px;font-weight:700;margin-bottom:4px;}
        .sico{position:absolute;top:16px;right:16px;font-size:22px;opacity:.3;}
        .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--text3);gap:12px;text-align:center;}
        .empty-icon{font-size:48px;opacity:.4;}
        .empty-title{font-size:15px;font-weight:600;color:var(--text2);}
        .empty-sub{font-size:13px;}
        .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600;}
        .bs{background:rgba(34,197,94,.1);color:var(--green);}
        .bw{background:rgba(245,158,11,.1);color:var(--amber);}
        .bd{background:rgba(239,68,68,.1);color:var(--red);}
        .bi{background:rgba(59,130,246,.1);color:var(--blue);}
        .be{background:rgba(255,77,0,.12);color:var(--express);border:1px solid rgba(255,77,0,.3);}
        .tw{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;}
        th{text-align:left;font-size:10px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;padding:8px 12px;border-bottom:1px solid var(--border);}
        td{padding:10px 12px;font-size:13px;border-bottom:1px solid var(--border);color:var(--text2);}
        tr:last-child td{border-bottom:none;}
        tr:hover td{background:var(--surface2);}
        td strong{color:var(--text);}
        .mono{font-family:monospace;font-size:11px;color:#818cf8;}
        .fg{margin-bottom:14px;}
        .fl{font-size:11px;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;display:block;}
        .fi{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;outline:none;transition:border-color .15s;font-family:inherit;}
        .fi:focus{border-color:var(--accent);}
        .fi.express-cep{border-color:rgba(255,77,0,.5);}
        .fsel{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;outline:none;appearance:none;font-family:inherit;}
        .fr{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .fr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
        .fr4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;}
        .ralert{background:var(--eg);border:1px solid rgba(255,77,0,.3);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--express);margin-bottom:12px;display:flex;align-items:center;gap:6px;}
        .nalert{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--green);margin-bottom:12px;display:flex;align-items:center;gap:6px;}
        .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
        .rcard{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .15s;margin-bottom:10px;}
        .rcard.best{border-color:var(--green);background:rgba(34,197,94,.05);}
        .rcl{width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;}
        .btag{font-size:9px;font-weight:700;background:var(--green);color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;}
        .ehero{background:linear-gradient(135deg,var(--eg),rgba(255,77,0,.03));border:1px solid rgba(255,77,0,.3);border-radius:16px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;gap:20px;}
        .eicon{width:56px;height:56px;border-radius:14px;background:var(--express);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;}
        .ceptag{background:rgba(255,77,0,.15);border:1px solid rgba(255,77,0,.35);border-radius:8px;padding:6px 12px;font-family:monospace;font-size:11px;font-weight:700;color:var(--express);}
        .ceptag small{display:block;font-size:9px;font-weight:400;opacity:.7;font-family:inherit;}
        .ceptag.purple{color:var(--purple);background:rgba(168,85,247,.15);border-color:rgba(168,85,247,.35);}
        .estats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
        .estat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;}
        .estat.hl{border-color:rgba(255,77,0,.3);background:rgba(255,77,0,.05);}
        .cpills{display:flex;gap:6px;flex-wrap:wrap;}
        .cpill{padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;font-family:monospace;cursor:pointer;border:1px solid;transition:all .15s;}
        .ctabs{display:flex;gap:4px;background:var(--bg3);border-radius:10px;padding:4px;margin-bottom:20px;flex-wrap:wrap;}
        .ctab{padding:7px 14px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text3);transition:all .15s;white-space:nowrap;}
        .ctab.active{background:var(--surface);color:var(--text);}
        .crow{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);}
        .crow:last-child{border-bottom:none;}
        .crow-label{font-size:13px;font-weight:500;}
        .crow-sub{font-size:11px;color:var(--text3);margin-top:2px;}
        .tog{width:40px;height:22px;background:var(--border2);border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0;}
        .tog.on{background:var(--accent);}
        .tog::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s;}
        .tog.on::after{transform:translateX(18px);}
        .section-title{font-size:12px;font-weight:700;color:var(--text);margin:20px 0 12px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border);padding-bottom:8px;}
        .nfe-box{background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.25);border-radius:10px;padding:16px;margin-top:12px;}
        .nfe-box.active-nfe{background:rgba(34,197,94,.06);border-color:rgba(34,197,94,.25);}
        .aep{background:var(--bg3);border:1px solid var(--border);border-radius:10px;margin-bottom:10px;}
        .aeph{display:flex;align-items:center;gap:10px;padding:12px 14px;}
        .mth{font-size:10px;font-weight:700;font-family:monospace;padding:3px 7px;border-radius:4px;min-width:44px;text-align:center;}
        .get{background:rgba(34,197,94,.15);color:var(--green);}
        .post{background:rgba(59,130,246,.1);color:var(--blue);}
        .apath{font-family:monospace;font-size:12px;color:#818cf8;}
        .adesc{font-size:11px;color:var(--text3);margin-left:auto;}
        .akcard{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px;}
        .akd{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:8px 12px;margin-top:8px;}
        .akv{font-family:monospace;font-size:12px;color:#818cf8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .wcard{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;}
        .wurl{font-family:monospace;font-size:11px;color:#818cf8;margin:6px 0 10px;}
        .wetag{background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:3px 8px;font-size:10px;font-family:monospace;color:var(--text3);}
        .tlist{display:flex;flex-direction:column;gap:10px;}
        .titem{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all .15s;}
        .titem:hover{border-color:var(--border2);}
        .tpri{width:4px;border-radius:2px;align-self:stretch;flex-shrink:0;}
        .label-preview{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:20px;font-family:monospace;}
        .divider{border:none;border-top:1px dashed var(--border2);margin:12px 0;}
        @media(max-width:768px){
          .sidebar{display:none;}
          .main{margin-left:0;}
          .stats-grid,.estats{grid-template-columns:1fr 1fr;}
          .g2,.g3,.sgrid,.fr,.fr3,.fr4{grid-template-columns:1fr;}
        }
      `}</style>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <img src="/logo.png" alt="LogLife" style={{width:150,height:'auto',objectFit:'contain',filter:'brightness(1.1)'}}/>
        </div>
        <nav className="nav">
          <div className="nav-sec">Principal</div>
          <div className={`nav-item${page==='dashboard'?' active':''}`} onClick={()=>nav('dashboard')}><span className="ni">📊</span>Dashboard</div>
          <div className={`nav-item enav${page==='express'?' active':''}`} onClick={()=>nav('express')}><span className="ni">⚡</span>Entregar Agora<span className="epulse" style={{marginLeft:'auto'}}></span></div>
          <div className={`nav-item${page==='labels'||page==='create-label'?' active':''}`} onClick={()=>nav('labels')}><span className="ni">🏷️</span>Fila de Etiquetas</div>
          <div className={`nav-item${page==='shipments'?' active':''}`} onClick={()=>nav('shipments')}><span className="ni">📦</span>Envios</div>
          <div className={`nav-item${page==='simulator'?' active':''}`} onClick={()=>nav('simulator')}><span className="ni">🧮</span>Simulador de Frete</div>
          <div className={`nav-item${page==='tickets'?' active':''}`} onClick={()=>nav('tickets')}><span className="ni">🎫</span>Tickets</div>
          <div className="nav-sec">Sistema</div>
          <div className={`nav-item${page==='configs'?' active':''}`} onClick={()=>nav('configs')}><span className="ni">⚙️</span>Configurações</div>
          <div className={`nav-item${page==='api'?' active':''}`} onClick={()=>nav('api')}><span className="ni">💻</span>API</div>
          <div className={`nav-item${page==='webhook'?' active':''}`} onClick={()=>nav('webhook')}><span className="ni">🔗</span>Webhooks</div>
          <div className={`nav-item${page==='errors'?' active':''}`} onClick={()=>nav('errors')} style={{borderColor:page==='errors'?'rgba(239,68,68,.3)':undefined,background:page==='errors'?'rgba(239,68,68,.08)':undefined,color:page==='errors'?'var(--red)':undefined}}><span className="ni">⚠️</span>Erros <span className="nbadge" style={{background:'var(--red)'}} id="err-badge"></span></div>
        </nav>
        <div className="sf">
          <div style={{marginBottom:8}}>
            <div onClick={()=>setShowCreateUser(true)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,cursor:'pointer',fontSize:13,color:'var(--accent2)',background:'var(--ag)',border:'1px solid rgba(99,102,241,.25)',marginBottom:6}}>
              <span>👤</span> Criar usuário
            </div>
          </div>
          <div className="uc" onClick={handleLogout} title="Sair">
            <div className="av">{(user?.name||user?.username||'?').substring(0,2).toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.name||user?.username||'Usuário'}</div><div style={{fontSize:10,color:'var(--text3)'}}>{user?.role==='admin'?'Administrador':user?.role==='operator'?'Operador':'Visualizador'}</div></div>
            <span style={{fontSize:16,color:'var(--text3)'}} title="Sair">↩</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="ptitle">{pages[page]}</div>
          <div className="tactions">
            <div className="search"><span>🔍</span><input placeholder="Buscar envios, rastrear..."/></div>
            <div className="iBtn">🔔</div>
            <button className="btn btn-primary" onClick={()=>nav('create-label')}>+ Nova Etiqueta</button>
          </div>
        </div>

        <div className="content">

          {/* ===== DASHBOARD ===== */}
          {page==='dashboard' && <>
            <div className="stats-grid">
              <div className="stat"><div className="sico">📦</div><div className="slabel">Envios hoje</div><div className="sval" style={{color:'var(--blue)'}}>—</div><div className="cs" style={{color:'var(--text3)'}}>Aguardando dados</div></div>
              <div className="stat"><div className="sico">✅</div><div className="slabel">Entregues</div><div className="sval" style={{color:'var(--green)'}}>—</div><div className="cs" style={{color:'var(--text3)'}}>Aguardando dados</div></div>
              <div className="stat"><div className="sico">🕐</div><div className="slabel">Em trânsito</div><div className="sval" style={{color:'var(--amber)'}}>—</div><div className="cs" style={{color:'var(--text3)'}}>Aguardando dados</div></div>
              <div className="stat ex-stat" onClick={()=>nav('express')}><div className="sico">⚡</div><div className="slabel" style={{color:'rgba(255,77,0,.7)'}}>Entregar agora</div><div className="sval" style={{color:'var(--express)'}}>—</div><div className="cs" style={{color:'var(--express)'}}>Pimenta & Piumhi</div></div>
            </div>
            <div className="g2" style={{marginBottom:14}}>
              <div className="card">
                <div className="ch"><div className="ct">Envios recentes</div><span className="badge bi">Ao vivo</span></div>
                <div className="empty"><div className="empty-icon">📭</div><div className="empty-title">Nenhum envio ainda</div><div className="empty-sub">Crie sua primeira etiqueta para começar</div><button className="btn btn-primary" onClick={()=>nav('create-label')}>+ Criar etiqueta</button></div>
              </div>
              <div className="card">
                <div className="ch"><div className="ct">Transportadoras</div></div>
                <div className="empty"><div className="empty-icon">🚚</div><div className="empty-title">Sem dados ainda</div></div>
              </div>
            </div>
            <div className="card">
              <div className="ch"><div className="ct">Atividade recente</div></div>
              <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">Nenhuma atividade</div><div className="empty-sub">As ações do sistema aparecerão aqui</div></div>
            </div>
          </>}

          {/* ===== ENTREGAR AGORA ===== */}
          {page==='express' && <>
            {syncToast && <div style={{position:'fixed',top:16,right:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 18px',fontSize:13,zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',maxWidth:340}}>{syncToast}</div>}

            <div className="ehero">
              <div className="eicon">⚡</div>
              <div style={{flex:1}}>
                <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>Entregar Agora <span style={{fontSize:14,fontWeight:400,color:'var(--text3)',marginLeft:8}}>Fila prioritária</span></h2>
                <p style={{fontSize:13,color:'var(--text2)'}}>Pedidos com CEPs de Pimenta e Piumhi são capturados automaticamente.</p>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <div className="ceptag">35585-000<small>Pimenta, MG</small></div>
                <div className="ceptag purple">37925-000<small>Piumhi, MG</small></div>
                <button className="btn btn-ghost" style={{fontSize:12,borderColor:'rgba(99,102,241,.4)',color:'#818cf8',opacity:syncing?.6:1}} onClick={runYampiSync} disabled={syncing}>
                  {syncing ? '🔄 Sincronizando...' : '🔄 Sincronizar Yampi'}
                </button>
              </div>
            </div>

            {syncResult && (
              <div style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.25)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:13,fontWeight:600,color:'var(--green)'}}>✅ Última sincronização Yampi</span>
                <span style={{fontSize:12,color:'var(--text2)'}}>📦 <strong>{syncResult.synced}</strong> novos importados</span>
                <span style={{fontSize:12,color:'var(--text2)'}}>⏭ <strong>{syncResult.skipped}</strong> já existiam</span>
                {syncResult.errors>0 && <span style={{fontSize:12,color:'var(--red)'}}>❌ <strong>{syncResult.errors}</strong> erros</span>}
                <div style={{marginLeft:'auto',fontSize:11,color:'var(--text3)'}}>
                  Status sincronizados: Pedido autorizado · Pagamento aprovado · Em separação · Faturado · Pronto para envio
                </div>
              </div>
            )}

            {syncProgress && (
              <div style={{background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.25)',borderRadius:10,padding:'14px 16px',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:'#818cf8'}}>🔄 Sincronizando...</span>
                  <span style={{fontSize:12,color:'var(--text3)'}}>{syncProgress.message}</span>
                </div>
                {/* Barra de progresso animada */}
                <div style={{background:'var(--surface2)',borderRadius:99,height:8,overflow:'hidden',marginBottom:10}}>
                  <div style={{
                    height:'100%',
                    borderRadius:99,
                    background:'linear-gradient(90deg,#6366f1,#818cf8)',
                    width:`${Math.min(100, (syncProgress.page / 200) * 100)}%`,
                    transition:'width 0.4s ease',
                    boxShadow:'0 0 8px rgba(99,102,241,0.6)',
                    animation:'shimmer 1.5s infinite',
                  }}/>
                </div>
                <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'var(--green)'}}>📦 <strong>{syncProgress.synced}</strong> novos</span>
                  <span style={{fontSize:12,color:'var(--text3)'}}>⏭ <strong>{syncProgress.skipped}</strong> já existiam</span>
                  {syncProgress.errors>0 && <span style={{fontSize:12,color:'var(--red)'}}>❌ <strong>{syncProgress.errors}</strong> erros</span>}
                  <span style={{fontSize:12,color:'var(--text3)',marginLeft:'auto'}}>Página {syncProgress.page} · {syncProgress.totalProcessed} processados</span>
                </div>
              </div>
            )}

            <div className="estats">
              <div className="estat hl"><div className="slabel">Na fila agora</div><div className="sval" style={{color:'var(--express)'}}>0</div><div className="cs">aguardando despacho</div></div>
              <div className="estat"><div className="slabel">Pimenta — 35585-000</div><div className="sval" style={{color:'var(--express)'}}>0</div><div className="cs">pedidos</div></div>
              <div className="estat"><div className="slabel">Piumhi — 37925-000</div><div className="sval" style={{color:'var(--purple)'}}>0</div><div className="cs">pedidos</div></div>
              <div className="estat"><div className="slabel">Sincronizados</div><div className="sval" style={{color:'var(--green)'}}>{syncResult?.synced||0}</div><div className="cs">via Yampi hoje</div></div>
            </div>

            <div className="card">
              <div className="ch">
                <div className="ct">⚡ Pedidos prioritários</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn btn-ghost" style={{fontSize:12,opacity:syncing?.6:1}} onClick={runYampiSync} disabled={syncing}>
                    {syncing?'🔄 Sincronizando...':'🔄 Sincronizar Yampi'}
                  </button>
                  <button className="btn btn-express" style={{fontSize:12}}>⚡ Despachar Todos</button>
                </div>
              </div>
              <div style={{background:'var(--bg3)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'var(--text3)',display:'flex',gap:8,flexWrap:'wrap'}}>
                <span>Sincroniza pedidos com status:</span>
                {['Pedido autorizado','Pagamento aprovado','Produtos em separação','Faturado','Pronto para envio'].map(s=>(
                  <span key={s} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 8px',color:'var(--text2)'}}>{s}</span>
                ))}
              </div>
              <div className="empty"><div className="empty-icon">⚡</div><div className="empty-title">Fila vazia</div><div className="empty-sub">Clique em "Sincronizar Yampi" para importar pedidos, ou crie etiquetas com CEP 35585-000 ou 37925-000</div><button className="btn btn-ghost" style={{opacity:syncing?.6:1}} onClick={runYampiSync} disabled={syncing}>{syncing?'🔄 Sincronizando...':'🔄 Sincronizar Yampi'}</button></div>
            </div>
          </>}

          {/* ===== FILA DE ETIQUETAS ===== */}
          {page==='labels' && <LabelsPage syncing={syncing} syncResult={syncResult} runYampiSync={runYampiSync} navCreate={()=>nav('create-label')} syncToast={syncToast} testWebhook={testWebhook}/>}

          {/* ===== CRIAR ETIQUETA ===== */}
          {page==='create-label' && <>
            {labelCreated ? (
              <div>
                <div className="nalert" style={{fontSize:14,padding:16,marginBottom:20}}>✅ Etiqueta criada com sucesso! Código de rastreio gerado.</div>
                <div className="card">
                  <div className="ch"><div className="ct">📋 Prévia da Etiqueta</div><button className="btn btn-primary">🖨 Imprimir</button></div>
                  <div className="label-preview">
                    <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>LOGLIFE SHIPPING</div>
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:12}}>Etiqueta gerada em {new Date().toLocaleString('pt-BR')}</div>
                    <hr className="divider"/>
                    <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>DESTINATÁRIO</div>
                    <div style={{fontSize:15,fontWeight:700}}>{labelForm.recipient_name}</div>
                    <div style={{fontSize:12}}>{labelForm.recipient_addr}{labelForm.recipient_num?`, ${labelForm.recipient_num}`:''}{labelForm.recipient_comp?` - ${labelForm.recipient_comp}`:''}</div>
                    <div style={{fontSize:12}}>{labelForm.recipient_city} — {labelForm.recipient_state}</div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginTop:4}}>CEP: {labelForm.recipient_cep}</div>
                    <hr className="divider"/>
                    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                      <div><div style={{fontSize:11,color:'var(--text3)'}}>TRANSPORTADORA</div><div style={{fontWeight:700}}>{labelForm.carrier==='jt'?'J&T Express':labelForm.carrier==='loggi'?'Loggi':'Yampi'}</div></div>
                      <div><div style={{fontSize:11,color:'var(--text3)'}}>PESO</div><div style={{fontWeight:700}}>{labelForm.weight}kg</div></div>
                      <div><div style={{fontSize:11,color:'var(--text3)'}}>VALOR</div><div style={{fontWeight:700}}>R${labelForm.value}</div></div>
                      {labelCepCity && <div><div style={{fontSize:11,color:'var(--text3)'}}>PRIORIDADE</div><div style={{fontWeight:700,color:'var(--express)'}}>⚡ EXPRESS</div></div>}
                    </div>
                    <hr className="divider"/>
                    <div style={{fontSize:11,color:'var(--text3)'}}>RASTREIO</div>
                    <div style={{fontSize:16,fontWeight:700,letterSpacing:2,color:'var(--accent)'}}>LL{Date.now().toString().slice(-10).toUpperCase()}</div>
                    {nfe && <div style={{marginTop:8,fontSize:11,color:'var(--blue)'}}>NF-e: será emitida automaticamente</div>}
                  </div>
                  <div style={{display:'flex',gap:10,marginTop:16}}>
                    <button className="btn btn-ghost" onClick={()=>{setLabelCreated(false);setLabelForm(f=>({...f,order_id:'',recipient_name:'',recipient_phone:'',recipient_cep:'',recipient_city:'',recipient_addr:'',recipient_num:'',recipient_comp:'',weight:'',length:'',width:'',height:'',value:'',obs:''}));setLabelCepCity('')}}>+ Nova etiqueta</button>
                    <button className="btn btn-primary" onClick={()=>nav('labels')}>Ver fila de etiquetas</button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={submitLabel}>
                <div className="g2" style={{marginBottom:14}}>
                  <div>
                    <div className="card" style={{marginBottom:14}}>
                      <div className="ct" style={{marginBottom:16}}>🚚 Transportadora</div>
                      <div className="fg">
                        <label className="fl">Selecionar transportadora</label>
                        <select className="fsel" value={labelForm.carrier} onChange={e=>setLabelForm(f=>({...f,carrier:e.target.value}))}>
                          <option value="jt">J&T Express</option>
                          <option value="loggi">Loggi</option>
                          <option value="yampi">Yampi</option>
                        </select>
                      </div>
                      <div className="fg">
                        <label className="fl">Número do pedido</label>
                        <input className="fi" placeholder="Ex: #98301" value={labelForm.order_id} onChange={e=>setLabelForm(f=>({...f,order_id:e.target.value}))}/>
                      </div>
                    </div>

                    <div className="card" style={{marginBottom:14}}>
                      <div className="ct" style={{marginBottom:16}}>👤 Destinatário</div>
                      <div className="fg">
                        <label className="fl">Nome completo *</label>
                        <input className="fi" placeholder="Nome do destinatário" required value={labelForm.recipient_name} onChange={e=>setLabelForm(f=>({...f,recipient_name:e.target.value}))}/>
                      </div>
                      <div className="fg">
                        <label className="fl">Telefone</label>
                        <input className="fi" placeholder="(00) 00000-0000" value={labelForm.recipient_phone} onChange={e=>setLabelForm(f=>({...f,recipient_phone:e.target.value}))}/>
                      </div>
                      <div className="fg">
                        <label className="fl">CEP *</label>
                        <input className={`fi${labelCepCity?' express-cep':''}`} placeholder="00000-000" required value={labelForm.recipient_cep} onChange={e=>handleLabelCep(e.target.value)}/>
                        {labelCepCity && <div className="ralert" style={{marginTop:8,marginBottom:0}}>⚡ {labelCepCity} — será adicionado à fila Entregar Agora!</div>}
                      </div>
                      <div className="fr">
                        <div className="fg">
                          <label className="fl">Cidade *</label>
                          <input className="fi" placeholder="Cidade" required value={labelForm.recipient_city} onChange={e=>setLabelForm(f=>({...f,recipient_city:e.target.value}))}/>
                        </div>
                        <div className="fg">
                          <label className="fl">Estado</label>
                          <select className="fsel" value={labelForm.recipient_state} onChange={e=>setLabelForm(f=>({...f,recipient_state:e.target.value}))}>
                            {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="fg">
                        <label className="fl">Endereço</label>
                        <input className="fi" placeholder="Rua, Avenida..." value={labelForm.recipient_addr} onChange={e=>setLabelForm(f=>({...f,recipient_addr:e.target.value}))}/>
                      </div>
                      <div className="fr">
                        <div className="fg">
                          <label className="fl">Número</label>
                          <input className="fi" placeholder="123" value={labelForm.recipient_num} onChange={e=>setLabelForm(f=>({...f,recipient_num:e.target.value}))}/>
                        </div>
                        <div className="fg">
                          <label className="fl">Complemento</label>
                          <input className="fi" placeholder="Apto, Sala..." value={labelForm.recipient_comp} onChange={e=>setLabelForm(f=>({...f,recipient_comp:e.target.value}))}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="card" style={{marginBottom:14}}>
                      <div className="ct" style={{marginBottom:16}}>📦 Dados do pacote</div>
                      <div className="fr">
                        <div className="fg">
                          <label className="fl">Peso (kg) *</label>
                          <input className="fi" type="number" step="0.1" placeholder="1.5" required value={labelForm.weight} onChange={e=>setLabelForm(f=>({...f,weight:e.target.value}))}/>
                        </div>
                        <div className="fg">
                          <label className="fl">Valor declarado (R$)</label>
                          <input className="fi" type="number" step="0.01" placeholder="250.00" value={labelForm.value} onChange={e=>setLabelForm(f=>({...f,value:e.target.value}))}/>
                        </div>
                      </div>
                      <div className="fr3">
                        <div className="fg">
                          <label className="fl">Comp. (cm)</label>
                          <input className="fi" type="number" placeholder="30" value={labelForm.length} onChange={e=>setLabelForm(f=>({...f,length:e.target.value}))}/>
                        </div>
                        <div className="fg">
                          <label className="fl">Larg. (cm)</label>
                          <input className="fi" type="number" placeholder="20" value={labelForm.width} onChange={e=>setLabelForm(f=>({...f,width:e.target.value}))}/>
                        </div>
                        <div className="fg">
                          <label className="fl">Alt. (cm)</label>
                          <input className="fi" type="number" placeholder="15" value={labelForm.height} onChange={e=>setLabelForm(f=>({...f,height:e.target.value}))}/>
                        </div>
                      </div>
                      <div className="fg">
                        <label className="fl">Observações</label>
                        <textarea className="fi" rows={3} placeholder="Frágil, lado correto para cima..." value={labelForm.obs} onChange={e=>setLabelForm(f=>({...f,obs:e.target.value}))} style={{resize:'vertical'}}/>
                      </div>
                    </div>

                    {customLabel && (
                      <div className="card" style={{marginBottom:14}}>
                        <div className="ct" style={{marginBottom:12}}>🎨 Etiqueta personalizada</div>
                        <div className="nalert">✓ Layout personalizado ativado nas configurações</div>
                        <div className="fg"><label className="fl">Logo da empresa</label><input className="fi" type="file" accept="image/*" style={{padding:'6px 12px'}}/></div>
                        <div className="fg"><label className="fl">Mensagem no rodapé</label><input className="fi" placeholder="Obrigado pela compra!" defaultValue="Obrigado pela compra!"/></div>
                      </div>
                    )}

                    {nfe && (
                      <div className="card" style={{marginBottom:14,borderColor:'rgba(59,130,246,.3)'}}>
                        <div className="ct" style={{marginBottom:12,color:'var(--blue)'}}>📄 NF-e</div>
                        <div className="nalert" style={{background:'rgba(59,130,246,.08)',borderColor:'rgba(59,130,246,.25)',color:'var(--blue)'}}>ℹ NF-e será emitida automaticamente ao gerar etiqueta</div>
                        <div className="fr">
                          <div className="fg"><label className="fl">Natureza da operação</label><input className="fi" defaultValue="Venda de mercadoria"/></div>
                          <div className="fg"><label className="fl">CFOP</label><input className="fi" defaultValue="6102"/></div>
                        </div>
                        <div className="fg"><label className="fl">Descrição do produto</label><input className="fi" placeholder="Descrição para a nota fiscal" value={labelForm.obs} onChange={e=>setLabelForm(f=>({...f,obs:e.target.value}))}/></div>
                      </div>
                    )}

                    <div style={{display:'flex',gap:10}}>
                      <button type="button" className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={()=>nav('labels')}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" style={{flex:2,justifyContent:'center'}}>🏷️ Gerar Etiqueta</button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </>}

          {/* ===== ENVIOS ===== */}
          {page==='shipments' && <>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <button className="btn btn-primary" style={{fontSize:12}}>Todos</button>
              <button className="btn btn-ghost" style={{fontSize:12}}>⚡ Express</button>
              <button className="btn btn-ghost" style={{fontSize:12}}>Em trânsito</button>
              <button className="btn btn-ghost" style={{fontSize:12}}>Entregues</button>
              <div style={{marginLeft:'auto'}}><button className="btn btn-ghost">📥 Exportar</button></div>
            </div>
            <div className="card">
              <div className="empty"><div className="empty-icon">📦</div><div className="empty-title">Nenhum envio ainda</div><div className="empty-sub">Crie sua primeira etiqueta para registrar um envio</div><button className="btn btn-primary" onClick={()=>nav('create-label')}>+ Criar etiqueta</button></div>
            </div>
          </>}

          {/* ===== SIMULADOR ===== */}
          {page==='simulator' && <div className="sgrid">
            <div>
              <div className="card" style={{marginBottom:14}}>
                <div className="ct" style={{marginBottom:16}}>📍 Origem</div>
                <div className="fg"><label className="fl">CEP de origem</label><input className="fi" defaultValue="01310-100"/></div>
                <div className="fr"><div className="fg"><label className="fl">Cidade</label><input className="fi" defaultValue="São Paulo"/></div><div className="fg"><label className="fl">Estado</label><select className="fsel"><option>SP</option><option>MG</option><option>RJ</option></select></div></div>
              </div>
              <div className="card" style={{marginBottom:14}}>
                <div className="ct" style={{marginBottom:16}}>📍 Destino</div>
                <div className="fg"><label className="fl">CEP de destino</label><input className="fi" value={destCep} onChange={e=>handleDestCep(e.target.value)} placeholder="Ex: 35585-000"/></div>
                {expressCepCity && <div className="ralert">⚡ {expressCepCity} — CEP prioritário!</div>}
                <div className="fr"><div className="fg"><label className="fl">Cidade</label><input className="fi" value={expressCepCity.split(',')[0]||''} placeholder="Cidade" readOnly={!!expressCepCity}/></div><div className="fg"><label className="fl">Estado</label><select className="fsel"><option>MG</option><option>SP</option><option>RJ</option></select></div></div>
              </div>
              <div className="card">
                <div className="ct" style={{marginBottom:16}}>📦 Pacote</div>
                <div className="fr"><div className="fg"><label className="fl">Peso (kg)</label><input className="fi" defaultValue="1.5"/></div><div className="fg"><label className="fl">Valor (R$)</label><input className="fi" defaultValue="250,00"/></div></div>
                <div className="fr3"><div className="fg"><label className="fl">Comp.</label><input className="fi" defaultValue="30"/></div><div className="fg"><label className="fl">Larg.</label><input className="fi" defaultValue="20"/></div><div className="fg"><label className="fl">Alt.</label><input className="fi" defaultValue="15"/></div></div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>setSimDone(true)}>🔍 Simular Frete</button>
              </div>
            </div>
            <div className="card">
              <div className="ct" style={{marginBottom:4}}>Resultados</div>
              <div className="cs" style={{marginBottom:16}}>Comparativo de transportadoras</div>
              {simDone
                ? [['#e63946','J&T','J&T Express','R$24,90','2 dias úteis',true],['#f59e0b','LGI','Loggi','R$31,50','1-2 dias',false],['#6366f1','YMP','Yampi','R$38,20','3-5 dias',false]].map(([c,s,n,p,d,best])=>(
                  <div key={s as string} className={`rcard${best?' best':''}`}>
                    <div className="rcl" style={{background:c as string}}>{s}</div>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{n as string}{best&&<span className="btag">MELHOR</span>}</div><div style={{fontSize:11,color:'var(--text3)'}}>⏱ {d as string}</div></div>
                    <div style={{fontSize:18,fontWeight:700,fontFamily:'monospace',color:best?'var(--green)':'var(--text)'}}>{p as string}</div>
                    <button className="btn btn-primary" style={{fontSize:11,padding:'6px 10px'}}>✓</button>
                  </div>
                ))
                : <div className="empty"><div className="empty-icon">🧮</div><div className="empty-title">Preencha os dados</div><div className="empty-sub">e clique em Simular Frete</div></div>
              }
            </div>
          </div>}

          {/* ===== TICKETS ===== */}
          {page==='tickets' && <>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div style={{display:'flex',gap:8}}><button className="btn btn-primary" style={{fontSize:12}}>Abertos</button><button className="btn btn-ghost" style={{fontSize:12}}>Em andamento</button><button className="btn btn-ghost" style={{fontSize:12}}>Fechados</button></div>
              <button className="btn btn-primary">+ Novo ticket</button>
            </div>
            <div className="card">
              <div className="empty"><div className="empty-icon">🎫</div><div className="empty-title">Nenhum ticket aberto</div><div className="empty-sub">Tickets de suporte aparecerão aqui</div></div>
            </div>
          </>}

          {/* ===== CONFIGURAÇÕES ===== */}
          {page==='configs' && <>
            <div className="ctabs">
              {['Geral','Notificações','Integrações','Etiqueta','NF-e','Entregar Agora'].map((t,i)=>(
                <div key={t} className={`ctab${configTab===i?' active':''}`} onClick={()=>setConfigTab(i)}>{t}</div>
              ))}
            </div>

            {configTab===0 && <div className="g2">
              <div className="card">
                <div className="ct" style={{marginBottom:16}}>🏢 Dados da empresa</div>
                <div className="fg"><label className="fl">Nome da empresa</label><input className="fi" placeholder="Minha Loja LTDA"/></div>
                <div className="fg"><label className="fl">CNPJ</label><input className="fi" placeholder="00.000.000/0001-00"/></div>
                <div className="fg"><label className="fl">CEP padrão de envio</label><input className="fi" placeholder="00000-000"/></div>
                <div className="fg"><label className="fl">E-mail de contato</label><input className="fi" placeholder="contato@empresa.com"/></div>
                <button className="btn btn-primary">💾 Salvar</button>
              </div>
              <div className="card">
                <div className="ct" style={{marginBottom:16}}>⚙️ Preferências gerais</div>
                {[
                  ['Geração automática de etiquetas','Gerar ao confirmar pedido importado',autoLabel,setAutoLabel],
                  ['Rastreio automático','Atualizar status a cada 4 horas',autoTrack,setAutoTrack],
                  ['Modo sandbox','Testar integrações sem custo real',sandbox,setSandbox],
                ].map(([l,s,on,set])=>(
                  <div key={l as string} className="crow"><div><div className="crow-label">{l as string}</div><div className="crow-sub">{s as string}</div></div><Toggle on={on as boolean} set={set as (v:boolean)=>void}/></div>
                ))}
              </div>
            </div>}

            {configTab===1 && <div className="card">
              <div className="ct" style={{marginBottom:16}}>🔔 Notificações</div>
              {[
                ['Notificações por e-mail','Alertas de status de entrega',emailNotif,setEmailNotif],
                ['Alertas de fila express','Notificar quando CEP prioritário entrar na fila',true,()=>{}],
                ['Relatório diário','Resumo de envios do dia por e-mail',false,()=>{}],
              ].map(([l,s,on,set])=>(
                <div key={l as string} className="crow"><div><div className="crow-label">{l as string}</div><div className="crow-sub">{s as string}</div></div><Toggle on={on as boolean} set={set as (v:boolean)=>void}/></div>
              ))}
            </div>}

            {configTab===2 && <div className="card">
              <div className="ct" style={{marginBottom:16}}>🔗 Integrações</div>
              {[['#6366f1','YMP','Yampi'],['#e63946','J&T','J&T Express'],['#f59e0b','LGI','Loggi']].map(([c,s,n])=>(
                <div key={s as string} style={{display:'flex',alignItems:'center',gap:12,padding:'12px',background:'var(--bg3)',borderRadius:10,marginBottom:10}}>
                  <div style={{width:38,height:38,borderRadius:9,background:c as string,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff'}}>{s}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{n}</div><div style={{fontSize:11,color:'var(--text3)'}}>Não configurado</div></div>
                  <button className="btn btn-ghost" style={{fontSize:12}}>Configurar</button>
                </div>
              ))}
              <div style={{marginTop:12,padding:14,background:'var(--bg3)',borderRadius:10,border:'1px dashed var(--border2)',textAlign:'center'}}>
                <div style={{fontSize:13,color:'var(--text3)',marginBottom:8}}>+ Adicionar integração</div>
                <button className="btn btn-ghost" style={{fontSize:12}}>Ver marketplace</button>
              </div>
            </div>}

            {configTab===3 && <div className="g2">
              <div className="card">
                <div className="ct" style={{marginBottom:16}}>🏷️ Etiqueta personalizada</div>
                <div className="crow">
                  <div><div className="crow-label">Ativar etiqueta personalizada</div><div className="crow-sub">Usar layout e logo personalizados nas etiquetas</div></div>
                  <Toggle on={customLabel} set={setCustomLabel}/>
                </div>
                {customLabel && <>
                  <div style={{marginTop:16}}>
                    <div className="fg"><label className="fl">Logo da empresa</label><input className="fi" type="file" accept="image/*" style={{padding:'6px 12px'}}/></div>
                    <div className="fg"><label className="fl">Cor primária</label><div style={{display:'flex',gap:8}}><input className="fi" type="color" defaultValue="#6366f1" style={{width:50,padding:4,cursor:'pointer'}}/><input className="fi" defaultValue="#6366f1" style={{flex:1}}/></div></div>
                    <div className="fg"><label className="fl">Mensagem no rodapé</label><input className="fi" placeholder="Obrigado pela compra! Volte sempre."/></div>
                    <div className="fg"><label className="fl">Site ou redes sociais</label><input className="fi" placeholder="www.minhaloja.com.br"/></div>
                    <div className="fg"><label className="fl">Tamanho da etiqueta</label><select className="fsel"><option>10x15 cm (padrão)</option><option>10x20 cm</option><option>A4 (múltiplas)</option></select></div>
                  </div>
                  <button className="btn btn-primary" style={{marginTop:8}}>💾 Salvar etiqueta</button>
                </>}
                {!customLabel && <div className="empty" style={{padding:'30px 0'}}><div className="empty-icon" style={{fontSize:36}}>🏷️</div><div className="empty-sub">Ative para personalizar o layout das etiquetas</div></div>}
              </div>
              <div className="card">
                <div className="ct" style={{marginBottom:12}}>Prévia</div>
                {customLabel
                  ? <div className="label-preview" style={{fontSize:12}}>
                    <div style={{fontWeight:700,fontSize:14}}>MINHA LOJA</div>
                    <div style={{fontSize:10,color:'var(--text3)',marginBottom:8}}>www.minhaloja.com.br</div>
                    <hr className="divider"/>
                    <div style={{fontSize:10,color:'var(--text3)'}}>DESTINATÁRIO</div>
                    <div style={{fontWeight:700}}>Nome do Cliente</div>
                    <div>Rua Exemplo, 123 — Cidade/MG</div>
                    <div style={{fontWeight:700,color:'var(--accent)'}}>CEP: 00000-000</div>
                    <hr className="divider"/>
                    <div style={{fontSize:10,color:'var(--text3)'}}>RASTREIO</div>
                    <div style={{fontWeight:700,letterSpacing:2}}>LL0000000000</div>
                    <hr className="divider"/>
                    <div style={{fontSize:10,color:'var(--text3)',textAlign:'center'}}>Obrigado pela compra! Volte sempre.</div>
                  </div>
                  : <div className="empty" style={{padding:'30px 0'}}><div className="empty-sub">Ative a etiqueta personalizada para ver a prévia</div></div>
                }
              </div>
            </div>}

            {configTab===4 && <div className="g2">
              <div className="card">
                <div className="ct" style={{marginBottom:16}}>📄 Nota Fiscal Eletrônica (NF-e)</div>
                <div className="crow">
                  <div><div className="crow-label">Ativar emissão de NF-e</div><div className="crow-sub">Emitir nota fiscal ao gerar etiquetas</div></div>
                  <Toggle on={nfe} set={setNfe}/>
                </div>
                {nfe && <>
                  <div className={`nfe-box${nfe?' active-nfe':''}`} style={{marginTop:16}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--green)',marginBottom:12}}>✅ NF-e ativada</div>
                    <div className="crow" style={{padding:'8px 0'}}>
                      <div><div className="crow-label">Emissão automática</div><div className="crow-sub">Emitir NF-e ao gerar cada etiqueta</div></div>
                      <Toggle on={nfeAuto} set={setNfeAuto}/>
                    </div>
                    <div className="fg" style={{marginTop:12}}><label className="fl">Ambiente</label>
                      <select className="fsel" value={nfeAmbiente} onChange={e=>setNfeAmbiente(e.target.value as 'homologacao'|'producao')}>
                        <option value="homologacao">Homologação (testes)</option>
                        <option value="producao">Produção</option>
                      </select>
                    </div>
                    <div className="fr">
                      <div className="fg"><label className="fl">Série NF-e</label><input className="fi" value={nfeSerie} onChange={e=>setNfeSerie(e.target.value)} placeholder="1"/></div>
                      <div className="fg"><label className="fl">Próximo número</label><input className="fi" placeholder="000001"/></div>
                    </div>
                    <div className="fg"><label className="fl">CNPJ emitente</label><input className="fi" placeholder="00.000.000/0001-00"/></div>
                    <div className="fg"><label className="fl">Certificado Digital (.pfx)</label><input className="fi" type="file" accept=".pfx,.p12" style={{padding:'6px 12px'}}/></div>
                    <div className="fg"><label className="fl">Senha do certificado</label><input className="fi" type="password" placeholder="••••••••"/></div>
                    {nfeAmbiente==='producao' && <div className="ralert" style={{marginTop:8}}>⚠️ Modo produção: notas fiscais reais serão emitidas</div>}
                    <button className="btn btn-primary" style={{marginTop:8}}>💾 Salvar configurações NF-e</button>
                  </div>
                </>}
                {!nfe && <div className="empty" style={{padding:'30px 0'}}><div className="empty-icon" style={{fontSize:36}}>📄</div><div className="empty-sub">Ative para configurar a emissão de NF-e</div></div>}
              </div>
              <div className="card">
                <div className="ct" style={{marginBottom:12}}>Status NF-e</div>
                {nfe
                  ? <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {[['Ambiente',nfeAmbiente==='producao'?'Produção':'Homologação'],['Série',nfeSerie||'—'],['Emissão automática',nfeAuto?'Ativa':'Desativada'],['Notas emitidas hoje','0'],['Erros','0']].map(([l,v])=>(
                      <div key={l as string} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg3)',borderRadius:8}}>
                        <span style={{fontSize:12,color:'var(--text3)'}}>{l}</span>
                        <span style={{fontSize:12,fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  : <div className="empty" style={{padding:'30px 0'}}><div className="empty-sub">Ative a NF-e para ver o painel de status</div></div>
                }
              </div>
            </div>}

            {configTab===5 && <div className="card">
              <div className="ct" style={{marginBottom:16}}>⚡ CEPs — Entregar Agora</div>
              <div className="fg">
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                  <div style={{flex:1}}>
                    <input className="fi" defaultValue="35585-000" style={{borderColor:'rgba(255,77,0,.4)',marginBottom:4}}/>
                    <div style={{fontSize:10,color:'var(--express)',fontFamily:'monospace'}}>Pimenta, MG</div>
                  </div>
                  <button className="btn btn-ghost" style={{padding:'8px',alignSelf:'flex-start'}}>🗑</button>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
                  <div style={{flex:1}}>
                    <input className="fi" defaultValue="37925-000" style={{borderColor:'rgba(168,85,247,.4)',marginBottom:4}}/>
                    <div style={{fontSize:10,color:'var(--purple)',fontFamily:'monospace'}}>Piumhi, MG</div>
                  </div>
                  <button className="btn btn-ghost" style={{padding:'8px',alignSelf:'flex-start'}}>🗑</button>
                </div>
                <button className="btn btn-ghost" style={{fontSize:12}}>+ Adicionar CEP</button>
              </div>
              <div className="crow"><div><div className="crow-label">Auto-despacho express</div><div className="crow-sub">Despachar automaticamente ao entrar na fila</div></div><Toggle on={false} set={()=>{}}/></div>
              <div className="crow"><div><div className="crow-label">Notificar ao entrar na fila</div><div className="crow-sub">Alerta quando novo pedido é detectado</div></div><Toggle on={true} set={()=>{}}/></div>
              <button className="btn btn-primary" style={{marginTop:16}}>💾 Salvar</button>
            </div>}
          </>}

          {/* ===== API ===== */}
          {page==='api' && <ApiPage keyVisible={keyVisible} setKeyVisible={setKeyVisible} apiKey={apiKey} apis={apis} setApis={setApis} apisLoaded={apisLoaded}/>}
          {page==='errors' && <ErrorsPage/>}
          {page==='webhook' && <WebhookPage/>}

        </div>
      </div>
    {/* CREATE USER MODAL */}
    {showCreateUser && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShowCreateUser(false)}}>
        <div style={{background:'var(--bg2)',border:'1px solid rgba(99,102,241,.4)',borderRadius:20,padding:28,width:420,maxWidth:'90vw',boxShadow:'0 0 60px rgba(99,102,241,.15)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div style={{fontSize:18,fontWeight:700}}>👤 Criar novo usuário</div>
            <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:12}} onClick={()=>setShowCreateUser(false)}>✕</button>
          </div>
          {userToast && <div style={{background:userToast.includes('✅')?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)',border:`1px solid ${userToast.includes('✅')?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`,borderRadius:8,padding:'8px 12px',fontSize:13,color:userToast.includes('✅')?'var(--green)':'var(--red)',marginBottom:14}}>{userToast}</div>}
          <div className="fg"><label className="fl">Nome completo *</label><input className="fi" placeholder="Nome do usuário" value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Usuário *</label><input className="fi" placeholder="Ex: joao.silva" value={newUser.username} onChange={e=>setNewUser(u=>({...u,username:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Senha *</label><input className="fi" type="password" placeholder="Mínimo 6 caracteres" value={newUser.password} onChange={e=>setNewUser(u=>({...u,password:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Perfil de acesso</label>
            <select className="fsel" value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}>
              <option value="admin">Administrador — acesso total</option>
              <option value="operator">Operador — criar e gerenciar envios</option>
              <option value="viewer">Visualizador — somente leitura</option>
            </select>
          </div>
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowCreateUser(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{flex:2,justifyContent:'center'}} onClick={createUser} disabled={userSaving}>{userSaving?'Criando...':'👤 Criar usuário'}</button>
          </div>
        </div>
      </div>
    )}

    </>
  )
}

/* ===================== LABELS PAGE ===================== */
/* eslint-disable @typescript-eslint/no-explicit-any */
function LabelsPage({syncing, syncResult, runYampiSync, navCreate, syncToast, testWebhook}: {
  syncing:boolean; syncResult:any; runYampiSync:()=>void; navCreate:()=>void; syncToast:string; testWebhook:(cep?:string)=>void
}) {
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [generating, setGenerating] = useState<string|null>(null)
  const [toast, setToast]         = useState('')
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const PER_PAGE = 100

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),4000)}

  useEffect(()=>{
    if(typeof window==='undefined') return
    loadShipments(page)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[page])

  async function loadShipments(p = page){
    setLoading(true)
    try{
      const offset = (p - 1) * PER_PAGE
      const r = await fetch(`/api/shipments?limit=${PER_PAGE}&offset=${offset}`)
      const j = await r.json()
      if(j.data) setShipments(j.data)
      if(j.total !== undefined) setTotal(j.total)
    }catch(e){console.error(e)}
    setLoading(false)
  }

  async function handleSync(){
    await runYampiSync()
    setTimeout(loadShipments, 2000)
  }

  async function generateLabel(shipment: any){
    setGenerating(shipment.id)
    try{
      const r = await fetch('/api/labels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shipment_id:shipment.id})})
      const j = await r.json()
      if(j.data){ showToast('✅ Etiqueta gerada!'); loadShipments() }
      else showToast('❌ '+(j.error||'Erro ao gerar'))
    }catch{ showToast('❌ Erro de conexão') }
    setGenerating(null)
  }

  const filtered = statusFilter==='all' ? shipments : shipments.filter(s=>s.status===statusFilter)
  const pending  = shipments.filter(s=>s.status==='pending').length
  const express  = shipments.filter(s=>s.is_express).length
  const totalPages = Math.ceil(total / PER_PAGE)

  const carrierName: Record<string,string> = {jt:'J&T Express', loggi:'Loggi', yampi:'Yampi'}
  const carrierColor: Record<string,string> = {jt:'#e63946', loggi:'#f59e0b', yampi:'#6366f1'}

  return <>
    {(toast||syncToast) && <div style={{position:'fixed',top:16,right:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 18px',fontSize:13,zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,.3)',maxWidth:360}}>{toast||syncToast}</div>}

    {/* HEADER */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:8}}>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>Fila de Etiquetas</div>
        <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
          <span style={{color:'var(--text2)',fontWeight:600}}>{total}</span> pedidos sincronizados no total
          &nbsp;·&nbsp;
          <span style={{color:'var(--accent)',fontWeight:600}}>{filtered.length}</span> nesta página
          &nbsp;·&nbsp;{pending} pendentes · {express} express
        </div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn btn-ghost" style={{fontSize:12,opacity:syncing?.6:1,borderColor:'rgba(99,102,241,.3)',color:'#818cf8'}} onClick={handleSync} disabled={syncing}>
          {syncing?'🔄 Sincronizando...':'🔄 Sincronizar Yampi'}
        </button>
        <button className="btn btn-ghost" style={{fontSize:12,borderColor:'rgba(255,77,0,.3)',color:'var(--express)'}} onClick={()=>testWebhook('35585-000')} title="Criar pedido de teste para Pimenta">
          🧪 Testar Express
        </button>
        <button className="btn btn-ghost" style={{fontSize:12}}>🖨 Imprimir selecionadas</button>
        <button className="btn btn-primary" style={{fontSize:12}} onClick={navCreate}>+ Criar Etiqueta</button>
      </div>
    </div>

    {/* SYNC RESULT */}
    {syncResult && !syncing && (
      <div style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.25)',borderRadius:10,padding:'10px 16px',marginBottom:12,display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',fontSize:12}}>
        <span style={{fontWeight:600,color:'var(--green)'}}>✅ Sincronização concluída</span>
        <span>📦 <strong>{syncResult.synced}</strong> novos</span>
        <span>⏭ <strong>{syncResult.skipped}</strong> já existiam</span>
        {syncResult.errors>0&&<span style={{color:'var(--red)'}}>❌ <strong>{syncResult.errors}</strong> erros</span>}
      </div>
    )}

    {syncing && (
      <div style={{background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',borderRadius:10,padding:'10px 16px',marginBottom:12,fontSize:12,color:'#818cf8'}}>
        🔄 Sincronizando com Yampi... buscando pedidos prontos para envio
      </div>
    )}

    {/* FILTERS */}
    <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
      {[['all','Todos',shipments.length],['pending','Pendentes',pending],['in_transit','Em trânsito',shipments.filter(s=>s.status==='in_transit').length],['delivered','Entregues',shipments.filter(s=>s.status==='delivered').length]].map(([k,l,c])=>(
        <button key={k as string} className={`btn ${statusFilter===k?'btn-primary':'btn-ghost'}`} style={{fontSize:12}} onClick={()=>setStatusFilter(k as string)}>{l as string} ({c})</button>
      ))}
      <button className="btn btn-ghost" style={{fontSize:12,marginLeft:'auto'}} onClick={loadShipments}>🔄 Atualizar</button>
    </div>

    {/* TABLE */}
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'grid',gridTemplateColumns:'40px 130px 1fr 1fr 1fr 120px 100px',gap:0,padding:'10px 16px',borderBottom:'1px solid var(--border)',background:'var(--bg3)'}}>
        {['','STATUS','PEDIDO','CLIENTE','PRODUTO','DATA','AÇÃO'].map(h=>(
          <div key={h} style={{fontSize:10,color:'var(--text3)',letterSpacing:'1px',textTransform:'uppercase',fontWeight:600}}>{h}</div>
        ))}
      </div>

      {loading && <div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>Carregando...</div>}

      {!loading && filtered.length===0 && (
        <div style={{padding:48,textAlign:'center',color:'var(--text3)'}}>
          <div style={{fontSize:40,marginBottom:12}}>🏷️</div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text2)',marginBottom:6}}>Nenhum pedido na fila</div>
          <div style={{fontSize:13,marginBottom:16}}>Clique em Sincronizar Yampi para importar pedidos prontos para envio</div>
          <div style={{display:'flex',gap:8,justifyContent:'center'}}>
            <button className="btn btn-ghost" onClick={handleSync} disabled={syncing}>🔄 Sincronizar Yampi</button>
            <button className="btn btn-primary" onClick={navCreate}>+ Criar etiqueta manual</button>
          </div>
        </div>
      )}

      {!loading && filtered.map((s,i)=>(
        <div key={s.id} style={{display:'grid',gridTemplateColumns:'40px 130px 1fr 1fr 1fr 120px 100px',gap:0,padding:'12px 16px',borderBottom:i<filtered.length-1?'1px solid var(--border)':'none',alignItems:'center',background:s.is_express?'rgba(255,77,0,.03)':undefined,transition:'background .15s'}} className="shiprow">
          {/* Checkbox */}
          <div style={{width:18,height:18,border:'2px solid var(--border2)',borderRadius:4,cursor:'pointer',flexShrink:0}}></div>

          {/* Status */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <span style={{
              display:'inline-flex',alignItems:'center',gap:4,
              background:s.status==='pending'?'rgba(34,197,94,.12)':s.status==='in_transit'?'rgba(245,158,11,.12)':'rgba(99,102,241,.12)',
              color:s.status==='pending'?'var(--green)':s.status==='in_transit'?'var(--amber)':'var(--accent2)',
              borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:600,width:'fit-content'
            }}>
              {s.status==='pending'?'✓ Pronto':s.status==='in_transit'?'Em trânsito':s.status==='delivered'?'Entregue':'Pendente'}
            </span>
            {s.is_express && <span style={{fontSize:9,fontWeight:700,color:'var(--express)',background:'rgba(255,77,0,.12)',borderRadius:4,padding:'2px 6px',width:'fit-content'}}>⚡ EXPRESS</span>}
            {s.nfe_chave
              ? <span style={{fontSize:10,fontWeight:600,color:'var(--green)',background:'rgba(34,197,94,.12)',borderRadius:4,padding:'2px 6px',width:'fit-content'}}>📄 Com NF-e</span>
              : <span style={{fontSize:10,color:'var(--text3)',background:'rgba(255,255,255,.05)',borderRadius:4,padding:'2px 6px',width:'fit-content'}}>Sem NF-e</span>
            }
          </div>

          {/* Pedido */}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)',fontFamily:'monospace'}}>#{s.order_id}</div>
          </div>

          {/* Cliente */}
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{s.recipient_name}</div>
            <div style={{fontSize:11,color:'var(--text3)'}}>{s.recipient_city}, {s.recipient_state}</div>
            {s.is_express && <div style={{fontSize:10,fontFamily:'monospace',color:'var(--express)'}}>{s.recipient_cep}</div>}
          </div>

          {/* Produto */}
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{s.product_name || s.items?.[0]?.name || '—'}</div>
            {s.product_name || s.items?.[0]?.name
              ? <div style={{fontSize:11,color:'var(--text3)'}}>{s.items?.[0]?.quantity ? `Qtd: ${s.items[0].quantity}` : ''}</div>
              : <div style={{fontSize:11,color:'var(--text3)'}}>Produto não informado</div>
            }
          </div>

          {/* Data */}
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'monospace'}}>
            {(s.ordered_at || s.created_at) ? new Date(s.ordered_at || s.created_at).toLocaleDateString('pt-BR') : '—'}
            <div>{(s.ordered_at || s.created_at) ? new Date(s.ordered_at || s.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
          </div>

          {/* Ação */}
          <div>
            <button
              className="btn btn-primary"
              style={{fontSize:11,padding:'6px 12px',background:'linear-gradient(135deg,#2563eb,#1d4ed8)',opacity:generating===s.id?.6:1}}
              onClick={()=>generateLabel(s)}
              disabled={generating===s.id}
            >
              {generating===s.id?'⏳':'✈'} Gerar
            </button>
          </div>
        </div>
      ))}
    </div>

    <style>{`.shiprow:hover{background:var(--surface2)!important;}`}</style>

    {/* PAGINAÇÃO */}
    {totalPages > 1 && (
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:14,padding:'12px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12}}>
        <div style={{fontSize:12,color:'var(--text3)'}}>
          Mostrando {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, total)} de <strong style={{color:'var(--text)'}}>{total}</strong> pedidos
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 12px'}} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>← Anterior</button>
          {Array.from({length:totalPages},(_, i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1).map((p,i,arr)=>(<>
            {i>0&&arr[i-1]!==p-1&&<span key={`dots-${p}`} style={{color:'var(--text3)',fontSize:12}}>...</span>}
            <button key={p} className={`btn ${p===page?'btn-primary':'btn-ghost'}`} style={{fontSize:12,padding:'6px 10px',minWidth:34}} onClick={()=>setPage(p)}>{p}</button>
          </>))}
          <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 12px'}} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Próxima →</button>
        </div>
      </div>
    )}
  </>
}

/* ===================== API PAGE ===================== */
/* eslint-disable @typescript-eslint/no-explicit-any */
function ApiPage({keyVisible, setKeyVisible, apiKey, apis, setApis, apisLoaded}: {
  keyVisible:boolean; setKeyVisible:(v:boolean)=>void; apiKey:string;
  apis:any[]; setApis:React.Dispatch<React.SetStateAction<any[]>>; apisLoaded:boolean
}) {
  const [apiTab, setApiTab]         = useState(0)
  const [showAdd, setShowAdd]       = useState(false)
  const [editId, setEditId]         = useState<string|null>(null)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState('')
  const [newApi, setNewApi]         = useState({name:'',url:'',api_key:'',secret:'',auth_type:'yampi'})
  const [editForm, setEditForm]     = useState<any>({})
  const loading = !apisLoaded

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),4000)}

  async function addApi(){
    if(!newApi.name||!newApi.url){showToast('❌ Nome e URL obrigatórios');return}
    setSaving(true)
    try{
      const r = await fetch('/api/integrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newApi)})
      const j = await r.json()
      if(j.data?.id){setApis((a:any[])=>[...a,j.data]);setNewApi({name:'',url:'',api_key:'',secret:'',auth_type:'yampi'});setShowAdd(false);showToast('✅ API salva!')}
      else showToast('❌ '+(j.error||'Erro ao salvar'))
    }catch{showToast('❌ Erro de conexão')}
    setSaving(false)
  }

  async function saveEdit(){
    if(!editId){showToast('❌ ID inválido');return}
    setSaving(true)
    try{
      const r = await fetch('/api/integrations?id='+editId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editForm)})
      const j = await r.json()
      if(j.data){setApis((a:any[])=>a.map((x:any)=>x.id===editId?j.data:x));setEditId(null);showToast('✅ Salvo!')}
      else showToast('❌ '+(j.error||'Erro ao salvar'))
    }catch{showToast('❌ Erro de conexão')}
    setSaving(false)
  }

  async function deleteApi(id:string){
    if(!confirm('Remover esta API?'))return
    await fetch('/api/integrations?id='+id,{method:'DELETE'})
    setApis((a:any[])=>a.filter((x:any)=>x.id!==id));setEditId(null);showToast('🗑 Removida')
  }

  async function toggleStatus(api:any){
    const ns = api.status==='connected'?'disconnected':'connected'
    const r = await fetch('/api/integrations?id='+api.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...api,status:ns})})
    const j = await r.json()
    if(j.data)setApis((a:any[])=>a.map((x:any)=>x.id===api.id?j.data:x))
    showToast(ns==='connected'?'✅ Conectada':'⏸ Desconectada')
  }

  const tabs = ['Minhas APIs','Endpoints','Chave LogLife']

  return <>
    {toast&&<div style={{position:'fixed',top:16,right:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 18px',fontSize:13,zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,.3)',maxWidth:340}}>{toast}</div>}

    <div style={{display:'flex',gap:4,background:'var(--bg3)',borderRadius:10,padding:4,marginBottom:20,width:'fit-content'}}>
      {tabs.map((t,i)=><div key={t} onClick={()=>setApiTab(i)} style={{padding:'7px 16px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:600,background:apiTab===i?'var(--surface)':'transparent',color:apiTab===i?'var(--text)':'var(--text3)',transition:'all .15s'}}>{t}</div>)}
    </div>

    {apiTab===0&&<>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:13,color:'var(--text3)'}}>{loading?'Carregando...':`${apis.length} API${apis.length!==1?'s':''} configurada${apis.length!==1?'s':''}`}</div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Adicionar API</button>
      </div>

      {showAdd&&<div className="card" style={{marginBottom:14,borderColor:'rgba(99,102,241,.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><div className="ct">➕ Nova API</div><button className="btn btn-ghost" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>setShowAdd(false)}>✕</button></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div className="fg"><label className="fl">Nome *</label><input className="fi" placeholder="Ex: Yampi" value={newApi.name} onChange={e=>setNewApi(a=>({...a,name:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Alias da loja ou URL base *</label><input className="fi" placeholder="melasonina ou https://api.dooki.com.br/v2/melasonina" value={newApi.url} onChange={e=>setNewApi(a=>({...a,url:e.target.value}))}/></div>
          <div className="fg"><label className="fl">User Token (API Key)</label><input className="fi" placeholder="Token da API" value={newApi.api_key} onChange={e=>setNewApi(a=>({...a,api_key:e.target.value}))}/></div>
          <div className="fg"><label className="fl">User Secret Key</label><input className="fi" placeholder="Secret Key" value={newApi.secret} onChange={e=>setNewApi(a=>({...a,secret:e.target.value}))}/></div>
        </div>
        <div className="fg"><label className="fl">Tipo de autenticação</label><select className="fsel" value={newApi.auth_type} onChange={e=>setNewApi(a=>({...a,auth_type:e.target.value}))}><option value="yampi">Yampi / Dooki: User-Token + User-Secret-Key</option><option value="bearer">Bearer Token</option><option value="apikey">API Key</option><option value="basic">Basic Auth</option></select></div>
        <div style={{display:'flex',gap:10,marginTop:4}}>
          <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowAdd(false)}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:2,justifyContent:'center'}} onClick={addApi} disabled={saving}>{saving?'Salvando...':'💾 Salvar no Supabase'}</button>
        </div>
      </div>}

      {loading&&<div className="card"><div className="empty"><div className="empty-sub">Carregando...</div></div></div>}

      {!loading&&apis.map((api)=><div key={api.id} className="card" style={{marginBottom:12}}>
        {editId===api.id?(<>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><div className="ct">✏️ Editar — {api.name}</div><button className="btn btn-ghost" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>setEditId(null)}>✕</button></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div className="fg"><label className="fl">Nome</label><input className="fi" defaultValue={editForm.name||''} onChange={e=>setEditForm((f:any)=>({...f,name:e.target.value}))}/></div>
            <div className="fg"><label className="fl">Alias da loja ou URL base</label><input className="fi" defaultValue={editForm.url||''} onChange={e=>setEditForm((f:any)=>({...f,url:e.target.value}))}/></div>
            <div className="fg"><label className="fl">User Token (API Key)</label><input className="fi" defaultValue={editForm.api_key||''} onChange={e=>setEditForm((f:any)=>({...f,api_key:e.target.value}))}/></div>
            <div className="fg"><label className="fl">User Secret Key</label><input className="fi" defaultValue={editForm.secret||''} onChange={e=>setEditForm((f:any)=>({...f,secret:e.target.value}))}/></div>
          </div>
          <div className="fg"><label className="fl">Tipo de autenticação</label><select className="fsel" defaultValue={editForm.auth_type||'yampi'} onChange={e=>setEditForm((f:any)=>({...f,auth_type:e.target.value}))}><option value="yampi">Yampi / Dooki: User-Token + User-Secret-Key</option><option value="bearer">Bearer Token</option><option value="apikey">API Key</option><option value="basic">Basic Auth</option></select></div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button className="btn btn-ghost" style={{fontSize:12,color:'var(--red)'}} onClick={()=>deleteApi(api.id)}>🗑 Remover</button>
            <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>toggleStatus(api)}>{api.status==='connected'?'⏸ Desconectar':'▶ Conectar'}</button>
            <button className="btn btn-primary" style={{fontSize:12,marginLeft:'auto'}} onClick={saveEdit} disabled={saving}>{saving?'Salvando...':'💾 Salvar'}</button>
          </div>
        </>):(<div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:42,height:42,borderRadius:10,background:api.name.toLowerCase().includes('yampi')?'#6366f1':api.name.toLowerCase().includes('j&t')||api.name.toLowerCase().includes('jt')?'#e63946':'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>{api.name.substring(0,3).toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{api.name}</div>
            <div style={{fontSize:11,color:'var(--text3)',fontFamily:'monospace'}}>{api.url}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
              Token: <span style={{color:'#818cf8'}}>{api.api_key?'••••••••':'não configurado'}</span>
              {' · '}Secret: <span style={{color:api.secret?'var(--green)':'var(--red)'}}>{api.secret?'✅ configurado':'❌ não configurado'}</span>
            </div>
          </div>
          <div style={{textAlign:'right',marginRight:8}}>
            <span className={`badge ${api.status==='connected'?'bs':'bd'}`} style={{marginBottom:6,display:'inline-block'}}>{api.status==='connected'?'✅ Conectada':'❌ Desconectada'}</span>
            <div style={{fontSize:10,color:'var(--text3)'}}>{api.calls_today||0} chamadas hoje</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className={`btn ${api.status==='connected'?'btn-ghost':'btn-success'}`} style={{fontSize:12}} onClick={()=>toggleStatus(api)}>{api.status==='connected'?'⏸':'▶ Conectar'}</button>
            <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>{setEditId(api.id);setEditForm({name:api.name,url:api.url,api_key:api.api_key||'',secret:api.secret||'',auth_type:api.auth_type||'yampi',status:api.status})}}>✏️ Configurar</button>
          </div>
        </div>)}
      </div>)}

      {!loading&&apis.length===0&&!showAdd&&<div className="card"><div className="empty"><div className="empty-icon">🔌</div><div className="empty-title">Nenhuma API configurada</div><div className="empty-sub">Adicione integrações com transportadoras e marketplaces</div><button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Adicionar API</button></div></div>}
    </>}

    {apiTab===1&&<div className="card"><div className="ct" style={{marginBottom:16}}>Endpoints da API LogLife</div>
      {[['get','GET','/v1/shipments','Listar envios'],['post','POST','/v1/shipments','Criar envio'],['get','GET','/v1/express/queue','Fila Entregar Agora'],['post','POST','/v1/express/dispatch','Despachar'],['post','POST','/v1/labels','Gerar etiqueta'],['post','POST','/v1/freight/simulate','Simular frete'],['get','GET','/v1/integrations','Listar APIs'],['post','POST','/v1/integrations','Salvar API'],['get','GET','/v1/errors','Logs do sistema']].map(([cls,m,p,d])=>(
        <div key={p} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px'}}><span className={`mth ${cls}`}>{m}</span><span className="apath">{p}</span><span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>{d}</span></div>
        </div>
      ))}
    </div>}

    {apiTab===2&&<div className="g2">
      <div className="akcard">
        <div className="ct">Chave de API — LogLife</div>
        <div style={{fontSize:11,color:'var(--text3)',marginTop:4,marginBottom:16}}>Use para autenticar chamadas externas</div>
        <div className="akd">
          <div className="akv">{keyVisible?apiKey:'ll_prod_••••••••••••••••••••••••••••••••'}</div>
          <div className="iBtn" style={{width:28,height:28,cursor:'pointer'}} onClick={()=>setKeyVisible(!keyVisible)}>{keyVisible?'🙈':'👁'}</div>
          <div className="iBtn" style={{width:28,height:28,cursor:'pointer'}}>📋</div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}><button className="btn btn-ghost" style={{fontSize:11}}>🔄 Regenerar</button><span className="badge bs">Ativa</span></div>
      </div>
      <div className="card">
        <div className="ct" style={{marginBottom:12}}>Uso da API</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[['0','Chamadas hoje','var(--accent)'],['100%','Uptime','var(--green)'],['—','Latência','var(--amber)'],['50k','Limite','var(--purple)']].map(([v,l,c])=>(
            <div key={l} style={{background:'var(--bg3)',borderRadius:8,padding:10,textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:c as string}}>{v}</div><div style={{fontSize:10,color:'var(--text3)'}}>{l}</div></div>
          ))}
        </div>
      </div>
    </div>}
  </>
}

/* ===================== WEBHOOK PAGE ===================== */
function WebhookPage() {
  const [showAdd, setShowAdd]   = useState(false)
  const [editIdx, setEditIdx]   = useState<null|string>(null)
  const [webhooks, setWebhooks] = useState<{id:string;name:string;url:string;events:string[];active:boolean;secret:string;calls:number;success:number}[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [newWh, setNewWh]       = useState({name:'',url:'',secret:'',events:[] as string[]})

  function showToast(msg: string) { setToast(msg); setTimeout(()=>setToast(''),3000) }

  useEffect(()=>{
    if(typeof window === 'undefined') return
    fetch('/api/webhooks')
      .then(r=>r.json())
      .then(r=>{ if(Array.isArray(r.data)) setWebhooks(r.data) })
      .catch(()=>console.error('Erro ao carregar webhooks'))
      .finally(()=>setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  const allEvents = [
    'shipment.created','shipment.posted','shipment.in_transit',
    'shipment.out_for_delivery','shipment.delivered',
    'shipment.failed','shipment.returned',
    'express.queue_entry','express.dispatched','express.delivered',
    'label.created','label.printed','label.error',
    'ticket.created','ticket.resolved',
  ]

  function toggleEvent(ev: string, list: string[], set: (v:string[])=>void) {
    set(list.includes(ev) ? list.filter(e=>e!==ev) : [...list, ev])
  }

  async function addWebhook() {
    if (!newWh.name||!newWh.url||!newWh.events.length) return
    setSaving(true)
    try {
      const r = await fetch('/api/webhooks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newWh.name,url:newWh.url,secret:newWh.secret,events:newWh.events,active:true})})
      const json = await r.json()
      if (json.data && json.data.id) {
        setWebhooks(w=>[...w,json.data]); setNewWh({name:'',url:'',secret:'',events:[]}); setShowAdd(false); showToast('✅ Webhook salvo no Supabase!')
      } else { showToast('❌ Erro: '+(json.error||'resposta inválida')); console.error('Webhook save error:', json) }
    } catch { showToast('❌ Erro de conexão') }
    setSaving(false)
  }

  async function deleteWebhook(id: string) {
    if (!id) return
    await fetch('/api/webhooks?id='+encodeURIComponent(id),{method:'DELETE'})
    setWebhooks(w=>w.filter(x=>x.id!==id)); showToast('🗑 Webhook removido')
  }

  async function toggleActive(wh: {id:string;active:boolean}) {
    if (!wh.id) return
    await fetch('/api/webhooks?id='+encodeURIComponent(wh.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!wh.active})})
    setWebhooks(w=>w.map(x=>x.id===wh.id?{...x,active:!x.active}:x))
    showToast(!wh.active?'✅ Webhook ativado':'⏸ Webhook desativado')
  }

  return <>
    {toast && <div style={{position:'fixed',top:16,right:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 18px',fontSize:13,zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>{toast}</div>}

    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div style={{fontSize:13,color:'var(--text3)'}}>{loading?'Carregando...':`${webhooks.length} webhook${webhooks.length!==1?'s':''} configurado${webhooks.length!==1?'s':''}`}</div>
      <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Novo Webhook</button>
    </div>

    {showAdd && (
      <div className="card" style={{marginBottom:16,borderColor:'rgba(99,102,241,.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <div className="ct">➕ Novo Webhook</div>
          <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>setShowAdd(false)}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div className="fg"><label className="fl">Nome *</label><input className="fi" placeholder="Ex: Pedidos entregues" value={newWh.name} onChange={e=>setNewWh(w=>({...w,name:e.target.value}))}/></div>
          <div className="fg"><label className="fl">URL de destino *</label><input className="fi" placeholder="https://meusite.com/webhook" value={newWh.url} onChange={e=>setNewWh(w=>({...w,url:e.target.value}))}/></div>
        </div>
        <div className="fg"><label className="fl">Secret HMAC (opcional)</label><input className="fi" type="password" placeholder="Para validar autenticidade" value={newWh.secret} onChange={e=>setNewWh(w=>({...w,secret:e.target.value}))}/></div>
        <div className="fg">
          <label className="fl">Eventos * — selecione ao menos um</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:4}}>
            {allEvents.map(ev=>(
              <div key={ev} onClick={()=>toggleEvent(ev,newWh.events,evs=>setNewWh(w=>({...w,events:evs})))}
                style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${newWh.events.includes(ev)?'var(--accent)':'var(--border)'}`,background:newWh.events.includes(ev)?'var(--ag)':'var(--bg3)',color:newWh.events.includes(ev)?'#818cf8':'var(--text3)',fontSize:11,fontFamily:'monospace',cursor:'pointer',transition:'all .15s'}}>
                {ev}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:8}}>
          <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowAdd(false)}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:2,justifyContent:'center',opacity:saving?.5:1}} onClick={addWebhook} disabled={saving}>{saving?'Salvando...':'💾 Salvar no Supabase'}</button>
        </div>
      </div>
    )}

    {loading && <div className="card"><div className="empty"><div className="empty-sub">Carregando webhooks do Supabase...</div></div></div>}

    {!loading && webhooks.map((wh)=>(
      <div key={wh.id} className="card" style={{marginBottom:12,borderColor:!wh.active?'rgba(239,68,68,.2)':undefined}}>
        {editIdx===wh.id ? (
          <>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div className="ct">✏️ Editar — {wh.name}</div>
              <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>setEditIdx(null)}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div className="fg"><label className="fl">Nome</label><input className="fi" defaultValue={wh.name}/></div>
              <div className="fg"><label className="fl">URL</label><input className="fi" defaultValue={wh.url}/></div>
            </div>
            <div className="fg"><label className="fl">Secret</label><input className="fi" type="password" defaultValue={wh.secret||''}/></div>
            <div className="fg">
              <label className="fl">Eventos</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:4}}>
                {allEvents.map(ev=>{
                  const sel=wh.events?.includes(ev)
                  return <div key={ev} onClick={()=>setWebhooks(ws=>ws.map(w=>w.id===wh.id?{...w,events:w.events?.includes(ev)?w.events.filter(e=>e!==ev):[...(w.events||[]),ev]}:w))}
                    style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${sel?'var(--accent)':'var(--border)'}`,background:sel?'var(--ag)':'var(--bg3)',color:sel?'#818cf8':'var(--text3)',fontSize:11,fontFamily:'monospace',cursor:'pointer',transition:'all .15s'}}>
                    {ev}
                  </div>
                })}
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-ghost" style={{fontSize:12,color:'var(--red)'}} onClick={()=>deleteWebhook(wh.id)}>🗑 Remover</button>
              <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>toggleActive(wh)}>{wh.active?'⏸ Desativar':'▶ Ativar'}</button>
              <button className="btn btn-primary" style={{fontSize:12,marginLeft:'auto'}} onClick={()=>setEditIdx(null)}>💾 Salvar</button>
            </div>
          </>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{wh.name}</div>
                <div style={{fontFamily:'monospace',fontSize:11,color:'#818cf8',marginBottom:8}}>{wh.url}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {(wh.events||[]).map(ev=><span key={ev} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:4,padding:'2px 7px',fontSize:10,fontFamily:'monospace',color:'var(--text3)'}}>{ev}</span>)}
                </div>
              </div>
              <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
                <span className={`badge ${wh.active?'bs':'bd'}`}>{wh.active?'✅ Ativo':'❌ Inativo'}</span>
                <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setEditIdx(wh.id)}>✏️ Editar</button>
              </div>
            </div>
            <div style={{display:'flex',gap:16,fontSize:11,color:'var(--text3)',borderTop:'1px solid var(--border)',paddingTop:10}}>
              <span>📊 {wh.calls||0} disparos</span>
              <span>✅ {wh.success||100}% sucesso</span>
              <button style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#818cf8'}} onClick={()=>toggleActive(wh)}>{wh.active?'⏸ Desativar':'▶ Ativar'}</button>
            </div>
          </>
        )}
      </div>
    ))}

    {!loading && webhooks.length===0 && !showAdd && (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">🔗</div>
          <div className="empty-title">Nenhum webhook configurado</div>
          <div className="empty-sub">Os webhooks são salvos no Supabase e persistem entre sessões</div>
          <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Criar primeiro webhook</button>
        </div>
      </div>
    )}
  </>
}

/* ===================== ERRORS PAGE ===================== */
/* eslint-disable @typescript-eslint/no-explicit-any */
function ErrorsPage() {
  const [logs, setLogs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all'|'error'|'warning'|'info'|'success'>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  async function loadLogs() {
    setLoading(true)
    try {
      const r = await fetch('/api/errors')
      const json = await r.json()
      if (json.data) setLogs(json.data)
    } catch(e) {
      console.error('Erro ao carregar logs:', e)
    }
    setLoading(false)
  }

  useEffect(() => { 
    if(typeof window !== 'undefined') loadLogs() 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadLogs, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  const levelColor: Record<string, string> = {
    error:   'var(--red)',
    warning: 'var(--amber)',
    info:    'var(--blue)',
    success: 'var(--green)',
  }
  const levelBg: Record<string, string> = {
    error:   'rgba(239,68,68,.1)',
    warning: 'rgba(245,158,11,.1)',
    info:    'rgba(59,130,246,.1)',
    success: 'rgba(34,197,94,.1)',
  }
  const levelIcon: Record<string, string> = {
    error: '❌', warning: '⚠️', info: 'ℹ️', success: '✅',
  }

  const errorCount   = logs.filter(l => l.level === 'error').length
  const warningCount = logs.filter(l => l.level === 'warning').length
  const successCount = logs.filter(l => l.level === 'success').length

  return <>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className={`btn ${filter==='all'?'btn-primary':'btn-ghost'}`} style={{fontSize:12}} onClick={()=>setFilter('all')}>Todos ({logs.length})</button>
        <button className={`btn ${filter==='error'?'btn-primary':'btn-ghost'}`} style={{fontSize:12,borderColor:filter==='error'?undefined:'rgba(239,68,68,.3)',color:filter==='error'?undefined:'var(--red)'}} onClick={()=>setFilter('error')}>❌ Erros ({errorCount})</button>
        <button className={`btn ${filter==='warning'?'btn-primary':'btn-ghost'}`} style={{fontSize:12,borderColor:filter==='warning'?undefined:'rgba(245,158,11,.3)',color:filter==='warning'?undefined:'var(--amber)'}} onClick={()=>setFilter('warning')}>⚠️ Alertas ({warningCount})</button>
        <button className={`btn ${filter==='success'?'btn-primary':'btn-ghost'}`} style={{fontSize:12}} onClick={()=>setFilter('success')}>✅ Sucesso ({successCount})</button>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text3)'}}>
          <div className={`tog${autoRefresh?' on':''}`} onClick={()=>setAutoRefresh(!autoRefresh)} style={{width:32,height:18}}></div>
          Auto-refresh
        </div>
        <button className="btn btn-ghost" style={{fontSize:12}} onClick={loadLogs}>🔄 Atualizar</button>
        <button className="btn btn-ghost" style={{fontSize:12,color:'var(--red)'}} onClick={async()=>{await fetch('/api/errors',{method:'DELETE'});loadLogs()}}>🗑 Limpar logs</button>
      </div>
    </div>

    {/* STATS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
      {[
        ['❌ Erros',errorCount,'var(--red)'],
        ['⚠️ Alertas',warningCount,'var(--amber)'],
        ['✅ Sucesso',successCount,'var(--green)'],
        ['📋 Total',logs.length,'var(--accent)'],
      ].map(([l,v,c])=>(
        <div key={l as string} className="card" style={{padding:'14px 16px',borderColor:(l as string).includes('Erro')&&errorCount>0?'rgba(239,68,68,.3)':undefined}}>
          <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>{l}</div>
          <div style={{fontSize:24,fontWeight:700,color:c as string}}>{v}</div>
        </div>
      ))}
    </div>

    {loading && <div className="card"><div className="empty"><div className="empty-sub">Carregando logs do sistema...</div></div></div>}

    {!loading && filtered.length === 0 && (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">{filter==='error'?'✅':'📋'}</div>
          <div className="empty-title">{filter==='error'?'Nenhum erro encontrado!':'Nenhum log encontrado'}</div>
          <div className="empty-sub">{filter==='error'?'O sistema está funcionando sem erros':'Os logs do sistema aparecerão aqui'}</div>
        </div>
      </div>
    )}

    {!loading && filtered.length > 0 && (
      <div className="card">
        <div className="ch" style={{marginBottom:12}}>
          <div className="ct">📋 Logs do sistema</div>
          <div className="cs">{filtered.length} registro{filtered.length!==1?'s':''}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map((log, i) => (
            <div key={i} style={{background:levelBg[log.level]||'var(--bg3)',border:`1px solid ${levelColor[log.level]||'var(--border)'}30`,borderRadius:10,padding:'12px 14px',borderLeft:`3px solid ${levelColor[log.level]||'var(--border)'}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                  <span style={{fontSize:16,flexShrink:0}}>{levelIcon[log.level]||'📋'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:2}}>{log.message||log.event||'Evento do sistema'}</div>
                    {log.source && <div style={{fontSize:11,color:'var(--text3)',fontFamily:'monospace'}}>{log.source}</div>}
                    {log.details && (
                      <div style={{marginTop:6,padding:'6px 10px',background:'rgba(0,0,0,.2)',borderRadius:6,fontSize:11,fontFamily:'monospace',color:'var(--text2)',wordBreak:'break-all'}}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <span style={{background:levelBg[log.level],color:levelColor[log.level],fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:5,fontFamily:'monospace'}}>{(log.level||'info').toUpperCase()}</span>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:4,fontFamily:'monospace'}}>{log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </>
}
