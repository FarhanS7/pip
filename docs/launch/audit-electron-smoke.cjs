// Run after npm run build with the project's Electron executable.
// Isolated, hidden renderer/IPC smoke check; not hardware or installer qualification.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const electron = require('electron')
const { app } = electron
process.on('uncaughtException', error => { console.error('AUDIT_SMOKE_ERROR ' + error.message); app.exit(1) })
const root = path.resolve(__dirname, '../..')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-review-profile-'))
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
process.env.NODE_ENV = 'production'
process.env.PIP_ENV = 'dev'
process.env.PIP_WORKER_URL = 'http://127.0.0.1:1'
process.env.PIP_SHARED_SECRET = 'audit-fixture-only'
delete process.env.ELECTRON_RENDERER_URL
const RealWindow = electron.BrowserWindow
const auditWindows = []
class HiddenWindow extends RealWindow {
  constructor(options) { super({ ...options, show: false }); auditWindows.push(this) }
  static getAllWindows() { return auditWindows.filter(window => !window.isDestroyed()) }
  show() {} showInactive() {} focus() {}
}
const Module = require('node:module')
const originalLoad = Module._load
const auditElectron = { ...electron, BrowserWindow: HiddenWindow }
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return auditElectron
  return originalLoad.call(this, request, parent, isMain)
}
electron.desktopCapturer.getSources = async () => [] // Never capture the desktop.
let finishStream
let requests = 0
global.fetch = async url => {
  if (String(url) !== 'http://127.0.0.1:1/chat') throw new Error('Audit blocks all non-fixture requests')
  requests++
  return new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('data:{"choices":[{"delta":{"content":"Fixture answer [POINT:none]"}}]}\n\n'))
    finishStream = () => { controller.enqueue(new TextEncoder().encode('data:[DONE]\n\n')); controller.close() }
  } }), { headers: { 'content-type': 'text/event-stream' } })
}
const report = { source: '7992ded', profile: 'temporary isolated profile', capture: 'disabled', provider: 'in-process fixture', observations: {} }
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_event, _level, message) => console.log('AUDIT_RENDERER ' + message))
  contents.on('preload-error', (_event, _path, error) => console.error('AUDIT_PRELOAD ' + error.message))
})
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(check) {
  for (let i = 0; i < 100; i++) { const result = await check(); if (result) return result; await pause(100) }
  throw new Error('Smoke wait timed out')
}
const watchdog = setTimeout(() => { console.error('AUDIT_SMOKE_TIMEOUT'); app.exit(1) }, 30000)
app.whenReady().then(() => electron.session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
  callback({ cancel: !/^(file:|data:|blob:)/.test(details.url) })
}))
require(path.join(root, 'out/main/index.js'))
async function main() {
  await app.whenReady()
  const panel = await waitFor(() => HiddenWindow.getAllWindows().find(window => window.webContents.getURL().includes('/panel/index.html')))
  await waitFor(() => panel.webContents.executeJavaScript('Boolean(window.pipAPI && document.querySelector("#typed-request"))').catch(() => false))
  report.observations.renderersLoaded = HiddenWindow.getAllWindows().map(window => path.basename(path.dirname(new URL(window.webContents.getURL()).pathname)))
  report.observations.panel = await panel.webContents.executeJavaScript(`(async () => {
    const results = { typedInputPresent: Boolean(document.querySelector('#typed-request')) };
    for (const name of ['getPermissions','getCapturePolicy','pauseCapture','resumeCapture','collectDiagnostics','completeOnboarding']) {
      try { results[name] = { ok: true, value: await window.pipAPI[name]() }; }
      catch { results[name] = { ok: false }; }
    }
    await window.pipAPI.setSetting('selectedAIProvider', 'openai');
    await window.pipAPI.setSetting('selectedTTSProvider', 'openai-tts');
    return results;
  })()`)
  await panel.webContents.executeJavaScript("window.pipAPI.submitText('Audit fixture request')")
  await waitFor(() => requests === 1)
  await pause(200)
  const overlay = HiddenWindow.getAllWindows().find(window => window.webContents.getURL().includes('/overlay/index.html'))
  report.observations.rawPointTagDisplayed = overlay ? await overlay.webContents.executeJavaScript("document.body.innerText.includes('[POINT:none]')") : null
  report.observations.stateBeforeReload = await panel.webContents.executeJavaScript("document.body.innerText.includes('Speaking...')")
  panel.webContents.reload()
  await new Promise(resolve => panel.webContents.once('did-finish-load', resolve))
  await waitFor(() => panel.webContents.executeJavaScript('Boolean(document.querySelector("#typed-request"))').catch(() => false))
  report.observations.idleShownDuringActiveStreamAfterReload = await panel.webContents.executeJavaScript("document.body.innerText.includes('Hold or Click to Speak')")
  await panel.webContents.executeJavaScript('window.pipAPI.cancelTurn()')
  // Cancellation owns stream cleanup; never synthesize/play audio in this audit.
  report.observations.fixtureChatRequests = requests
  report.observations.streamCreated = Boolean(finishStream)
  console.log('AUDIT_SMOKE_RESULT ' + JSON.stringify(report))
}
main().catch(async error => {
  console.error('AUDIT_SMOKE_ERROR ' + error.message)
  for (const window of HiddenWindow.getAllWindows()) {
    console.log('AUDIT_WINDOW ' + window.webContents.getURL())
    try { console.log('AUDIT_DOM ' + JSON.stringify(await window.webContents.executeJavaScript('({api: Boolean(window.pipAPI), text: document.body.innerText.slice(0, 200), html: document.body.innerHTML.slice(0, 100)})'))) } catch {}
  }
  process.exitCode = 1
}).finally(() => {
  clearTimeout(watchdog)
  app.quit()
  setTimeout(() => app.exit(process.exitCode || 0), 1000).unref()
})
