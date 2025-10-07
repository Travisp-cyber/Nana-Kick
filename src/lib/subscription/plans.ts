export type PlanTier = 'starter' | 'creator' | 'brand' | 'pro'

export const PLAN_POOL_LIMITS: Record<PlanTier, number> = {
  starter: 50,
  creator: 500,
  brand: 1000,
  pro: 1500,
}

export const PLAN_PRICES: Record<PlanTier, number> = {
  starter: 9,
  creator: 29,
  brand: 69,
  pro: 99,
}

export function normalizeTier(input: string | undefined | null): PlanTier | null {
  if (!input) return null
  const v = String(input).toLowerCase()
  if (v.includes('starter')) return 'starter'
  if (v.includes('creator')) return 'creator'
  if (v.includes('brand')) return 'brand'
  if (v.includes('pro') || v.includes('professional')) return 'pro'
  return null
}

export function getPoolLimit(tier: PlanTier): number {
  return PLAN_POOL_LIMITS[tier]
}