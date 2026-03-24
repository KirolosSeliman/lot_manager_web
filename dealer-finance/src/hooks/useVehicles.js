import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useVehicleSummaries(filters = {}) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('vehicle_summary').select('*')

    if (filters.status)   q = q.eq('status', filters.status)
    if (filters.make)     q = q.ilike('make', `%${filters.make}%`)
    if (filters.province) q = q.eq('origin_province', filters.province)

    q = q.order('created_at', { ascending: false })

    const { data, error } = await q
    if (error) setError(error.message)
    else setData(data || [])
    setLoading(false)
  }, [JSON.stringify(filters)])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}

export function useVehicle(id) {
  const [vehicle, setVehicle] = useState(null)
  const [costs,   setCosts]   = useState([])
  const [media,   setMedia]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [vRes, cRes, mRes] = await Promise.all([
      supabase.from('vehicle_summary').select('*').eq('id', id).single(),
      supabase.from('vehicle_costs').select('*').eq('vehicle_id', id).order('created_at'),
      supabase.from('vehicle_media').select('*').eq('vehicle_id', id).order('display_order'),
    ])

    setVehicle(vRes.data)
    setCosts(cRes.data || [])
    setMedia(mRes.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  return { vehicle, costs, media, loading, reload: load }
}
