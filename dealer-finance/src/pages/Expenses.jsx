import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, monthlyAmount } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'

const CATEGORIES = [
  { value: 'plates',        label: 'Permis & Plaques' },
  { value: 'subscriptions', label: 'Abonnements'      },
  { value: 'insurance',     label: 'Assurances'       },
  { value: 'office',        label: 'Bureau'           },
  { value: 'other',         label: 'Autre'            },
]
const FREQS = [
  { value: 'monthly', label: 'Mensuel'    },
  { value: 'annual',  label: 'Annuel'     },
  { value: 'weekly',  label: 'Hebdomadaire'},
]

const empty = { name: '', amount: '', frequency: 'monthly', category: 'subscriptions', start_date: new Date().toISOString().split('T')[0], is_active: true }

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState(null) // null = closed, {} = new, {...} = editing
  const [saving,   setSaving]   = useState(false)
  const [tab,      setTab]      = useState('active')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('fixed_expenses').select('*').order('created_at', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const payload = { ...form, amount: Number(form.amount) }
    if (form.id) {
      await supabase.from('fixed_expenses').update(payload).eq('id', form.id)
    } else {
      await supabase.from('fixed_expenses').insert(payload)
    }
    setForm(null)
    await load()
    setSaving(false)
  }

  async function toggle(exp) {
    await supabase.from('fixed_expenses').update({ is_active: !exp.is_active }).eq('id', exp.id)
    setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, is_active: !e.is_active } : e))
  }

  async function del(id) {
    if (!window.confirm('Supprimer cette dépense ?')) return
    await supabase.from('fixed_expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const active   = expenses.filter(e => e.is_active)
  const inactive = expenses.filter(e => !e.is_active)
  const shown    = tab === 'active' ? active : inactive

  const monthlyTotal = active.reduce((s, e) => s + monthlyAmount(e), 0)
  const annualTotal  = monthlyTotal * 12

  const catLabel = (c) => CATEGORIES.find(x => x.value === c)?.label || c
  const freqLabel = (f) => FREQS.find(x => x.value === f)?.label || f

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Dépenses fixes"
        sub="Charges récurrentes"
        actions={
          <button onClick={() => setForm({ ...empty })}
            className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-4 py-2 rounded-lg border-none cursor-pointer hover:opacity-90 transition-opacity">
            + Ajouter
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 page-fade">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total mensuel', value: fmt(monthlyTotal) },
            { label: 'Total annuel',  value: fmt(annualTotal)  },
            { label: 'Dépenses actives', value: active.length },
            { label: 'Archivées',     value: inactive.length  },
          ].map(k => (
            <div key={k.label} className="card">
              <div className="text-[10px] text-dim tracking-widest uppercase mb-2">{k.label}</div>
              <div className="font-display font-bold text-snow text-xl">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface2 rounded-lg p-1 border border-line2 w-fit mb-4">
          {[['active','Actives'],['inactive','Archivées']].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)}
              className="px-4 py-1.5 rounded-md text-xs cursor-pointer border-none transition-all"
              style={{ background: tab===v ? '#1E1E28' : 'transparent', color: tab===v ? '#F4F3F8' : '#55546A', fontWeight: tab===v ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 text-dim text-sm">Aucune dépense {tab === 'active' ? 'active' : 'archivée'}.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map(e => (
              <div key={e.id} className="card flex items-center gap-4 hover:border-line2 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-snow text-sm font-medium">{e.name}</span>
                    <span className="text-[9px] text-dim border border-line2 rounded px-1.5 py-0.5">{catLabel(e.category)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-dim">
                    <span>{freqLabel(e.frequency)}</span>
                    <span>·</span>
                    <span>{fmt(monthlyAmount(e))} / mois</span>
                    {e.frequency !== 'monthly' && <><span>·</span><span>{fmt(e.amount)} / {e.frequency === 'annual' ? 'an' : 'sem'}</span></>}
                  </div>
                </div>
                <div className="font-mono text-sm text-snow font-bold flex-shrink-0">{fmt(e.amount)}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggle(e)}
                    className="btn-ghost px-3 py-1.5 text-[10px]" style={{ color: e.is_active ? '#E09050' : '#2DD4A0' }}>
                    {e.is_active ? 'Archiver' : 'Réactiver'}
                  </button>
                  <button onClick={() => setForm({ ...e })} className="btn-ghost px-3 py-1.5 text-[10px]">✏</button>
                  <button onClick={() => del(e.id)} className="btn-ghost px-3 py-1.5 text-[10px] text-stop border-stop/20">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {form && (
        <div className="fixed inset-0 bg-bg/80 z-50 flex items-end md:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface border border-line2 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-snow text-sm tracking-wider">{form.id ? 'Modifier' : 'Nouvelle dépense'}</h3>
              <button onClick={() => setForm(null)} className="text-dim text-lg bg-transparent border-none cursor-pointer">✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="field-label mb-1.5">Nom de la dépense *</label>
                <input className="field-input" placeholder="ex: Plaque #1, Abonnement OpenLane…"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label mb-1.5">Montant ($) *</label>
                  <input className="field-input" type="number" step="0.01" placeholder="0.00"
                    value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div>
                  <label className="field-label mb-1.5">Fréquence</label>
                  <div className="relative">
                    <select className="field-input appearance-none pr-8 cursor-pointer"
                      value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})}>
                      {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none text-[10px]">▾</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="field-label mb-1.5">Catégorie</label>
                <div className="relative">
                  <select className="field-input appearance-none pr-8 cursor-pointer"
                    value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none text-[10px]">▾</span>
                </div>
              </div>
              <div>
                <label className="field-label mb-1.5">Date de début</label>
                <input className="field-input" type="date"
                  value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
              {form.amount > 0 && form.frequency && (
                <div className="bg-surface2 border border-line2 rounded-lg px-3 py-2 text-xs text-dim">
                  = <span className="text-snow">{fmt(monthlyAmount(form))}</span> / mois · <span className="text-snow">{fmt(monthlyAmount(form) * 12)}</span> / an
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-line">
              <button onClick={() => setForm(null)} className="btn-ghost flex-1 py-2.5">Annuler</button>
              <button onClick={save} disabled={saving}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                {saving ? <><div className="spinner" style={{width:14,height:14}} /> …</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
