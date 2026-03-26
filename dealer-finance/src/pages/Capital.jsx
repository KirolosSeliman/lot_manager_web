import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmt, fmtDate } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'

export default function Capital() {
  const { user }  = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({ amount: '', label: 'Ajout de capital', note: '', date: new Date().toISOString().split('T')[0] })
  const [toast,    setToast]    = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('capital_transactions').select('*').order('date', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    const { error } = await supabase.from('capital_transactions').insert({
      amount:     Number(form.amount),
      label:      form.label || 'Ajout de capital',
      note:       form.note  || null,
      date:       form.date,
      created_by: user.id,
    })
    if (error) {
      setToast('❌ ' + error.message)
    } else {
      setToast('✓ Capital ajouté !')
      setShowForm(false)
      setForm({ amount: '', label: 'Ajout de capital', note: '', date: new Date().toISOString().split('T')[0] })
      await load()
    }
    setSaving(false)
    setTimeout(() => setToast(''), 3000)
  }

  async function del(id) {
    if (!window.confirm('Supprimer cette transaction ?')) return
    await supabase.from('capital_transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const total = transactions.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Capital"
        sub="Argent investi dans la compagnie"
        actions={
          <button onClick={() => setShowForm(true)}
            className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-4 py-2 rounded-lg border-none cursor-pointer hover:opacity-90">
            + Ajouter du capital
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 page-fade">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="card md:col-span-1">
            <div className="text-[10px] text-dim tracking-widest uppercase mb-2">Capital total injecté</div>
            <div className="font-display font-extrabold text-snow text-2xl tracking-tight">{fmt(total)}</div>
          </div>
          <div className="card">
            <div className="text-[10px] text-dim tracking-widest uppercase mb-2">Nombre de transactions</div>
            <div className="font-display font-extrabold text-snow text-2xl tracking-tight">{transactions.length}</div>
          </div>
          <div className="card md:col-span-1">
            <div className="text-[10px] text-dim tracking-widest uppercase mb-2">Dernière injection</div>
            <div className="font-display font-extrabold text-snow text-xl tracking-tight">
              {transactions[0] ? fmtDate(transactions[0].date) : '—'}
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-info/10 border border-info/20 rounded-xl px-4 py-3 mb-5 flex gap-3 text-sm text-info">
          <span className="text-lg flex-shrink-0">💡</span>
          <div>
            <p className="font-semibold mb-1">Comment fonctionne le capital ?</p>
            <p className="text-xs text-info/80 leading-relaxed">
              Chaque fois que tu mets de l'argent dans la compagnie pour acheter des voitures, enregistre-le ici.
              Le <strong>cash libre</strong> sur le dashboard = Capital total + Revenus des ventes − Investissement dans les voitures actives − Dépenses fixes.
            </p>
          </div>
        </div>

        {/* Transaction list */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-dim">
            <div className="text-5xl mb-3 opacity-10">💰</div>
            <p className="text-sm mb-3">Aucune injection de capital enregistrée.</p>
            <button onClick={() => setShowForm(true)}
              className="text-snow2 text-xs underline cursor-pointer bg-transparent border-none">
              Ajouter la première →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map(t => (
              <div key={t.id} className="card flex items-center gap-4 hover:border-line2 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-go/10 border border-go/20 flex items-center justify-center text-lg flex-shrink-0">
                  💵
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-snow text-sm font-medium">{t.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-dim">
                    <span>{fmtDate(t.date)}</span>
                    {t.note && <><span>·</span><span className="truncate">{t.note}</span></>}
                  </div>
                </div>
                <div className="font-mono text-lg font-bold text-go flex-shrink-0">+{fmt(t.amount)}</div>
                <button onClick={() => del(t.id)}
                  className="btn-ghost px-2 py-2 text-[10px] text-stop border-stop/20 flex-shrink-0">🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add capital modal */}
      {showForm && (
        <div className="fixed inset-0 bg-bg/80 z-50 flex items-end md:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface border border-line2 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-snow text-sm tracking-wider">Ajouter du capital</h3>
              <button onClick={() => setShowForm(false)} className="text-dim text-lg bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="field-label mb-1.5">Montant ($) *</label>
                <input type="number" step="0.01" placeholder="5 000.00"
                  className="field-input text-lg font-mono"
                  value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              </div>
              <div>
                <label className="field-label mb-1.5">Description</label>
                <input type="text" placeholder="Ajout de capital"
                  className="field-input"
                  value={form.label} onChange={e => setForm({...form, label: e.target.value})} />
              </div>
              <div>
                <label className="field-label mb-1.5">Date</label>
                <input type="date" className="field-input"
                  value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div>
                <label className="field-label mb-1.5">Note (optionnel)</label>
                <textarea placeholder="Source de l'argent, raison…"
                  className="field-input resize-none min-h-[60px]"
                  value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
              </div>

              {form.amount > 0 && (
                <div className="bg-go/10 border border-go/20 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-dim text-xs">Nouveau capital total</span>
                  <span className="font-mono font-bold text-go">{fmt(total + Number(form.amount))}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-line">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 py-2.5">Annuler</button>
              <button onClick={save} disabled={saving || !form.amount}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-40">
                {saving ? <><div className="spinner" style={{width:14,height:14}}/> …</> : '+ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-line3 rounded-xl px-5 py-3 text-sm text-snow shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
