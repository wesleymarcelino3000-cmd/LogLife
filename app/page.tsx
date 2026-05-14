'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setError(j.error || 'Usuário ou senha incorretos')
        setLoading(false)
        return
      }
      window.location.href = '/'
    } catch {
      setError('Erro ao conectar ao servidor')
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Space Grotesk',system-ui,sans-serif;background:#080a0f;color:#f0f1f5;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        .bg{position:fixed;inset:0;z-index:0;overflow:hidden;}
        .orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:0.35;}
        .orb1{width:500px;height:500px;background:radial-gradient(circle,#1a237e,transparent);top:-100px;left:-100px;}
        .orb2{width:600px;height:600px;background:radial-gradient(circle,#0d47a1,transparent);bottom:-150px;right:-150px;}
        .orb3{width:300px;height:300px;background:radial-gradient(circle,#1565c0,transparent);top:50%;left:50%;transform:translate(-50%,-50%);}
        .grid{position:fixed;inset:0;z-index:0;background-image:linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px);background-size:60px 60px;}
        .wrap{position:relative;z-index:10;width:100%;max-width:420px;padding:20px;animation:fadein .4s ease;}
        @keyframes fadein{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        .logo-wrap{text-align:center;margin-bottom:28px;}
        .logo-img-wrap{display:inline-block;position:relative;}
        .logo-img-wrap::before{content:'';position:absolute;inset:-20px;background:radial-gradient(circle,rgba(30,64,175,0.25),transparent 70%);border-radius:50%;animation:pglow 3s ease-in-out infinite;}
        @keyframes pglow{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:1;transform:scale(1.05);}}
        .logo-img{width:190px;height:auto;position:relative;z-index:1;filter:drop-shadow(0 0 24px rgba(59,130,246,0.5));}
        .card{background:rgba(12,14,20,0.85);backdrop-filter:blur(24px);border:1px solid rgba(99,102,241,0.18);border-radius:20px;padding:32px;box-shadow:0 0 0 1px rgba(255,255,255,0.04) inset,0 24px 64px rgba(0,0,0,0.6);}
        .card-title{font-size:21px;font-weight:700;letter-spacing:-0.5px;margin-bottom:6px;background:linear-gradient(135deg,#f0f1f5,#9499b3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .card-sub{font-size:13px;color:#5c6080;margin-bottom:26px;}
        .fg{margin-bottom:14px;}
        label{display:block;font-size:10px;color:#5c6080;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:7px;font-weight:600;}
        .iw{position:relative;}
        .ii{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;color:#3c3f55;pointer-events:none;}
        input{width:100%;background:rgba(18,20,28,0.9);border:1px solid rgba(42,45,62,0.9);border-radius:10px;padding:11px 12px 11px 40px;color:#f0f1f5;font-size:14px;outline:none;transition:all .2s;font-family:'Space Grotesk',sans-serif;}
        input:focus{border-color:rgba(99,102,241,0.5);background:rgba(18,20,28,1);box-shadow:0 0 0 3px rgba(99,102,241,0.08);}
        input::placeholder{color:#3c3f55;}
        .btn{width:100%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:6px;font-family:'Space Grotesk',sans-serif;position:relative;overflow:hidden;}
        .btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.08),transparent);}
        .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 28px rgba(29,78,216,0.45);}
        .btn:disabled{opacity:0.6;cursor:not-allowed;}
        .divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#3c3f55;font-size:11px;}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(42,45,62,0.7);}
        .error{background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:10px 14px;font-size:13px;color:#f87171;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
        .footer{text-align:center;margin-top:20px;font-size:11px;color:#2d3055;}
        .spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;margin-right:7px;vertical-align:middle;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .badges{display:flex;justify-content:center;gap:16px;font-size:11px;color:#3c3f55;}
      `}</style>

      <div className="bg">
        <div className="orb orb1"></div>
        <div className="orb orb2"></div>
        <div className="orb orb3"></div>
      </div>
      <div className="grid"></div>

      <div className="wrap">
        <div className="logo-wrap">
          <div className="logo-img-wrap">
            <img src="/logo.png" alt="LogLife" className="logo-img"/>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Bem-vindo de volta</div>
          <div className="card-sub">Entre com seu usuário e senha para acessar o painel</div>

          {error && <div className="error"><span>⚠️</span>{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="fg">
              <label>Usuário</label>
              <div className="iw">
                <span className="ii">👤</span>
                <input
                  type="text"
                  placeholder="seu usuário"
                  value={username}
                  onChange={e=>setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>
            <div className="fg">
              <label>Senha</label>
              <div className="iw">
                <span className="ii">🔒</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? <><span className="spin"></span>Entrando...</> : 'Entrar no sistema →'}
            </button>
          </form>

          <div className="divider">acesso seguro</div>
          <div className="badges">
            <span>🔐 Criptografado</span>
            <span>🛡️ Protegido</span>
            <span>☁️ Vercel</span>
          </div>
        </div>

        <div className="footer">LogLife Shipping OS · {new Date().getFullYear()}</div>
      </div>
    </>
  )
}
