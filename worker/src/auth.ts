/**
 * Worker Authentication — Invites & Sessions (Task B29)
 *
 * Single-use invite generation/redemption, short-lived access tokens,
 * and session management via KV storage.
 */

interface Env {
  INVITE_KV?: KVNamespace
  SESSION_KV?: KVNamespace
  ADMIN_SECRET?: string
  PIP_SHARED_SECRET?: string
}

const TOKEN_TTL_SECONDS = 3600 // 1 hour
const REFRESH_TTL_SECONDS = 86400 * 7 // 7 days

/**
 * Generate a single-use invite code (admin-only).
 */
export async function generateInvite(env: Env, adminSecret: string): Promise<{ code: string } | null> {
  if (!env.ADMIN_SECRET || adminSecret !== env.ADMIN_SECRET) return null
  if (!env.INVITE_KV) return null

  const code = crypto.randomUUID()
  await env.INVITE_KV.put(`invite:${code}`, JSON.stringify({
    created: Date.now(),
    redeemed: false
  }), { expirationTtl: 86400 * 30 }) // 30 day expiry

  return { code }
}

/**
 * Redeem an invite code and create a user session.
 */
export async function redeemInvite(
  env: Env,
  inviteCode: string
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  if (!env.INVITE_KV || !env.SESSION_KV) return null

  const inviteData = await env.INVITE_KV.get(`invite:${inviteCode}`)
  if (!inviteData) return null

  const invite = JSON.parse(inviteData) as { created: number; redeemed: boolean }
  if (invite.redeemed) return null

  // Mark invite as redeemed
  await env.INVITE_KV.put(`invite:${inviteCode}`, JSON.stringify({
    ...invite,
    redeemed: true,
    redeemedAt: Date.now()
  }))

  const userId = crypto.randomUUID()
  const accessToken = crypto.randomUUID()
  const refreshToken = crypto.randomUUID()

  await env.SESSION_KV.put(`session:${accessToken}`, JSON.stringify({
    userId,
    created: Date.now(),
    refreshToken
  }), { expirationTtl: TOKEN_TTL_SECONDS })

  await env.SESSION_KV.put(`refresh:${refreshToken}`, JSON.stringify({
    userId,
    created: Date.now()
  }), { expirationTtl: REFRESH_TTL_SECONDS })

  return { accessToken, refreshToken, userId }
}

/**
 * Validate an access token and return the user ID.
 */
export async function validateSession(env: Env, accessToken: string): Promise<string | null> {
  if (!env.SESSION_KV) return null

  const sessionData = await env.SESSION_KV.get(`session:${accessToken}`)
  if (!sessionData) return null

  const session = JSON.parse(sessionData) as { userId: string }
  return session.userId
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshSession(
  env: Env,
  oldRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!env.SESSION_KV) return null

  const refreshData = await env.SESSION_KV.get(`refresh:${oldRefreshToken}`)
  if (!refreshData) return null

  const refresh = JSON.parse(refreshData) as { userId: string }

  // Revoke old refresh token
  await env.SESSION_KV.delete(`refresh:${oldRefreshToken}`)

  // Issue new tokens
  const accessToken = crypto.randomUUID()
  const refreshToken = crypto.randomUUID()

  await env.SESSION_KV.put(`session:${accessToken}`, JSON.stringify({
    userId: refresh.userId,
    created: Date.now(),
    refreshToken
  }), { expirationTtl: TOKEN_TTL_SECONDS })

  await env.SESSION_KV.put(`refresh:${refreshToken}`, JSON.stringify({
    userId: refresh.userId,
    created: Date.now()
  }), { expirationTtl: REFRESH_TTL_SECONDS })

  return { accessToken, refreshToken }
}

/**
 * Revoke a user session (logout or admin action).
 */
export async function revokeSession(env: Env, accessToken: string): Promise<boolean> {
  if (!env.SESSION_KV) return false

  const sessionData = await env.SESSION_KV.get(`session:${accessToken}`)
  if (!sessionData) return false

  const session = JSON.parse(sessionData) as { refreshToken?: string }
  await env.SESSION_KV.delete(`session:${accessToken}`)
  if (session.refreshToken) {
    await env.SESSION_KV.delete(`refresh:${session.refreshToken}`)
  }

  return true
}
