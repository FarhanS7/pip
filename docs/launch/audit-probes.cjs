// Read-only source probes for the completion review. No provider/network/desktop access.
// Run from the Pip root: node docs/launch/audit-probes.cjs
// Observations describe current defects; they are not acceptance tests for desired behavior.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function loader(overrides = {}) {
  const cache = new Map()
  function load(relative) {
    const filename = path.resolve(root, relative)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }; cache.set(filename, module)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText
    const localRequire = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (!name.startsWith('.')) return require(name)
      let target = path.resolve(path.dirname(filename), name)
      if (target.endsWith('.js')) target = target.slice(0, -3) + '.ts'
      else if (!path.extname(target)) target += '.ts'
      return load(target)
    }
    const quietConsole = { debug() {}, info() {}, warn() {}, error() {}, log() {} }
    vm.runInNewContext(code, { module, exports: module.exports, require: localRequire,
      __dirname: path.dirname(filename), process, console: quietConsole,
      setTimeout, clearTimeout, AbortController, TextEncoder, TextDecoder, ReadableStream,
      Response, URL, ArrayBuffer, crypto: require('node:crypto').webcrypto }, { filename })
    return module.exports
  }
  return load
}
async function main() {
  const report = { source: '7992ded', observations: {} }
  const state = { getState: () => 'idle' }
  const loadSecurity = loader({ electron: { app: { isPackaged: true } }, '../state/voice-state-machine': { voiceStateMachine: state } })
  const security = loadSecurity('src/main/ipc/security.ts')
  const channels = loadSecurity('src/shared/channels.ts').IpcChannel
  const contents = Object.assign(new EventEmitter(), { mainFrame: { url: 'file:///fixture/panel/index.html' }, isDestroyed: () => false, setWindowOpenHandler() {} })
  security.secureRenderer({ webContents: contents }, 'panel', contents.mainFrame.url)
  report.observations.panelChannels = {}
  for (const key of ['SETTINGS_GET', 'DIAGNOSTICS_COLLECT', 'CAPTURE_POLICY_GET', 'CAPTURE_PAUSE', 'CAPTURE_RESUME', 'ONBOARDING_COMPLETE']) {
    try { security.authorizeIpc({ sender: contents, senderFrame: contents.mainFrame }, channels[key]); report.observations.panelChannels[key] = 'allowed' }
    catch { report.observations.panelChannels[key] = 'denied' }
  }
  const screen = Object.assign(new EventEmitter(), { getAllDisplays: () => [{ id: 1, bounds: { x: 0, y: 0, width: 100, height: 100 } }] })
  let created = 0
  class Window extends EventEmitter {
    constructor() { super(); created++; this.webContents = {} }
    isDestroyed() { return false }
    setIgnoreMouseEvents() {} setSkipTaskbar() {} setAlwaysOnTop() {} loadURL() {}
    close() { this.emit('closed') }
  }
  const overlay = loader({ electron: { BrowserWindow: Window, screen }, '../ipc/security': { rendererURL: () => 'file:///fixture', secureRenderer() {} } })('src/main/windows/overlay-window.ts')
  const listeners = []
  for (let i = 0; i < 3; i++) { overlay.createOverlayWindows(); listeners.push(screen.listenerCount('display-added')); overlay.destroyAllOverlayWindows() }
  const before = created
  screen.emit('display-added', {}, { id: 2, bounds: { x: 100, y: 0, width: 100, height: 100 } })
  report.observations.displayLifecycle = { listenerCountsAfterRecreate: listeners, windowsCreatedForOneAddedDisplay: created - before }
  overlay.destroyAllOverlayWindows()
  let callback, voice = 'idle', turn = 0
  const hook = Object.assign(new EventEmitter(), { start() {} })
  const hotkey = loader({ electron: { globalShortcut: { register(_key, cb) { callback = cb; return true }, unregister() {}, unregisterAll() {} } },
    'uiohook-napi': { uIOhook: hook }, './state/voice-state-machine': { voiceStateMachine: {
      getState: () => voice, getTurnId: () => turn, transitionTo(next) { voice = next; if (next === 'listening') turn++ }, reset() { voice = 'idle' }
    } } })('src/main/hotkey.ts')
  hotkey.registerGlobalHotkey('Alt+Space'); callback(); hook.emit('keyup', { keycode: 11 })
  report.observations.unrelatedKeyRelease = { stateAfterRelease: voice }
  hotkey.unregisterAllHotkeys()
  const quota = loader()('worker/src/quota.ts')
  const values = new Map()
  const kv = { async get(key) { return values.get(key) ?? null }, async put(key, value) { values.set(key, value) }, async delete(key) { values.delete(key) } }
  const limits = { dailyMaxCents: 50, monthlyMaxCents: 50, perTurnMaxCents: 50 }
  const admitted = await Promise.all([quota.reserveQuota({ QUOTA_KV: kv }, 'fixture', 40, limits), quota.reserveQuota({ QUOTA_KV: kv }, 'fixture', 40, limits)])
  report.observations.quotaRace = { admitted, intendedReservationCents: 80, allowedCents: 50, storedReservationCents: JSON.parse(values.get('quota:fixture')).reservedCents }
  report.observations.negativeQuotaAccepted = await quota.reserveQuota({ QUOTA_KV: kv }, 'negative-fixture', -10, limits)
  const auth = loader()('worker/src/auth.ts')
  const env = { INVITE_KV: kv, SESSION_KV: kv, ADMIN_SECRET: 'fixture-only' }
  const invite = await auth.generateInvite(env, 'fixture-only')
  const session = await auth.redeemInvite(env, invite.code)
  const rotated = await auth.refreshSession(env, session.refreshToken)
  await auth.revokeSession(env, session.accessToken)
  report.observations.revocationAfterRotation = {
    rotatedAccessRemainsValid: Boolean(await auth.validateSession(env, rotated.accessToken)),
    rotatedRefreshRemainsUsable: Boolean(await auth.refreshSession(env, rotated.refreshToken))
  }
  const policy = loader()('src/main/privacy/capture-policy.ts')
  policy.setStrictMode(true)
  report.observations.strictWithoutProtectionAllowsCapture = policy.isCaptureAllowed()
  policy.pauseCapture('user-paused'); policy.pauseCapture('lock-screen'); policy.resumeCapture()
  report.observations.userPauseLostOnUnlock = policy.isCaptureAllowed()
  const stream = loader()('src/main/ai/sse-stream.ts')
  let text = ''
  const response = new Response('data:{"type":"content_block_delta","delta":{"text":"partial"}}\n\ndata:{"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\ndata:{"type":"message_stop"}\n\n')
  for await (const chunk of stream.readProviderText(response, 'claude')) text += chunk
  report.observations.claudeTokenLimitAcceptedAsComplete = text === 'partial'
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
