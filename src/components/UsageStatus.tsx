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
    overage_used: number
    overage_charges: number
    free_trial_used: number
    has_claimed_free_trial: boolean
    is_free_trial_active: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authStatus, setAuthStatus] = useState<{
    allowed: boolean
    reason: string
    userId?: string
    isAdmin?: boolean
  } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const memberId = useMemo(() => {
    return (
      propMemberId ||
      search.get('member_id') ||
      process.env.NEXT_PUBLIC_DEFAULT_MEMBER_ID ||
      ''
    )
  }, [propMemberId, search])

  // Check authentication status and usage
  useEffect(() => {
    let cancelled = false
    async function checkAuth() {
      try {
        // Add cache-busting timestamp to force fresh data
        const cacheBuster = Date.now()
        const res = await fetch(`/api/usage/current?t=${cacheBuster}`, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        const json = await res.json()
        if (!cancelled) {
          setAuthStatus({
            allowed: Boolean(json?.hasAccess),
            reason: json?.isAdmin ? 'admin' : (json?.tier || 'member'),
            userId: json?.userId,
            isAdmin: Boolean(json?.isAdmin)
          })
          
          // If we have usage data, set it
          if (json?.usage) {
            // Log the received data for debugging
            if (json.tier === 'free-trial') {
              console.log(`🔍 UsageStatus received: freeTrialUsed=${json.usage.freeTrialUsed}, tier=${json.tier}`);
            }
            
            setData({
              plan: json.tier || 'unknown',
              pool_limit: json.usage.limit || 0,
              current_usage: json.usage.used || 0,
              remaining: json.usage.remaining || 0,
              overage_cents: json.usage.overageCentsPerGen || 0,
              overage_used: json.usage.overageUsed || 0,
              overage_charges: json.usage.overageCharges || 0,
              free_trial_used: json.usage.freeTrialUsed ?? 0,
              has_claimed_free_trial: json.usage.hasClaimedFreeTrial ?? false,
              is_free_trial_active: json.tier === 'free-trial',
            })
          }
        }
      } catch {
        if (!cancelled) setAuthStatus({ allowed: false, reason: 'no_session' })
      }
    }
    checkAuth()
    return () => { cancelled = true }
  }, [refreshKey])

  // Expose refresh function globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { refreshUsageStatus?: () => void }).refreshUsageStatus = () => setRefreshKey(k => k + 1);
    }
  }, [])

  // Keep the old endpoint for backward compatibility if memberId is provided
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!memberId) return
      // Skip if we already have data from /api/usage/current
      if (data) return
      
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
  }, [memberId, data])

  // Show user authentication status
  if (!data && !loading) {
    let statusText = 'Sign in'
    let statusColor = 'text-gray-500'
    
    if (authStatus?.allowed) {
      if (authStatus.isAdmin) {
        statusText = 'Admin'
        statusColor = 'text-purple-600 font-semibold'
      } else {
        statusText = 'Member'
        statusColor = 'text-green-600 font-medium'
      }
    }
    
    return (
      <div className="flex items-center gap-3 bg-white/70 backdrop-blur px-4 py-2 rounded-xl shadow border border-black/5 text-sm text-gray-700">
        <span className="font-medium">Usage</span>
        <div className="w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gray-300" style={{ width: '0%' }} />
        </div>
        <span className={statusColor}>{statusText}</span>
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
  const overageCents = data?.overage_cents ?? 0
  const overageUsed = data?.overage_used ?? 0
  const overageCharges = data?.overage_charges ?? 0
  const freeTrialUsed = data?.free_trial_used ?? 0
  const isFreeTrialActive = data?.is_free_trial_active ?? false
  const pct = Math.min(Math.round((used / total) * 100), 100)
  
  // Display plan with admin indicator or free trial
  let planDisplay = authStatus?.isAdmin ? `${plan} (admin)` : `${plan} plan`
  if (isFreeTrialActive) {
    planDisplay = 'Free Trial'
  }
  
  // Check if user is in overage
  const isInOverage = used >= total && overageUsed > 0
  
  // Check if free trial is low
  const isFreeTrialLow = isFreeTrialActive && freeTrialUsed <= 3 && freeTrialUsed > 0

  return (
    <div className="flex items-center gap-4 bg-white/80 backdrop-blur px-4 py-2 rounded-xl shadow border border-black/5">
      <div className="flex flex-col">
        <div className="text-xs uppercase tracking-wide text-gray-500">{planDisplay}</div>
        <div className="flex items-center gap-3">
          <div className="w-44 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${isFreeTrialActive ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-sm text-gray-800 font-medium">
            {isFreeTrialActive ? (
              <span>{freeTrialUsed} remaining</span>
            ) : isInOverage ? (
              <span>{total}/{total} + {overageUsed} extra (${overageCharges.toFixed(2)})</span>
            ) : (
              <span>{used}/{total} remaining</span>
            )}
          </div>
        </div>
        {isFreeTrialLow && (
          <div className="text-xs text-orange-600 mt-1 font-medium">
            ⚠️ Only {freeTrialUsed} free generations left - Upgrade for more!
          </div>
        )}
        {!isFreeTrialActive && used >= total && !isInOverage && (
          <div className="text-xs text-orange-600 mt-1 font-medium">
            ⚠️ At limit - Extra: ${(overageCents/100).toFixed(2)}/gen
          </div>
        )}
        {isInOverage && (
          <div className="text-xs text-orange-600 mt-1 font-medium">
            💳 Overage: {overageUsed} gens × ${(overageCents/100).toFixed(2)} = ${overageCharges.toFixed(2)}
          </div>
        )}
      </div>
      <a href="/plans" className="ml-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow">
        Upgrade
      </a>
    </div>
  )
}
