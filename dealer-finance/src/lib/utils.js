import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// Format currency CAD
export const fmt = (n, compact = false) => {
  if (n == null) return '—'
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency', currency: 'CAD',
      notation: 'compact', maximumFractionDigits: 1
    }).format(n)
  }
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 2
  }).format(n)
}

// Format date
export const fmtDate = (d) => {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy', { locale: fr }) }
  catch { return d }
}

// Days on lot
export const daysOnLot = (purchaseDate, saleDate) => {
  if (!purchaseDate) return null
  const from = typeof purchaseDate === 'string' ? parseISO(purchaseDate) : purchaseDate
  const to   = saleDate ? (typeof saleDate === 'string' ? parseISO(saleDate) : saleDate) : new Date()
  return differenceInDays(to, from)
}

// Status config
export const STATUS = {
  bought: { label: 'Acheté',        color: '#6C8EF5', bg: 'rgba(108,142,245,0.12)', cls: 'badge-bought' },
  repair: { label: 'En réparation', color: '#E09050', bg: 'rgba(224,144,80,0.12)',  cls: 'badge-repair' },
  lot:    { label: 'Sur le lot',    color: '#2DD4A0', bg: 'rgba(45,212,160,0.12)',  cls: 'badge-lot'    },
  sold:   { label: 'Vendu',         color: '#8A899A', bg: 'rgba(138,137,154,0.12)', cls: 'badge-sold'   },
}

// Channel labels
export const CHANNEL = {
  marketplace: 'Marketplace (Facebook)',
  private:     'Vente privée',
  auction:     'Encan (OpenLane)',
  other:       'Autre',
}

// Province list
export const PROVINCES = [
  { code: 'QC', name: 'Québec' },
  { code: 'ON', name: 'Ontario' },
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'Colombie-Britannique' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'NS', name: 'Nouvelle-Écosse' },
  { code: 'NB', name: 'Nouveau-Brunswick' },
  { code: 'PE', name: 'Î.-P.-É.' },
  { code: 'NL', name: 'T.-N.-L.' },
]

// Tax rates by province
export const TAX_RATES = {
  QC: { TPS: 0.05, TVP: 0.09975, label: 'TPS + TVQ' },
  ON: { TPS: 0.05, TVP: 0.08,    label: 'TVH (13%)' },
  AB: { TPS: 0.05, TVP: 0.00,    label: 'TPS seule (5%)' },
  BC: { TPS: 0.05, TVP: 0.07,    label: 'TPS + TVP BC' },
  MB: { TPS: 0.05, TVP: 0.07,    label: 'TPS + TVP MB' },
  SK: { TPS: 0.05, TVP: 0.06,    label: 'TPS + TVP SK' },
  NS: { TPS: 0.05, TVP: 0.10,    label: 'TVH (15%)' },
  NB: { TPS: 0.05, TVP: 0.10,    label: 'TVH (15%)' },
  PE: { TPS: 0.05, TVP: 0.10,    label: 'TVH (15%)' },
  NL: { TPS: 0.05, TVP: 0.10,    label: 'TVH (15%)' },
}

// Calculate taxes
export const calcTaxes = (amount, province = 'QC') => {
  const rates = TAX_RATES[province] || TAX_RATES.QC
  return amount * (rates.TPS + rates.TVP)
}

// Get OpenLane fee from brackets
export const getOpenLaneFee = (price, brackets = []) => {
  if (!price || !brackets.length) return 0
  const bracket = brackets.find(b =>
    price >= b.min_price && (b.max_price == null || price <= b.max_price)
  )
  return bracket?.fee_amount || 0
}

// Monthly cost of fixed expense
export const monthlyAmount = (expense) => {
  switch (expense.frequency) {
    case 'monthly': return expense.amount
    case 'annual':  return expense.amount / 12
    case 'weekly':  return expense.amount * 52 / 12
    default:        return expense.amount
  }
}

// Truncate text
export const trunc = (str, n = 30) =>
  str && str.length > n ? str.slice(0, n) + '…' : str
