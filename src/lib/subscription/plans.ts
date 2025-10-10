export type PlanTier = 'starter' | 'creator' | 'brand' | 'pro' | 'admin'

export const PLAN_POOL_LIMITS: Record<PlanTier, number> = {
  starter: 50,
  creator: 500,
  brand: 1000,
  pro: 1500,
  admin: 10000,
}

export const PLAN_PRICES: Record<PlanTier, number> = {
  starter: 9,
  creator: 29,
  brand: 69,
  pro: 99,
  admin: 0,
}

// Overage pricing in cents per generation beyond the included pool
export const PLAN_OVERAGE_CENTS: Record<PlanTier, number> = {
  starter: 10,  // $0.10/gen
  creator: 8,   // $0.08/gen
  brand: 6,     // $0.06/gen
  pro: 5,       // $0.05/gen
  admin: 0,     // $0.00/gen (unlimited)
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

export function getOverageCents(tier: PlanTier): number {
  return PLAN_OVERAGE_CENTS[tier]
}
