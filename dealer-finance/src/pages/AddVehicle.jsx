import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmt, getOpenLaneFee, PROVINCES, TAX_RATES } from '../lib/utils'
import PageHeader from '../components/ui/PageHeader'

const STEPS = ['Identification', 'Coûts', 'Vente', 'Médias']

const STATUS_OPTS = [
  { value: 'bought', label: 'Acheté',        color: '#6C8EF5', bg: 'rgba(108,142,245,0.1)' },
  { value: 'repair', label: 'En réparation', color: '#E09050', bg: 'rgba(224,144,80,0.1)'  },
  { value: 'lot',    label: 'Sur le lot',    color: '#2DD4A0', bg: 'rgba(45,212,160,0.1)'  },
  { value: 'sold',   label: 'Vendu',         color: '#8A899A', bg: 'rgba(138,137,154,0.1)' },
]

function PocketToggle({ val, set }) {
  return (
    <button type="button" onClick={() => set(!val)}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-all flex-shrink-0"
      style={{
        background:  val ? 'rgba(108,142,245,0.12)' : 'transparent',
        borderColor: val ? '#6C8EF5' : '#2A2A38',
        color:       val ? '#6C8EF5' : '#55546A',
      }}>
      🧾 {val ? 'Ma poche ✓' : 'Ma poche'}
    </button>
  )
}

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

const FI = ({ label, hint, error, col, ...props }) => (
  <div className={`flex flex-col gap-1.5 ${col || ''}`}>
    <label className="field-label">{label}</label>
    <input className={`field-input ${error ? 'border-stop' : ''}`} {...props} />
    {hint  && <span className="text-[10px] text-dim">{hint}</span>}
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

function CostRow({ label, val, auto, total, pocket }) {
  return (
    <div className={`flex items-center justify-between px-4
      ${total ? 'py-3 bg-white/[0.05] border border-line3 rounded-lg mb-1' : 'py-2 border-b border-line last:border-none'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${total ? 'text-snow font-bold' : pocket ? 'text-info' : 'text-snow2'}`}>{label}</span>
        {auto   && !total && <span className="text-[9px] text-dim border border-line2 rounded px-1">auto</span>}
        {pocket && !total && <span className="text-[9px] text-info border border-info/30 rounded px-1">🧾 poche</span>}
      </div>
      <span className={`font-mono text-xs ${total ? 'text-snow font-bold text-sm' : pocket && !total ? 'text-info' : 'text-snow2'}`}>
        {fmt(val)}
      </span>
    </div>
  )
}

function StepNav({ onPrev, onNext }) {
  return (
    <div className="flex gap-3 mt-5 pt-4 border-t border-line">
      {onPrev && <button type="button" onClick={onPrev} className="btn-ghost flex-1 py-2.5">← Précédent</button>}
      {onNext && (
        <button type="button" onClick={onNext}
          className="bg-snow text-bg font-display font-bold text-xs tracking-widest py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 flex-1">
          Suivant →
        </button>
      )}
    </div>
  )
}

export default function AddVehicle() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { user } = useAuth()
  const isEdit   = !!id

  const [step,     setStep]     = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [brackets, setBrackets] = useState([])
  const [settings, setSettings] = useState({})
  const [repairs,  setRepairs]  = useState([{ label: '', amount: '', pocket: false }])
  const [extras,   setExtras]   = useState([])
  const [photos,   setPhotos]   = useState([])
  const [docs,     setDocs]     = useState([])
  const [uploading,setUploading]= useState(false)
  const [taxRecov, setTaxRecov] = useState(false)
  const [taxManual,setTaxManual]= useState(false)
  const [toast,    setToast]    = useState({ msg: '', type: 'ok' })

  const [transportPocket, setTransportPocket] = useState(false)
  const [inspectPocket,   setInspectPocket]   = useState(false)
  const [washPocket,      setWashPocket]      = useState(false)
  const [gasPocket,       setGasPocket]       = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { status: 'bought', origin_province: 'QC', purchase_source: 'OpenLane', transmission: 'Automatique' }
  })
  const w = watch()

  const province      = w.origin_province || 'QC'
  const purchasePrice = Number(w.purchase_price || 0)
  const transport     = Number(w.transport   || 0)
  const inspection    = Number(w.inspection  || 0)
  const wash          = Number(w.wash        || 0)
  const gas           = Number(w.gas         || 0)
  const taxManualAmt  = Number(w.tax_manual  || 0)

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
          ['vin','year','make','model','color','transmission','origin_province',
           'purchase_source','purchase_date','status','mileage','notes',
           'sale_price','sale_date','sale_channel','sale_notes'].forEach(f => {
            if (v[f] != null) setValue(f, v[f])
          })
          const costs = cRes.data || []
          const get   = t => costs.find(c => c.cost_type === t)?.amount || ''
          setValue('purchase_price', get('purchase'))
          setValue('transport',      get('transport'))
          setValue('inspection',     get('inspection'))
          setValue('wash',           get('wash'))
          setValue('gas',            get('gas'))
          const reps = costs.filter(c => c.cost_type === 'repair')
          if (reps.length) setRepairs(reps.map(c => ({ label: c.label||'', amount: c.amount, pocket: c.paid_out_of_pocket||false })))
          const exts = costs.filter(c => c.cost_type === 'extra')
          if (exts.length) setExtras(exts.map(c => ({ label: c.label||'', amount: c.amount, pocket: c.paid_out_of_pocket||false })))
          const tax = costs.find(c => c.cost_type === 'tax')
          if (tax) { setValue('tax_manual', tax.amount); setTaxManual(true); setTaxRecov(tax.is_tax_recoverable) }
          setTransportPocket(costs.find(c=>c.cost_type==='transport')?.paid_out_of_pocket||false)
          setInspectPocket(costs.find(c=>c.cost_type==='inspection')?.paid_out_of_pocket||false)
          setWashPocket(costs.find(c=>c.cost_type==='wash')?.paid_out_of_pocket||false)
          setGasPocket(costs.find(c=>c.cost_type==='gas')?.paid_out_of_pocket||false)
        }
      }
    }
    init()
  }, [id, isEdit])

  const commission  = Number(settings.commission_fixed || 250)
  const olFee       = w.purchase_source === 'OpenLane' ? getOpenLaneFee(purchasePrice, brackets) : 0
  const rates       = TAX_RATES[province] || TAX_RATES.QC
  const taxAuto     = taxManual ? taxManualAmt : purchasePrice * (rates.TPS + rates.TVP)
  const repairTotal = repairs.reduce((s,r) => s + Number(r.amount||0), 0)
  const extraTotal  = extras.reduce((s,e)  => s + Number(e.amount||0), 0)
  const totalCost   = purchasePrice + taxAuto + olFee + transport + inspection + wash + gas + repairTotal + extraTotal + commission
  const pocketTotal = (transportPocket?transport:0)+(inspectPocket?inspection:0)+(washPocket?wash:0)+(gasPocket?gas:0)+
    repairs.filter(r=>r.pocket).reduce((s,r)=>s+Number(r.amount||0),0)+
    extras.filter(e=>e.pocket).reduce((s,e)=>s+Number(e.amount||0),0)
  const companyCost = totalCost - pocketTotal
  const salePrice   = Number(w.sale_price || 0)
  const netProfit   = salePrice - totalCost

  const showToast = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast({msg:'',type:'ok'}),3500) }

  const onSubmit = async (data) => {
    if (!data.make || !data.model) { showToast('❌ Marque et modèle requis','err'); setStep(0); return }
    setSaving(true)
    try {
      const vPayload = {
        vin: data.vin||null, year: Number(data.year)||null,
        make: data.make, model: data.model, color: data.color||null,
        transmission: data.transmission||'Automatique',
        mileage: Number(data.mileage)||null,
        origin_province: data.origin_province||'QC',
        purchase_source: data.purchase_source||null,
        purchase_date: data.purchase_date||null,
        status: data.status||'bought', notes: data.notes||null,
        created_by: user.id, updated_at: new Date().toISOString(),
      }

      let vehicleId = id
      if (isEdit) {
        const { error } = await supabase.from('vehicles').update(vPayload).eq('id', id)
        if (error) throw new Error(error.message)
        await supabase.from('vehicle_costs').delete().eq('vehicle_id', id)
      } else {
        const { data: ins, error } = await supabase.from('vehicles').insert(vPayload).select('id').single()
        if (error) throw new Error(error.message)
        vehicleId = ins.id
      }

      const costRows = [
        ...(purchasePrice>0 ? [{ vehicle_id:vehicleId, cost_type:'purchase', label:"Prix d'achat", amount:purchasePrice, paid_out_of_pocket:false }] : []),
        ...(taxAuto>0       ? [{ vehicle_id:vehicleId, cost_type:'tax',      label:'Taxes',        amount:taxAuto,       is_tax_recoverable:taxRecov, paid_out_of_pocket:false }] : []),
        ...(olFee>0         ? [{ vehicle_id:vehicleId, cost_type:'openlane', label:'Frais OpenLane',amount:olFee,        paid_out_of_pocket:false }] : []),
        ...(transport>0     ? [{ vehicle_id:vehicleId, cost_type:'transport', label:'Transport',   amount:transport,     paid_out_of_pocket:transportPocket }] : []),
        ...(inspection>0    ? [{ vehicle_id:vehicleId, cost_type:'inspection',label:'Inspection',  amount:inspection,    paid_out_of_pocket:inspectPocket }] : []),
        ...(wash>0          ? [{ vehicle_id:vehicleId, cost_type:'wash',      label:'Lavage',      amount:wash,          paid_out_of_pocket:washPocket }] : []),
        ...(gas>0           ? [{ vehicle_id:vehicleId, cost_type:'gas',       label:'Essence',     amount:gas,           paid_out_of_pocket:gasPocket }] : []),
        { vehicle_id:vehicleId, cost_type:'commission', label:'Commission', amount:commission, paid_out_of_pocket:false },
        ...repairs.filter(r=>r.label&&Number(r.amount)>0).map(r=>({ vehicle_id:vehicleId, cost_type:'repair', label:r.label, amount:Number(r.amount), paid_out_of_pocket:r.pocket||false })),
        ...extras.filter(e=>e.label&&Number(e.amount)>0).map(e=>({ vehicle_id:vehicleId, cost_type:'extra',  label:e.label, amount:Number(e.amount), paid_out_of_pocket:e.pocket||false })),
      ]

      if (costRows.length) {
        const { error } = await supabase.from('vehicle_costs').insert(costRows)
        if (error) throw new Error('Coûts: ' + error.message)
      }

      if (data.status==='sold' && data.sale_price && data.sale_date) {
        const { error } = await supabase.from('vehicle_sales').upsert({
          vehicle_id: vehicleId, sale_price: Number(data.sale_price),
          sale_date: data.sale_date, sale_channel: data.sale_channel||'private', sale_notes: data.sale_notes||null,
        }, { onConflict: 'vehicle_id' })
        if (error) throw new Error('Vente: ' + error.message)
      }

      showToast('✓ Véhicule enregistré !','ok')
      setTimeout(()=>navigate(`/vehicles/${vehicleId}`),900)
    } catch(err) {
      console.error(err)
      showToast('❌ '+err.message,'err')
    }
    setSaving(false)
  }

  const taxInfo = TAX_RATES[province] || TAX_RATES.QC

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={isEdit ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
        sub={isEdit ? 'Modification' : 'Nouveau véhicule'}
        actions={
          <button onClick={handleSubmit(onSubmit)} disabled={saving}
            className="bg-snow text-bg font-display font-bold text-xs tracking-widest px-5 py-2 rounded-lg border-none cursor-pointer hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
            {saving ? <><div className="spinner" style={{width:14,height:14}}/> Enregistrement…</> : '💾 Sauvegarder'}
          </button>
        }
      />

      {/* Steps */}
      <div className="flex-shrink-0 bg-surface border-b border-line">
        <div className="grid grid-cols-4">
          {STEPS.map((s,i) => (
            <button key={s} onClick={()=>setStep(i)}
              className="py-3 text-center cursor-pointer border-none bg-transparent border-r border-line last:border-r-0"
              style={{ background:i===step?'rgba(255,255,255,0.04)':'transparent', borderBottom:i===step?'2px solid #F4F3F8':'2px solid transparent' }}>
              <span className="text-[10px] tracking-widest uppercase"
                style={{ color:i===step?'#F4F3F8':'#55546A', fontWeight:i===step?600:400 }}>0{i+1} · {s}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 page-fade">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">

          {/* STEP 0 */}
          {step===0 && (
            <Section icon="🚗" title="Identification du véhicule">
              <div className="grid grid-cols-2 gap-4">
                <FI label="Année" type="number" placeholder="2022" required error={errors.year} {...register('year',{required:true})} />
                <FI label="Marque" placeholder="Toyota, Honda…" required error={errors.make} {...register('make',{required:true})} />
                <FI label="Modèle" placeholder="Camry, Civic…" required error={errors.model} {...register('model',{required:true})} />
                <FI label="VIN" placeholder="1HGBH41JXMN109186" hint="17 caractères" {...register('vin')} />
                <FI label="Kilométrage" type="number" placeholder="45 000" {...register('mileage')} />
                <FI label="Couleur" placeholder="Blanc, Noir…" {...register('color')} />
                <FS label="Transmission" required {...register('transmission')}>
                  {['Automatique','Manuelle'].map(o=><option key={o}>{o}</option>)}
                </FS>
                <FS label="Province d'origine" required {...register('origin_province')}>
                  {PROVINCES.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}
                </FS>
                <FS label="Source d'achat" {...register('purchase_source')}>
                  {['OpenLane','Autre encan','Achat privé','Reprise'].map(o=><option key={o}>{o}</option>)}
                </FS>
                <FI label="Date d'achat" type="date" required error={errors.purchase_date} {...register('purchase_date',{required:true})} />
                <div className="col-span-2 flex flex-col gap-2">
                  <label className="field-label">Statut *</label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTS.map(s=>(
                      <button key={s.value} type="button" onClick={()=>setValue('status',s.value)}
                        className="flex-1 min-w-[100px] py-2 px-3 rounded-lg cursor-pointer text-xs font-semibold border transition-all"
                        style={{ borderColor:w.status===s.value?s.color:'#2A2A38', background:w.status===s.value?s.bg:'transparent', color:w.status===s.value?s.color:'#55546A' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="field-label">Notes</label>
                  <textarea className="field-input mt-1.5 resize-y min-h-[70px]" placeholder="Remarques…" {...register('notes')} />
                </div>
              </div>
              <StepNav onNext={()=>setStep(1)} />
            </Section>
          )}

          {/* STEP 1 */}
          {step===1 && (
            <Section icon="💰" title="Coûts du véhicule">
              <div className="bg-info/10 border border-info/20 rounded-lg px-3 py-2 mb-5 text-xs text-info flex gap-2">
                <span>💡</span>
                <span>Coche <strong>"Ma poche"</strong> sur les dépenses payées personnellement — elles n'affectent pas le cash de la compagnie mais sont comptées dans le vrai profit.</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <FI label="Prix d'achat ($)" type="number" step="0.01" placeholder="0.00" required {...register('purchase_price',{required:true})} />

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between"><label className="field-label">Transport ($)</label><PocketToggle val={transportPocket} set={setTransportPocket}/></div>
                  <input type="number" step="0.01" placeholder="0.00" className="field-input" {...register('transport')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between"><label className="field-label">Inspection ($)</label><PocketToggle val={inspectPocket} set={setInspectPocket}/></div>
                  <input type="number" step="0.01" placeholder="0.00" className="field-input" {...register('inspection')} />
                  {province!=='QC'&&<span className="text-[10px] text-warn">⚠ Requis si hors Québec</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between"><label className="field-label">Lavage ($)</label><PocketToggle val={washPocket} set={setWashPocket}/></div>
                  <input type="number" step="0.01" placeholder="0.00" className="field-input" {...register('wash')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between"><label className="field-label">Essence ($)</label><PocketToggle val={gasPocket} set={setGasPocket}/></div>
                  <input type="number" step="0.01" placeholder="0.00" className="field-input" {...register('gas')} />
                </div>
                <div className="col-span-2 bg-surface2 border border-line2 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex justify-between"><span className="text-snow2 text-xs">{taxInfo.label} — {((taxInfo.TPS+taxInfo.TVP)*100).toFixed(3)}%</span><span className="font-mono text-xs text-snow">{fmt(taxAuto)}</span></div>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-dim"><input type="checkbox" checked={taxRecov} onChange={e=>setTaxRecov(e.target.checked)} className="accent-white"/>Taxes récupérables</label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-dim"><input type="checkbox" checked={taxManual} onChange={e=>setTaxManual(e.target.checked)} className="accent-white"/>Montant manuel</label>
                  </div>
                  {taxManual&&<input type="number" step="0.01" className="field-input mt-1" placeholder="Montant de taxes ($)" {...register('tax_manual')}/>}
                </div>
              </div>

              {/* Repairs */}
              <div className="mb-5">
                <label className="field-label mb-2">Réparations</label>
                <div className="flex flex-col gap-2">
                  {repairs.map((r,i)=>(
                    <div key={i} className="flex gap-2 items-center">
                      <input value={r.label} onChange={e=>{const n=[...repairs];n[i]={...n[i],label:e.target.value};setRepairs(n)}} placeholder="Description (ex: Pneus d'hiver)" className="field-input flex-1 text-xs py-2"/>
                      <input value={r.amount} type="number" onChange={e=>{const n=[...repairs];n[i]={...n[i],amount:e.target.value};setRepairs(n)}} placeholder="0.00" className="field-input w-24 text-xs py-2 text-right"/>
                      <PocketToggle val={r.pocket} set={v=>{const n=[...repairs];n[i]={...n[i],pocket:v};setRepairs(n)}}/>
                      {repairs.length>1&&<button type="button" onClick={()=>setRepairs(repairs.filter((_,j)=>j!==i))} className="btn-ghost px-2 text-stop text-xs">✕</button>}
                    </div>
                  ))}
                  <button type="button" onClick={()=>setRepairs([...repairs,{label:'',amount:'',pocket:false}])} className="btn-ghost self-start text-xs">+ Réparation</button>
                </div>
              </div>

              {/* Extras */}
              <div className="mb-5">
                <label className="field-label mb-2">Autres coûts</label>
                <div className="flex flex-col gap-2">
                  {extras.map((e,i)=>(
                    <div key={i} className="flex gap-2 items-center">
                      <input value={e.label} onChange={ev=>{const n=[...extras];n[i]={...n[i],label:ev.target.value};setExtras(n)}} placeholder="Description" className="field-input flex-1 text-xs py-2"/>
                      <input value={e.amount} type="number" onChange={ev=>{const n=[...extras];n[i]={...n[i],amount:ev.target.value};setExtras(n)}} placeholder="0.00" className="field-input w-24 text-xs py-2 text-right"/>
                      <PocketToggle val={e.pocket} set={v=>{const n=[...extras];n[i]={...n[i],pocket:v};setExtras(n)}}/>
                      <button type="button" onClick={()=>setExtras(extras.filter((_,j)=>j!==i))} className="btn-ghost px-2 text-stop text-xs">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={()=>setExtras([...extras,{label:'',amount:'',pocket:false}])} className="btn-ghost self-start text-xs">+ Autre coût</button>
                </div>
              </div>

              {/* Summary */}
              <div className="border border-line rounded-lg overflow-hidden">
                <div className="bg-surface2 px-4 py-2 border-b border-line"><span className="text-[10px] text-dim tracking-widest uppercase font-semibold">Récapitulatif</span></div>
                <div className="p-1">
                  {purchasePrice>0&&<CostRow label="Prix d'achat" val={purchasePrice}/>}
                  {taxAuto>0&&<CostRow label={`Taxes (${taxInfo.label})`} val={taxAuto} auto/>}
                  {olFee>0&&<CostRow label="Frais OpenLane" val={olFee} auto/>}
                  {transport>0&&<CostRow label="Transport" val={transport} pocket={transportPocket}/>}
                  {inspection>0&&<CostRow label="Inspection" val={inspection} pocket={inspectPocket}/>}
                  {wash>0&&<CostRow label="Lavage" val={wash} pocket={washPocket}/>}
                  {gas>0&&<CostRow label="Essence" val={gas} pocket={gasPocket}/>}
                  {repairTotal>0&&<CostRow label="Réparations" val={repairTotal} pocket={repairs.some(r=>r.pocket)}/>}
                  {extraTotal>0&&<CostRow label="Autres coûts" val={extraTotal}/>}
                  <CostRow label="Commission" val={commission} auto/>
                </div>
                <div className="p-2 flex flex-col gap-1">
                  <CostRow label="COÛT DE REVIENT TOTAL" val={totalCost} total/>
                  {pocketTotal>0&&<>
                    <CostRow label="→ dont payé de ta poche" val={pocketTotal} pocket/>
                    <CostRow label="→ dont payé par la compagnie" val={companyCost}/>
                  </>}
                </div>
              </div>
              <StepNav onPrev={()=>setStep(0)} onNext={()=>setStep(2)}/>
            </Section>
          )}

          {/* STEP 2 */}
          {step===2 && (
            <Section icon="💵" title="Informations de vente">
              {w.status!=='sold' ? (
                <div className="text-center py-8 text-dim text-sm">
                  <div className="text-3xl mb-3 opacity-30">🔒</div>
                  <p>Disponible quand le statut est <strong className="text-snow2">Vendu</strong>.</p>
                  <button type="button" onClick={()=>{setValue('status','sold');setStep(0)}} className="text-snow2 text-xs underline mt-2 cursor-pointer bg-transparent border-none">Changer →</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FI label="Prix de vente ($)" type="number" step="0.01" placeholder="0.00" required {...register('sale_price')}/>
                  <FI label="Date de vente" type="date" required {...register('sale_date')}/>
                  <div className="col-span-2">
                    <label className="field-label mb-1.5">Canal de vente</label>
                    <div className="relative">
                      <select className="field-input appearance-none pr-8 cursor-pointer" {...register('sale_channel')}>
                        <option value="marketplace">Marketplace (Facebook)</option>
                        <option value="private">Vente privée</option>
                        <option value="auction">Encan (OpenLane)</option>
                        <option value="other">Autre</option>
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none text-[10px]">▾</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">Notes de vente</label>
                    <textarea className="field-input mt-1.5 resize-y min-h-[60px]" placeholder="Remarques…" {...register('sale_notes')}/>
                  </div>
                  {salePrice>0&&(
                    <div className="col-span-2 bg-surface2 border border-line2 rounded-lg p-4 flex justify-between items-center">
                      <span className="text-dim text-xs">Profit net estimé</span>
                      <span className={`font-mono font-bold text-lg ${netProfit>=0?'text-go':'text-stop'}`}>{fmt(netProfit)}</span>
                    </div>
                  )}
                </div>
              )}
              <StepNav onPrev={()=>setStep(1)} onNext={()=>setStep(3)}/>
            </Section>
          )}

          {/* STEP 3 */}
          {step===3 && (
            <Section icon="📷" title="Photos & Documents">
              <div className="mb-5">
                <label className="field-label mb-2">Photos (max 10)</label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
                  {photos.map((p,i)=>(
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-line2">
                      <img src={p.url} alt="" className="w-full h-full object-cover"/>
                      <button type="button" onClick={()=>setPhotos(photos.filter((_,j)=>j!==i))} className="absolute top-1 right-1 w-5 h-5 bg-bg/80 rounded-full text-snow text-xs flex items-center justify-center cursor-pointer border-none">✕</button>
                    </div>
                  ))}
                  {photos.length<10&&(
                    <label className="aspect-square rounded-lg border border-dashed border-line3 flex flex-col items-center justify-center cursor-pointer hover:border-snow3 transition-colors">
                      <span className="text-2xl text-dim2">📷</span>
                      <span className="text-[9px] text-dim mt-1">Ajouter</span>
                      <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                        onChange={async(e)=>{
                          const files=Array.from(e.target.files); if(!files.length) return
                          setUploading(true)
                          const np=await Promise.all(files.map(async f=>{
                            const ext=f.name.split('.').pop()
                            const path=`${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                            const{error}=await supabase.storage.from('vehicle-photos').upload(path,f)
                            if(error) return null
                            const{data:{publicUrl}}=supabase.storage.from('vehicle-photos').getPublicUrl(path)
                            return{path,url:publicUrl}
                          }))
                          setPhotos(prev=>[...prev,...np.filter(Boolean)]); setUploading(false)
                        }}/>
                    </label>
                  )}
                </div>
                {uploading&&<p className="text-dim text-xs flex items-center gap-2"><div className="spinner" style={{width:12,height:12}}/> Téléversement…</p>}
              </div>
              <div className="mb-5">
                <label className="field-label mb-2">Documents PDF</label>
                <div className="flex gap-2 flex-wrap">
                  {docs.map((d,i)=>(
                    <div key={i} className="flex items-center gap-2 bg-surface2 border border-line2 rounded-lg px-3 py-2">
                      <span>📄</span><span className="text-xs text-snow2">{d.name}</span>
                      <button type="button" onClick={()=>setDocs(docs.filter((_,j)=>j!==i))} className="text-dim text-xs cursor-pointer bg-transparent border-none hover:text-stop ml-1">✕</button>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 btn-ghost cursor-pointer">
                    <span>📎</span><span>Ajouter un PDF</span>
                    <input type="file" accept=".pdf" multiple className="hidden"
                      onChange={async(e)=>{
                        const files=Array.from(e.target.files); setUploading(true)
                        const nd=await Promise.all(files.map(async f=>{
                          const path=`${user.id}/${Date.now()}_${f.name}`
                          const{error}=await supabase.storage.from('vehicle-documents').upload(path,f)
                          if(error) return null; return{path,name:f.name}
                        }))
                        setDocs(prev=>[...prev,...nd.filter(Boolean)]); setUploading(false)
                      }}/>
                  </label>
                </div>
              </div>
              <StepNav onPrev={()=>setStep(2)}/>
              <button type="button" onClick={handleSubmit(onSubmit)} disabled={saving}
                className="btn-primary mt-2 flex items-center justify-center gap-2">
                {saving?<><div className="spinner" style={{width:16,height:16}}/> Enregistrement…</>:'💾 ENREGISTRER LE VÉHICULE'}
              </button>
            </Section>
          )}
        </div>
      </div>

      {toast.msg&&(
        <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 border rounded-xl px-5 py-3 text-sm shadow-2xl z-50
          ${toast.type==='ok'?'bg-surface border-line3 text-snow':'bg-stop/10 border-stop/30 text-stop'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
