'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export function UsageStatus({ memberId: propMemberId }: { memberId?: string }) {
  const search = useSearchParams()
  const [data, setData] = useState<{
    plan: string
    pool_limit: number
    current_usage: number
    remaining: number
    overage_cents: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const memberId = useMemo(() => {
    return (
      propMemberId ||
      search.get('member_id') ||
      process.env.NEXT_PUBLIC_DEFAULT_MEMBER_ID ||
      ''
    )
  }, [propMemberId, search])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!memberId) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/usage/status?member_id=${encodeURIComponent(memberId)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load usage')
        if (!cancelled) setData(json)
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message) : 'Failed to load usage'
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  // Friendly empty state when no member selected
  if (!memberId) {
    return (
      <div className="flex items-center gap-3 bg-white/70 backdrop-blur px-4 py-2 rounded-xl shadow border border-black/5 text-sm text-gray-700">
        <span className="font-medium">Usage</span>
        <div className="w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gray-300" style={{ width: '0%' }} />
        </div>
        <span className="text-gray-500">Sign in</span>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur px-4 py-2 rounded-xl shadow border border-black/5 text-sm text-gray-700">
        <span className="font-medium">Usage</span>
        <div className="w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 animate-pulse" style={{ width: '50%' }} />
        </div>
        <span className="text-gray-500">Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-xl shadow border border-red-200 text-sm text-red-700">
        <span className="font-medium">Usage</span>
        <span className="truncate">{error}</span>
      </div>
    )
  }

  const used = data ? data.current_usage : 0
  const total = Math.max(data ? data.pool_limit : 0, 1)
  const plan = data?.plan || 'starter'
  const overage = data?.overage_cents ?? 0
  const pct = Math.min(Math.round((used / total) * 100), 100)

  return (
    <div className="flex items-center gap-4 bg-white/80 backdrop-blur px-4 py-2 rounded-xl shadow border border-black/5">
      <div className="flex flex-col">
        <div className="text-xs uppercase tracking-wide text-gray-500">{plan} plan</div>
        <div className="flex items-center gap-3">
          <div className="w-44 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-sm text-gray-800 font-medium">{used}/{total} generations used</div>
        </div>
        {used >= total && (
          <div className="text-xs text-gray-500 mt-1">
            Overage: ${ (overage/100).toFixed(2) }/gen
          </div>
        )}
      </div>
      <a href="/plans" className="ml-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow">
        Upgrade
      </a>
    </div>
  )
}
