import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
assert.ok(existsSync(resolve(dist, 'index.html')), 'Run npm run build first.');
const artifacts = resolve(root, '.artifacts');
await mkdir(artifacts, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
const server = createServer(async (request, response) => {
  // The opaque sandbox origin needs CORS for module scripts, as on GitHub Pages.
  response.setHeader('Access-Control-Allow-Origin', '*');
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/iframe-test.html') {
    response.setHeader('Permissions-Policy', 'autoplay=(), fullscreen=()');
  }
  const file = resolve(dist, `.${path === '/' ? '/index.html' : path}`);
  if (!file.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(file);
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  const executablePath = process.env.CHROMIUM_PATH ?? ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find(existsSync);
  assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chrome or Chromium executable.');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const scenarios = [
    { name: 'sandbox', mode: 'training' },
    { name: 'audio-constructor', mode: 'evaluation', audioFailure: 'constructor', key: 'Enter' },
    { name: 'audio-resume-rejected', mode: 'training', audioFailure: 'reject', key: 'Space' },
    { name: 'audio-resume-pending', mode: 'evaluation', audioFailure: 'pending' },
    { name: 'audio-effect', mode: 'training', audioFailure: 'effect' },
    { name: 'standalone', mode: 'evaluation', standalone: true },
  ];
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 950 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    await context.addInitScript(({ audioFailure }) => {
      if (window === window.top) return;
      const denied = () => { throw new DOMException('Denied by iframe host', 'SecurityError'); };
      // These optional browser APIs must never prevent START, even if they throw
      // synchronously or return a rejected promise rather than a simple denial.
      Element.prototype.requestPointerLock = denied;
      Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied by iframe host', 'NotAllowedError'));
      window.alert = denied;
      window.confirm = denied;
      window.__audioCalls = 0;
      if (audioFailure === 'constructor') {
        window.AudioContext = window.webkitAudioContext = function () { window.__audioCalls++; denied(); };
      } else if (audioFailure === 'reject' || audioFailure === 'pending') {
        AudioContext.prototype.resume = function () {
          window.__audioCalls++;
          return audioFailure === 'pending' ? new Promise(() => {}) : Promise.reject(new DOMException('Audio denied', 'NotAllowedError'));
        };
      } else if (audioFailure === 'effect') {
        const createOscillator = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function () {
          if (++window.__audioCalls > 1) denied();
          return createOscillator.call(this);
        };
        // Allow setup to finish so the first notification exercises a playback
        // failure, independently of the host's autoplay policy.
        AudioContext.prototype.resume = function () {
          Object.defineProperty(this, 'state', { configurable: true, value: 'running' });
          return Promise.resolve();
        };
      }
    }, scenario);
    try {
      await page.goto(`${origin}/${scenario.standalone ? '' : 'iframe-test.html'}`);
      const app = scenario.standalone ? page : page.frameLocator('#simulation');
      await app.locator('#app[data-ready="true"][data-phase="welcome"]').waitFor();
      const frame = scenario.standalone ? page.mainFrame() : page.frames().find(frame => frame.parentFrame());
      if (!scenario.standalone) {
        assert.equal(await frame.evaluate(() => {
          try { localStorage.setItem('iframe-check', 'test'); return false; }
          catch (error) { return error.name === 'SecurityError'; }
        }), true, 'The sandbox must really deny localStorage.');
        assert.equal(await frame.evaluate(() => (document.permissionsPolicy ?? document.featurePolicy).allowsFeature('fullscreen')), false);
      }
      await app.locator(`input[value="${scenario.mode}"]`).check();
      assert.equal(await app.locator('#welcome-sound').isChecked(), true);
      const start = app.getByRole('button', { name: 'Commencer la mission' });
      if (scenario.key) await start.press(scenario.key);
      else await start.click();
      await app.locator('#app[data-phase="briefing"]').waitFor({ timeout: 5000 });
      assert.equal(await app.locator('#welcome').isHidden(), true);
      assert.equal(await app.locator('#lamp').isDisabled(), true, 'Starting must preserve the mandatory briefing.');
      const count = scenario.mode === 'training' ? 6 : 1;
      for (let index = 0; index < count; index++) {
        await frame.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
        await app.locator('#radio-next').click();
      }
      await app.locator('#app[data-phase="running"]').waitFor();
      if (scenario.audioFailure) {
        assert.ok(await frame.evaluate(() => window.__audioCalls > 0), 'The injected audio failure must be exercised.');
        await app.locator('#audio[aria-pressed="false"]').waitFor();
        if (scenario.audioFailure !== 'pending') assert.equal(await app.locator('#audio').isEnabled(), true);
      }
      if (scenario.standalone) await app.locator('#audio[aria-pressed="true"]').waitFor();
      await app.locator('#lamp').click();
      assert.equal(await app.locator('#lamp').getAttribute('aria-pressed'), 'true');
      await app.locator('#power-controls summary').click();
      await app.locator('#power-cover').click();
      await app.locator('#power-lever[aria-disabled="false"]').waitFor();
      assert.equal(await app.locator('#power-status').textContent(), 'Tension : ON');
      if (scenario.name === 'sandbox') await page.screenshot({ path: resolve(artifacts, 'iframe-start.png') });
      assert.deepEqual(errors, [], scenario.name);
      results.push({ scenario: scenario.name, mode: scenario.mode, passed: true });
      console.log(JSON.stringify(results.at(-1)));
    } catch (error) {
      await page.screenshot({ path: resolve(artifacts, `iframe-failure-${scenario.name}.png`) }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({ passed: true, scenarios: results.length, consoleErrors: [], screenshot: resolve(artifacts, 'iframe-start.png') }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
