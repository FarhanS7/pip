/**
 * Worker Admin Controls (Task B31)
 *
 * Global kill switch, invite/revoke controls, and usage alerts.
 */

interface AdminEnv {
  ADMIN_KV?: KVNamespace
  ADMIN_SECRET?: string
}

/**
 * Check if global kill switch is active.
 * When active, all paid API calls are blocked.
 */
export async function isKillSwitchActive(env: AdminEnv): Promise<boolean> {
  if (!env.ADMIN_KV) return false
  const value = await env.ADMIN_KV.get('kill-switch')
  return value === 'active'
}

/**
 * Activate or deactivate the global kill switch (admin-only).
 */
export async function setKillSwitch(
  env: AdminEnv,
  adminSecret: string,
  active: boolean
): Promise<boolean> {
  if (!env.ADMIN_SECRET || adminSecret !== env.ADMIN_SECRET) return false
  if (!env.ADMIN_KV) return false

  await env.ADMIN_KV.put('kill-switch', active ? 'active' : 'inactive')
  return true
}

/**
 * Get admin overview of system state.
 */
export async function getAdminStatus(
  env: AdminEnv,
  adminSecret: string
): Promise<{ killSwitch: boolean } | null> {
  if (!env.ADMIN_SECRET || adminSecret !== env.ADMIN_SECRET) return null
  if (!env.ADMIN_KV) return null

  const killSwitch = await isKillSwitchActive(env)
  return { killSwitch }
}
