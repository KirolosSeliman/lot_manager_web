import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmt, calcTaxes, getOpenLaneFee, PROVINCES, TAX_RATES } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'

const STEPS = ['Identification', 'Coûts', 'Vente', 'Médias']

const STATUS_OPTS = [
  { value: 'bought', label: 'Acheté',         color: '#6C8EF5', bg: 'rgba(108,142,245,0.1)' },
  { value: 'repair', label: 'En réparation',  color: '#E09050', bg: 'rgba(224,144,80,0.1)'  },
  { value: 'lot',    label: 'Sur le lot',     color: '#2DD4A0', bg: 'rgba(45,212,160,0.1)'  },
  { value: 'sold',   label: 'Vendu',          color: '#8A899A', bg: 'rgba(138,137,154,0.1)' },
]

export default function AddVehicle() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { user } = useAuth()
  const isEdit   = !!id

  const [step,      setStep]      = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [brackets,  setBrackets]  = useState([])
  const [settings,  setSettings]  = useState({})
  const [repairs,   setRepairs]   = useState([{ label: '', amount: '' }])
  const [extras,    setExtras]    = useState([])
  const [photos,    setPhotos]    = useState([])
  const [docs,      setDocs]      = useState([])
  const [uploading, setUploading] = useState(false)
  const [taxRecov,  setTaxRecov]  = useState(false)
  const [taxManual, setTaxManual] = useState(false)
  const [toast,     setToast]     = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      status: 'bought', origin_province: 'QC',
      purchase_source: 'OpenLane', transmission: 'Automatique',
    }
  })

  const watchAll = watch()
  const province      = watchAll.origin_province || 'QC'
  const purchasePrice = Number(watchAll.purchase_price || 0)
  const transport     = Number(watchAll.transport || 0)
  const inspection    = Number(watchAll.inspection || 0)
  const wash          = Number(watchAll.wash || 0)
  const gas           = Number(watchAll.gas || 0)
  const taxManualAmt  = Number(watchAll.tax_manual || 0)

  // Load settings + brackets + existing vehicle if editing
  useEffect(() => {
    async function init() {
      const [bRes, sRes] = await Promise.all([
        supabase.from('openlane_brackets').select('*').order('min_price'),
        supabase.from('settings').select('*'),
      ])
      setBrackets(bRes.data || [])
      const sets = Object.fromEntries((sRes.data || []).map(s => [s.key, s.value]))
      setSettings(sets)

      if (isEdit) {
        const [vRes, cRes] = await Promise.all([
          supabase.from('vehicle_summary').select('*').eq('id', id).single(),
          supabase.from('vehicle_costs').select('*').eq('vehicle_id', id),
        ])
        const v = vRes.data
        if (v) {
          // populate form
          const fields = ['vin','year','make','model','color','transmission',
            'origin_province','purchase_source','purchase_date','status',
            'mileage','notes','sale_price','sale_date','sale_channel','sale_notes']
          fields.forEach(f => { if (v[f] != null) setValue(f, v[f]) })

          // populate costs
          const costs = cRes.data || []
          const getAmt = (type) => costs.find(c => c.cost_type === type)?.amount || ''
          setValue('purchase_price', getAmt('purchase'))
          setValue('transport',   getAmt('transport'))
          setValue('inspection',  getAmt('inspection'))
          setValue('wash',        getAmt('wash'))
          setValue('gas',         getAmt('gas'))
          const repCosts = costs.filter(c => c.cost_type === 'repair')
          if (repCosts.length) setRepairs(repCosts.map(c => ({ label: c.label || '', amount: c.amount })))
          const extraCosts = costs.filter(c => c.cost_type === 'extra')
          if (extraCosts.length) setExtras(extraCosts.map(c => ({ label: c.label || '', amount: c.amount })))
          const tax = costs.find(c => c.cost_type === 'tax')
          if (tax) { setValue('tax_manual', tax.amount); setTaxManual(true); setTaxRecov(tax.is_tax_recoverable) }
        }
      }
    }
    init()
  }, [id, isEdit])

  // Computed values
  const commission = Number(settings.commission_fixed || 250)
  const olFee      = watchAll.purchase_source === 'OpenLane' ? getOpenLaneFee(purchasePrice, brackets) : 0
  const taxAuto    = taxManual ? taxManualAmt : (province === 'QC'
    ? purchasePrice * (TAX_RATES.QC.TPS + TAX_RATES.QC.TVP)
    : calcTaxes(purchasePrice, province))
  const repairTotal = repairs.reduce((s, r) => s + Number(r.amount || 0), 0)
  const extraTotal  = extras.reduce((s, e)  => s + Number(e.amount || 0), 0)
  const totalCost   = purchasePrice + taxAuto + olFee + transport + inspection + wash + gas + repairTotal + extraTotal + commission

  const salePrice   = Number(watchAll.sale_price || 0)
  const netProfit   = salePrice - totalCost

  // Photo upload
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    const newPhotos = await Promise.all(files.map(async (file) => {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('vehicle-photos').upload(path, file)
      if (error) return null
      const { data: { publicUrl } } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
      return { path, url: publicUrl, file }
    }))
    setPhotos(prev => [...prev, ...newPhotos.filter(Boolean)])
    setUploading(false)
  }

  // Doc upload
  const handleDocUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    const newDocs = await Promise.all(files.map(async (file) => {
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('vehicle-documents').upload(path, file)
      if (error) return null
      return { path, name: file.name }
    }))
    setDocs(prev => [...prev, ...newDocs.filter(Boolean)])
    setUploading(false)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Save
  const onSubmit = async (data) => {
    setSaving(true)
    try {
      // 1. Upsert vehicle
      const vehiclePayload = {
        vin: data.vin, year: Number(data.year) || null,
        make: data.make, model: data.model,
        color: data.color, transmission: data.transmission,
        mileage: Number(data.mileage) || null,
        origin_province: data.origin_province,
        purchase_source: data.purchase_source,
        purchase_date: data.purchase_date,
        status: data.status, notes: data.notes,
        created_by: user.id, updated_at: new Date().toISOString(),
      }

      let vehicleId = id
      if (isEdit) {
        await supabase.from('vehicles').update(vehiclePayload).eq('id', id)
        await supabase.from('vehicle_costs').delete().eq('vehicle_id', id)
      } else {
        const { data: ins, error } = await supabase.from('vehicles').insert(vehiclePayload).select('id').single()
        if (error) throw error
        vehicleId = ins.id
      }

      // 2. Insert costs
      const costRows = [
        { vehicle_id: vehicleId, cost_type: 'purchase',   label: 'Prix d\'achat',   amount: purchasePrice },
        { vehicle_id: vehicleId, cost_type: 'tax',        label: 'Taxes',           amount: taxAuto, is_tax_recoverable: taxRecov },
        ...(olFee > 0       ? [{ vehicle_id: vehicleId, cost_type: 'openlane',   label: 'Frais OpenLane', amount: olFee }] : []),
        ...(transport > 0   ? [{ vehicle_id: vehicleId, cost_type: 'transport',  label: 'Transport',      amount: transport }] : []),
        ...(inspection > 0  ? [{ vehicle_id: vehicleId, cost_type: 'inspection', label: 'Inspection',     amount: inspection }] : []),
        ...(wash > 0        ? [{ vehicle_id: vehicleId, cost_type: 'wash',       label: 'Lavage',         amount: wash }] : []),
        ...(gas > 0         ? [{ vehicle_id: vehicleId, cost_type: 'gas',        label: 'Essence',        amount: gas }] : []),
        { vehicle_id: vehicleId, cost_type: 'commission', label: 'Commission',      amount: commission },
        ...repairs.filter(r => r.label && Number(r.amount) > 0).map(r => ({
          vehicle_id: vehicleId, cost_type: 'repair', label: r.label, amount: Number(r.amount)
        })),
        ...extras.filter(e => e.label && Number(e.amount) > 0).map(e => ({
          vehicle_id: vehicleId, cost_type: 'extra', label: e.label, amount: Number(e.amount)
        })),
      ].filter(c => c.amount > 0)

      await supabase.from('vehicle_costs').insert(costRows)

      // 3. Sale info (if sold)
      if (data.status === 'sold' && data.sale_price && data.sale_date) {
        const salePayload = {
          vehicle_id: vehicleId,
          sale_price: Number(data.sale_price),
          sale_date: data.sale_date,
          sale_channel: data.sale_channel || 'private',
          sale_notes: data.sale_notes,
        }
        await supabase.from('vehicle_sales')
          .upsert(salePayload, { onConflict: 'vehicle_id' })
      }

      // 4. Media
      if (photos.length) {
        const mediaRows = photos.map((p, i) => ({
          vehicle_id: vehicleId, type: 'photo',
          storage_path: p.path, display_order: i,
        }))
        await supabase.from('vehicle_media').insert(mediaRows)
      }
      if (docs.length) {
        const docRows = docs.map(d => ({
          vehicle_id: vehicleId, type: 'document',
          storage_path: d.path, label: d.name,
        }))
        await supabase.from('vehicle_media').insert(docRows)
      }

      showToast('✓ Véhicule enregistré')
      setTimeout(() => navigate(`/vehicles/${vehicleId}`), 800)
    } catch (err) {
      showToast('❌ Erreur: ' + err.message)
    }
    setSaving(false)
  }

  const taxInfo = TAX_RATES[province] || TAX_RATES.QC

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={isEdit ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
        sub={isEdit ? 'Modification en cours' : 'Nouveau véhicule'}
        actions={
          <button onClick={handleSubmit(onSubmit)} disabled={saving}
            className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-5 py-2 rounded-lg border-none cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
            {saving ? <><div className="spinner" style={{width:14,height:14}} /> Enregistrement…</> : 'Enregistrer'}
          </button>
        }
      />

      {/* Steps */}
      <div className="flex-shrink-0 bg-surface border-b border-line">
        <div className="grid grid-cols-4">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className="py-3 text-center cursor-pointer border-none bg-transparent border-r border-line last:border-r-0 transition-colors"
              style={{ background: step === i ? 'rgba(255,255,255,0.04)' : 'transparent', borderBottom: step === i ? '2px solid #F4F3F8' : '2px solid transparent' }}>
              <span className="text-[10px] tracking-widest uppercase" style={{ color: step === i ? '#F4F3F8' : '#55546A', fontWeight: step === i ? 600 : 400 }}>
                0{i + 1} · {s}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 page-fade">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">

          {/* ── STEP 0: Identification ── */}
          {step === 0 && (
            <Section icon="🚗" title="Identification du véhicule">
              <div className="grid grid-cols-2 gap-4">
                <FI label="Année"   type="number" placeholder="2022" required error={errors.year} {...register('year', { required: true })} />
                <FI label="Marque"  placeholder="Toyota, Honda…"    required error={errors.make} {...register('make', { required: true })} />
                <FI label="Modèle"  placeholder="Camry, Civic…"     required error={errors.model} {...register('model', { required: true })} />
                <FI label="VIN"     placeholder="1HGBH41JXMN109186" hint="17 caractères"  {...register('vin', { maxLength: 17, minLength: 17 })} />
                <FI label="Kilométrage" type="number" placeholder="45 000" {...register('mileage')} />
                <FI label="Couleur" placeholder="Blanc, Noir…" {...register('color')} />

                <FS label="Transmission" required {...register('transmission')}>
                  {['Automatique', 'Manuelle'].map(o => <option key={o}>{o}</option>)}
                </FS>

                <FS label="Province d'origine" required {...register('origin_province')}>
                  {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </FS>

                <FS label="Source d'achat" {...register('purchase_source')}>
                  {['OpenLane', 'Autre encan', 'Achat privé', 'Reprise'].map(o => <option key={o}>{o}</option>)}
                </FS>

                <FI label="Date d'achat" type="date" required error={errors.purchase_date} {...register('purchase_date', { required: true })} />

                <div className="col-span-2 flex flex-col gap-2">
                  <label className="field-label">Statut <span className="text-snow3">*</span></label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTS.map(s => (
                      <button key={s.value} type="button"
                        onClick={() => setValue('status', s.value)}
                        className="flex-1 min-w-[100px] py-2 px-3 rounded-lg cursor-pointer text-xs font-semibold border transition-all"
                        style={{
                          borderColor: watchAll.status === s.value ? s.color : '#2A2A38',
                          background: watchAll.status === s.value ? s.bg : 'transparent',
                          color: watchAll.status === s.value ? s.color : '#55546A',
                        }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="field-label">Notes internes</label>
                  <textarea placeholder="Remarques, historique…"
                    className="field-input mt-1.5 resize-y min-h-[70px]"
                    {...register('notes')} />
                </div>
              </div>
              <StepNav onNext={() => setStep(1)} />
            </Section>
          )}

          {/* ── STEP 1: Coûts ── */}
          {step === 1 && (
            <Section icon="💰" title="Coûts du véhicule">
              <div className="grid grid-cols-2 gap-4 mb-5">
                <FI label="Prix d'achat ($)" type="number" step="0.01" placeholder="0.00" required {...register('purchase_price', { required: true, min: 0 })} />
                <FI label="Transport ($)"    type="number" step="0.01" placeholder="0.00" hint="Si applicable" {...register('transport')} />
                <FI label="Inspection pré-achat ($)" type="number" step="0.01" placeholder="0.00"
                  hint={province !== 'QC' ? '⚠ Requis si hors Québec' : undefined} {...register('inspection')} />
                <FI label="Lavage / Détailing ($)" type="number" step="0.01" placeholder="0.00" {...register('wash')} />
                <FI label="Essence ($)" type="number" step="0.01" placeholder="0.00" {...register('gas')} />

                {/* Taxes */}
                <div className="col-span-2 bg-surface2 border border-line2 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-snow2 text-xs">{taxInfo.label} — {((taxInfo.TPS + taxInfo.TVP) * 100).toFixed(2)}%</span>
                    <span className="font-mono text-xs text-snow">{fmt(taxAuto)}</span>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-dim">
                      <input type="checkbox" checked={taxRecov} onChange={e => setTaxRecov(e.target.checked)} className="accent-white" />
                      Taxes récupérables (dealer enregistré)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-dim">
                      <input type="checkbox" checked={taxManual} onChange={e => setTaxManual(e.target.checked)} className="accent-white" />
                      Montant manuel
                    </label>
                  </div>
                  {taxManual && <FI label="Montant de taxes ($)" type="number" step="0.01" {...register('tax_manual')} />}
                </div>
              </div>

              {/* Réparations */}
              <div className="mb-5">
                <label className="field-label mb-2">Réparations</label>
                <div className="flex flex-col gap-2">
                  {repairs.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={r.label} onChange={e => { const n=[...repairs]; n[i].label=e.target.value; setRepairs(n) }}
                        placeholder="Description (ex: Pneus d'hiver)" className="field-input flex-1 text-xs py-2" />
                      <input value={r.amount} onChange={e => { const n=[...repairs]; n[i].amount=e.target.value; setRepairs(n) }}
                        type="number" placeholder="0.00" className="field-input w-24 text-xs py-2 text-right" />
                      {repairs.length > 1 && (
                        <button type="button" onClick={() => setRepairs(repairs.filter((_,j) => j!==i))}
                          className="btn-ghost px-3 text-stop">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setRepairs([...repairs, { label: '', amount: '' }])}
                    className="btn-ghost self-start">+ Ajouter une réparation</button>
                </div>
              </div>

              {/* Extras */}
              <div className="mb-5">
                <label className="field-label mb-2">Autres coûts</label>
                <div className="flex flex-col gap-2">
                  {extras.map((e, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={e.label} onChange={ev => { const n=[...extras]; n[i].label=ev.target.value; setExtras(n) }}
                        placeholder="Description" className="field-input flex-1 text-xs py-2" />
                      <input value={e.amount} onChange={ev => { const n=[...extras]; n[i].amount=ev.target.value; setExtras(n) }}
                        type="number" placeholder="0.00" className="field-input w-24 text-xs py-2 text-right" />
                      <button type="button" onClick={() => setExtras(extras.filter((_,j) => j!==i))}
                        className="btn-ghost px-3 text-stop">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setExtras([...extras, { label: '', amount: '' }])}
                    className="btn-ghost self-start">+ Ajouter un coût</button>
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="border border-line rounded-lg overflow-hidden">
                <div className="bg-surface2 px-4 py-2 border-b border-line">
                  <span className="text-[10px] text-dim tracking-widest uppercase font-semibold">Récapitulatif des coûts</span>
                </div>
                <div className="p-1">
                  {purchasePrice > 0 && <CostRow label="Prix d'achat" val={purchasePrice} />}
                  {taxAuto > 0        && <CostRow label={`Taxes (${taxInfo.label})`} val={taxAuto} auto />}
                  {olFee > 0          && <CostRow label="Frais OpenLane" val={olFee} auto />}
                  {transport > 0      && <CostRow label="Transport" val={transport} />}
                  {inspection > 0     && <CostRow label="Inspection" val={inspection} />}
                  {wash > 0           && <CostRow label="Lavage" val={wash} />}
                  {gas > 0            && <CostRow label="Essence" val={gas} />}
                  {repairTotal > 0    && <CostRow label="Réparations" val={repairTotal} />}
                  {extraTotal > 0     && <CostRow label="Autres coûts" val={extraTotal} />}
                  <CostRow label="Commission" val={commission} auto />
                </div>
                <div className="p-2">
                  <CostRow label="COÛT DE REVIENT TOTAL" val={totalCost} total />
                </div>
              </div>

              <StepNav onPrev={() => setStep(0)} onNext={() => setStep(2)} />
            </Section>
          )}

          {/* ── STEP 2: Vente ── */}
          {step === 2 && (
            <Section icon="💵" title="Informations de vente">
              {watchAll.status !== 'sold' ? (
                <div className="text-center py-8 text-dim text-sm">
                  <div className="text-3xl mb-3 opacity-30">🔒</div>
                  <p>Cette section est disponible quand le statut est <strong className="text-snow2">Vendu</strong>.</p>
                  <button type="button" onClick={() => { setValue('status','sold'); setStep(0) }}
                    className="text-snow2 text-xs underline mt-2 cursor-pointer bg-transparent border-none">
                    Changer le statut à Vendu
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FI label="Prix de vente ($)" type="number" step="0.01" placeholder="0.00" required {...register('sale_price', { required: watchAll.status==='sold' })} />
                  <FI label="Date de vente" type="date" required {...register('sale_date', { required: watchAll.status==='sold' })} />
                  <FS label="Canal de vente" col="col-span-2" {...register('sale_channel')}>
                    {[['marketplace','Marketplace (Facebook)'],['private','Vente privée'],['auction','Encan (OpenLane)'],['other','Autre']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </FS>
                  <div className="col-span-2">
                    <label className="field-label">Notes de vente</label>
                    <textarea className="field-input mt-1.5 resize-y min-h-[60px]" placeholder="Remarques sur la vente…" {...register('sale_notes')} />
                  </div>
                  {salePrice > 0 && (
                    <div className="col-span-2 bg-surface2 border border-line2 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-dim text-xs">Profit net estimé</span>
                        <span className={`font-mono font-bold text-lg ${netProfit >= 0 ? 'text-go' : 'text-stop'}`}>{fmt(netProfit)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <StepNav onPrev={() => setStep(1)} onNext={() => setStep(3)} />
            </Section>
          )}

          {/* ── STEP 3: Médias ── */}
          {step === 3 && (
            <Section icon="📷" title="Photos & Documents">
              {/* Photos */}
              <div className="mb-5">
                <label className="field-label mb-2">Photos (max 10)</label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-line2">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setPhotos(photos.filter((_,j)=>j!==i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-bg/80 rounded-full text-snow text-xs flex items-center justify-center cursor-pointer border-none">✕</button>
                    </div>
                  ))}
                  {photos.length < 10 && (
                    <label className="aspect-square rounded-lg border border-dashed border-line3 flex flex-col items-center justify-center cursor-pointer hover:border-snow3 transition-colors">
                      <span className="text-2xl text-dim2">📷</span>
                      <span className="text-[9px] text-dim mt-1">Ajouter</span>
                      <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                        onChange={handlePhotoUpload} />
                    </label>
                  )}
                </div>
                {uploading && <p className="text-dim text-xs flex items-center gap-2"><div className="spinner" style={{width:12,height:12}} /> Téléversement…</p>}
              </div>

              {/* Documents */}
              <div className="mb-5">
                <label className="field-label mb-2">Documents PDF</label>
                <div className="flex gap-2 flex-wrap">
                  {docs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface2 border border-line2 rounded-lg px-3 py-2">
                      <span className="text-sm">📄</span>
                      <span className="text-xs text-snow2">{d.name}</span>
                      <button type="button" onClick={() => setDocs(docs.filter((_,j)=>j!==i))}
                        className="text-dim text-xs cursor-pointer bg-transparent border-none hover:text-stop">✕</button>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 btn-ghost cursor-pointer">
                    <span>📎</span>
                    <span>Ajouter un PDF</span>
                    <input type="file" accept=".pdf" multiple className="hidden" onChange={handleDocUpload} />
                  </label>
                </div>
              </div>

              <StepNav onPrev={() => setStep(2)} />

              {/* Final save */}
              <button type="button" onClick={handleSubmit(onSubmit)} disabled={saving}
                className="btn-primary mt-2 flex items-center justify-center gap-2">
                {saving ? <><div className="spinner" style={{width:16,height:16}} /> Enregistrement…</> : 'ENREGISTRER LE VÉHICULE'}
              </button>
            </Section>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-line3 rounded-xl px-5 py-3 text-sm text-snow shadow-2xl z-50 animate-pulse">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function Section({ icon, title, children }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-line">
        <div className="w-7 h-7 rounded-lg bg-surface2 border border-line2 flex items-center justify-center text-sm">{icon}</div>
        <span className="text-[11px] font-bold text-snow tracking-widest uppercase">{title}</span>
      </div>
      {children}
    </div>
  )
}

const FI = ({ label, hint, error, col, className = '', ...props }) => (
  <div className={`flex flex-col gap-1.5 ${col || ''}`}>
    <label className="field-label">{label}</label>
    <input className={`field-input ${error ? 'border-stop' : ''} ${className}`} {...props} />
    {hint && <span className="text-[10px] text-dim">{hint}</span>}
    {error && <span className="text-[10px] text-stop">Champ requis</span>}
  </div>
)

const FS = ({ label, children, col, ...props }) => (
  <div className={`flex flex-col gap-1.5 ${col || ''}`}>
    <label className="field-label">{label}</label>
    <div className="relative">
      <select className="field-input appearance-none pr-8 cursor-pointer" {...props}>{children}</select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none text-[10px]">▾</span>
    </div>
  </div>
)

function CostRow({ label, val, auto, total }) {
  return (
    <div className={`flex items-center justify-between px-4 ${total ? 'py-3 bg-white/[0.05] border border-line3 rounded-lg' : 'py-2 border-b border-line last:border-none'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${total ? 'text-snow font-bold' : 'text-snow2'}`}>{label}</span>
        {auto && <span className="text-[9px] text-dim border border-line2 rounded px-1">auto</span>}
      </div>
      <span className={`font-mono text-xs ${total ? 'text-snow font-bold text-sm' : 'text-snow2'}`}>{fmt(val)}</span>
    </div>
  )
}

function StepNav({ onPrev, onNext }) {
  return (
    <div className="flex gap-3 mt-5 pt-4 border-t border-line">
      {onPrev && <button type="button" onClick={onPrev} className="btn-ghost flex-1">← Précédent</button>}
      {onNext && <button type="button" onClick={onNext} className="bg-snow text-bg font-display font-bold text-xs tracking-widest py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 transition-opacity flex-1">Suivant →</button>}
    </div>
  )
}
