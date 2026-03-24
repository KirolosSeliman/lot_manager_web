import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm page-fade">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-snow to-snow3 flex items-center justify-center text-2xl mb-4 shadow-2xl">◈</div>
          <h1 className="font-display font-black text-snow text-2xl tracking-widest">DEALER FM</h1>
          <p className="text-dim text-xs tracking-widest uppercase mt-1">Finance Manager</p>
        </div>

        {/* Card */}
        <div className="card border-line2">
          <h2 className="font-display font-bold text-snow text-sm tracking-wider mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-dim tracking-widest uppercase font-semibold">Courriel</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="field-input"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-dim tracking-widest uppercase font-semibold">Mot de passe</label>
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field-input"
              />
            </div>

            {error && (
              <div className="bg-stop/10 border border-stop/20 rounded-lg px-3 py-2 text-stop text-xs">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary mt-2 flex items-center justify-center gap-2">
              {loading ? <><div className="spinner" style={{width:16,height:16}} /> Connexion…</> : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-dim text-xs mt-6">
          Accès sur invitation uniquement.
        </p>
      </div>
    </div>
  )
}
