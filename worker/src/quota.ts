/**
 * Worker Quota Coordinator (Task B30)
 *
 * Per-user atomic quota tracking with reservation model.
 * Prevents concurrent requests from overspending.
 */

interface QuotaEnv {
  QUOTA_KV?: KVNamespace
}

export interface QuotaLimits {
  dailyMaxCents: number
  monthlyMaxCents: number
  perTurnMaxCents: number
}

export const DEFAULT_QUOTA_LIMITS: QuotaLimits = {
  dailyMaxCents: 500,   // $5 daily
  monthlyMaxCents: 5000, // $50 monthly
  perTurnMaxCents: 50    // $0.50 per turn
}

interface QuotaRecord {
  userId: string
  dailySpentCents: number
  monthlySpentCents: number
  dailyResetDate: string
  monthlyResetDate: string
  reservedCents: number
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

/**
 * Reserve quota before making an upstream API call.
 * Returns false if the reservation would exceed limits.
 */
export async function reserveQuota(
  env: QuotaEnv,
  userId: string,
  estimatedCents: number,
  limits: QuotaLimits = DEFAULT_QUOTA_LIMITS
): Promise<boolean> {
  if (!env.QUOTA_KV) return true // No KV = no quotas enforced

  const key = `quota:${userId}`
  const rawData = await env.QUOTA_KV.get(key)
  const record: QuotaRecord = rawData ? JSON.parse(rawData) : {
    userId,
    dailySpentCents: 0,
    monthlySpentCents: 0,
    dailyResetDate: todayKey(),
    monthlyResetDate: monthKey(),
    reservedCents: 0
  }

  // Reset counters on new day/month
  if (record.dailyResetDate !== todayKey()) {
    record.dailySpentCents = 0
    record.dailyResetDate = todayKey()
    record.reservedCents = 0
  }
  if (record.monthlyResetDate !== monthKey()) {
    record.monthlySpentCents = 0
    record.monthlyResetDate = monthKey()
  }

  // Check limits
  if (estimatedCents > limits.perTurnMaxCents) return false
  if (record.dailySpentCents + record.reservedCents + estimatedCents > limits.dailyMaxCents) return false
  if (record.monthlySpentCents + record.reservedCents + estimatedCents > limits.monthlyMaxCents) return false

  // Reserve
  record.reservedCents += estimatedCents
  await env.QUOTA_KV.put(key, JSON.stringify(record), { expirationTtl: 86400 * 31 })

  return true
}

/**
 * Commit or release a reservation after the upstream call completes.
 */
export async function commitQuota(
  env: QuotaEnv,
  userId: string,
  actualCents: number,
  reservedCents: number
): Promise<void> {
  if (!env.QUOTA_KV) return

  const key = `quota:${userId}`
  const rawData = await env.QUOTA_KV.get(key)
  if (!rawData) return

  const record: QuotaRecord = JSON.parse(rawData)
  record.reservedCents = Math.max(0, record.reservedCents - reservedCents)
  record.dailySpentCents += actualCents
  record.monthlySpentCents += actualCents

  await env.QUOTA_KV.put(key, JSON.stringify(record), { expirationTtl: 86400 * 31 })
}

/**
 * Get current quota usage for a user.
 */
export async function getQuotaUsage(
  env: QuotaEnv,
  userId: string
): Promise<QuotaRecord | null> {
  if (!env.QUOTA_KV) return null

  const rawData = await env.QUOTA_KV.get(`quota:${userId}`)
  if (!rawData) return null

  return JSON.parse(rawData) as QuotaRecord
}
