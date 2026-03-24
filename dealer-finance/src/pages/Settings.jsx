import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'

const PROVINCE_NAMES = {
  QC:'Québec', ON:'Ontario', AB:'Alberta', BC:'Colombie-Britannique',
  MB:'Manitoba', SK:'Saskatchewan', NS:'Nouvelle-Écosse',
  NB:'Nouveau-Brunswick', PE:'Î.-P.-É.', NL:'T.-N.-L.',
}

export default function Settings() {
  const [brackets,   setBrackets]   = useState([])
  const [settings,   setSettings]   = useState({})
  const [users,      setUsers]      = useState([])
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('employee')
  const [inviting,    setInviting]    = useState(false)
  const [taxRates,    setTaxRates]    = useState({})
  const [tab,         setTab]         = useState('openlane')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [bRes, sRes, pRes] = await Promise.all([
      supabase.from('openlane_brackets').select('*').order('min_price'),
      supabase.from('settings').select('*'),
      supabase.from('profiles').select('*').order('created_at'),
    ])
    setBrackets(bRes.data || [])
    const sets = Object.fromEntries((sRes.data || []).map(s => [s.key, s.value]))
    setSettings(sets)
    try { setTaxRates(typeof sets.tax_rates === 'string' ? JSON.parse(sets.tax_rates) : sets.tax_rates || {}) } catch {}
    setUsers(pRes.data || [])
  }

  const toast = (msg) => { setSaved(msg); setTimeout(() => setSaved(''), 2500) }

  // Save brackets
  async function saveBrackets() {
    setSaving(true)
    await supabase.from('openlane_brackets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('openlane_brackets').insert(
      brackets.map(({ id, ...b }) => ({ min_price: Number(b.min_price), max_price: b.max_price ? Number(b.max_price) : null, fee_amount: Number(b.fee_amount) }))
    )
    toast('✓ Brackets sauvegardés')
    setSaving(false)
  }

  // Save global settings
  async function saveSettings() {
    setSaving(true)
    await Promise.all([
      supabase.from('settings').upsert({ key: 'commission_fixed',    value: String(settings.commission_fixed || 250), updated_at: new Date().toISOString() }),
      supabase.from('settings').upsert({ key: 'lot_time_alert_days', value: String(settings.lot_time_alert_days || 60), updated_at: new Date().toISOString() }),
    ])
    toast('✓ Paramètres sauvegardés')
    setSaving(false)
  }

  // Save tax rates
  async function saveTaxRates() {
    setSaving(true)
    await supabase.from('settings').upsert({ key: 'tax_rates', value: taxRates, updated_at: new Date().toISOString() })
    toast('✓ Taux de taxes sauvegardés')
    setSaving(false)
  }

  // Invite user
  async function inviteUser() {
    if (!inviteEmail) return
    setInviting(true)
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
      data: { role: inviteRole }
    })
    if (error) toast('❌ ' + error.message)
    else { toast('✓ Invitation envoyée'); setInviteEmail('') }
    setInviting(false)
  }

  const addBracket = () => setBrackets([...brackets, { min_price: '', max_price: '', fee_amount: '' }])
  const delBracket = (i) => setBrackets(brackets.filter((_, j) => j !== i))
  const updBracket = (i, key, val) => { const n = [...brackets]; n[i] = { ...n[i], [key]: val }; setBrackets(n) }

  const TABS = [
    { id: 'openlane', label: 'Frais OpenLane' },
    { id: 'taxes',    label: 'Taxes provinces' },
    { id: 'global',   label: 'Général' },
    { id: 'users',    label: 'Utilisateurs' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Paramètres" sub="Configuration de l'application" />

      {/* Tabs */}
      <div className="flex-shrink-0 bg-surface border-b border-line px-4 md:px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-5 py-3.5 text-xs cursor-pointer bg-transparent border-none whitespace-nowrap transition-colors"
              style={{ color: tab===t.id ? '#F4F3F8' : '#55546A', fontWeight: tab===t.id ? 600 : 400, borderBottom: tab===t.id ? '2px solid #F4F3F8' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 page-fade">
        <div className="max-w-2xl mx-auto">

          {/* ── OpenLane ── */}
          {tab === 'openlane' && (
            <div className="flex flex-col gap-4">
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-1">Brackets de frais OpenLane</div>
                    <p className="text-dim text-xs">Mettez à jour avec vos vrais brackets de votre portail membre.</p>
                  </div>
                </div>

                <div className="border border-line rounded-lg overflow-hidden mb-3">
                  <div className="grid grid-cols-3 gap-0 bg-surface2 border-b border-line px-4 py-2">
                    {['Prix min ($)', 'Prix max ($)', 'Frais ($)'].map(h => (
                      <span key={h} className="text-[10px] text-dim tracking-widest uppercase font-semibold">{h}</span>
                    ))}
                  </div>
                  {brackets.map((b, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-line last:border-none items-center">
                      <input type="number" value={b.min_price} onChange={e => updBracket(i, 'min_price', e.target.value)}
                        className="field-input text-xs py-1.5" placeholder="0" />
                      <input type="number" value={b.max_price || ''} onChange={e => updBracket(i, 'max_price', e.target.value)}
                        className="field-input text-xs py-1.5" placeholder="illimité" />
                      <div className="flex gap-2">
                        <input type="number" value={b.fee_amount} onChange={e => updBracket(i, 'fee_amount', e.target.value)}
                          className="field-input text-xs py-1.5 flex-1" placeholder="0" />
                        <button onClick={() => delBracket(i)} className="text-stop text-xs bg-transparent border-none cursor-pointer px-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onClick={addBracket} className="btn-ghost text-xs flex-1">+ Ajouter un bracket</button>
                  <button onClick={saveBrackets} disabled={saving}
                    className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-5 py-2 rounded-lg border-none cursor-pointer hover:opacity-90 flex-1 flex items-center justify-center gap-2">
                    {saving ? <><div className="spinner" style={{width:12,height:12}}/> …</> : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Taxes ── */}
          {tab === 'taxes' && (
            <div className="card">
              <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-4">Taux de taxes par province</div>
              <div className="flex flex-col gap-0 border border-line rounded-lg overflow-hidden mb-4">
                <div className="grid grid-cols-4 bg-surface2 border-b border-line px-4 py-2">
                  {['Province', 'TPS (%)', 'Taxe prov. (%)', 'Total'].map(h => (
                    <span key={h} className="text-[10px] text-dim tracking-wider uppercase font-semibold">{h}</span>
                  ))}
                </div>
                {Object.entries(taxRates).map(([code, rates]) => {
                  const total = ((rates.TPS || 0) + (rates.TVP || 0)) * 100
                  return (
                    <div key={code} className="grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-line last:border-none items-center">
                      <span className="text-snow2 text-xs font-medium">{PROVINCE_NAMES[code] || code}</span>
                      <input type="number" step="0.001" value={((rates.TPS || 0) * 100).toFixed(3)}
                        onChange={e => setTaxRates(t => ({ ...t, [code]: { ...t[code], TPS: Number(e.target.value) / 100 } }))}
                        className="field-input text-xs py-1.5" />
                      <input type="number" step="0.001" value={((rates.TVP || 0) * 100).toFixed(3)}
                        onChange={e => setTaxRates(t => ({ ...t, [code]: { ...t[code], TVP: Number(e.target.value) / 100 } }))}
                        className="field-input text-xs py-1.5" />
                      <span className="font-mono text-xs text-snow">{total.toFixed(2)}%</span>
                    </div>
                  )
                })}
              </div>
              <button onClick={saveTaxRates} disabled={saving}
                className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 w-full">
                {saving ? 'Enregistrement…' : 'Enregistrer les taux'}
              </button>
            </div>
          )}

          {/* ── Général ── */}
          {tab === 'global' && (
            <div className="card flex flex-col gap-4">
              <div className="text-[10px] text-dim tracking-widest uppercase font-semibold">Paramètres globaux</div>
              <div>
                <label className="field-label mb-1.5">Commission fixe par véhicule ($)</label>
                <input type="number" className="field-input max-w-xs"
                  value={settings.commission_fixed || 250}
                  onChange={e => setSettings(s => ({ ...s, commission_fixed: e.target.value }))} />
                <p className="text-dim text-xs mt-1">Ajoutée automatiquement au coût de revient de chaque véhicule.</p>
              </div>
              <div>
                <label className="field-label mb-1.5">Seuil d'alerte de lot time (jours)</label>
                <input type="number" className="field-input max-w-xs"
                  value={settings.lot_time_alert_days || 60}
                  onChange={e => setSettings(s => ({ ...s, lot_time_alert_days: e.target.value }))} />
                <p className="text-dim text-xs mt-1">Un badge d'alerte rouge apparaît sur les véhicules dépassant ce seuil.</p>
              </div>
              <div>
                <label className="field-label mb-1.5">Devise</label>
                <div className="field-input max-w-xs bg-surface3 cursor-not-allowed text-dim">CAD — Dollar canadien</div>
              </div>
              <button onClick={saveSettings} disabled={saving}
                className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 self-start">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* ── Utilisateurs ── */}
          {tab === 'users' && (
            <div className="flex flex-col gap-4">
              {/* Invite */}
              <div className="card">
                <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-4">Inviter un utilisateur</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="field-label mb-1.5">Courriel</label>
                    <input type="email" className="field-input" placeholder="employe@example.com"
                      value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label mb-1.5">Rôle</label>
                    <div className="relative max-w-xs">
                      <select className="field-input appearance-none pr-8 cursor-pointer"
                        value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                        <option value="employee">Employé</option>
                        <option value="admin">Administrateur</option>
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none text-[10px]">▾</span>
                    </div>
                  </div>
                  <button onClick={inviteUser} disabled={inviting || !inviteEmail}
                    className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-5 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 self-start disabled:opacity-40">
                    {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
                  </button>
                </div>
              </div>

              {/* User list */}
              <div className="card">
                <div className="text-[10px] text-dim tracking-widest uppercase font-semibold mb-4">Utilisateurs ({users.length})</div>
                <div className="flex flex-col gap-2">
                  {users.map(u => (
                    <div key={u.id} className="flex items-center gap-3 py-2 border-b border-line last:border-none">
                      <div className="w-8 h-8 rounded-full bg-surface2 border border-line2 flex items-center justify-center text-xs font-bold text-snow2 flex-shrink-0">
                        {u.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-snow2 text-sm font-medium truncate">{u.full_name || 'Sans nom'}</div>
                      </div>
                      <span className={`badge text-[10px] px-2 py-0.5 ${u.role === 'admin' ? 'badge-lot' : 'badge-bought'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Employé'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {saved && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-line3 rounded-xl px-5 py-3 text-sm text-snow shadow-2xl z-50">
          {saved}
        </div>
      )}
    </div>
  )
}
