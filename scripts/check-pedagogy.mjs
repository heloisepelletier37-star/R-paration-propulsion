import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { resolveConfig } from 'vite';
import { powerOffByKeyboard, runPowerChecks } from './power-checks.mjs';
import { openHatchByKeyboard, runHatchChecks } from './hatch-checks.mjs';
import { repairWiresByKeyboard, runWireChecks } from './wires-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const externalTarget = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const hatchOnly = process.argv.includes('--hatch');
const wiresOnly = process.argv.includes('--wires');
const { base } = await resolveConfig({ root }, 'serve');
const target = externalTarget ?? new URL(base, 'http://127.0.0.1:5199/').href;
const executablePath = process.env.CHROMIUM_PATH ?? ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find(existsSync);
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chrome or Chromium executable.');
const artifacts = process.env.MARS_ARTIFACT_DIR ?? fileURLToPath(new URL('../.artifacts/', import.meta.url));
await mkdir(artifacts, { recursive: true });
let server;
let serverOutput = '';
let browser;
const errors = [];

try {
  if (!externalTarget) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverOutput += chunk; });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput);
      try { if ((await fetch(target)).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, `Vite did not start: ${serverOutput}`);
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(target);
  await page.waitForSelector('#app[data-ready="true"][data-phase="welcome"]');
  if (wiresOnly) {
    await runWireChecks(page, artifacts, powerOffByKeyboard, openHatchByKeyboard);
  } else if (hatchOnly) {
    await runHatchChecks(page, artifacts, powerOffByKeyboard);
  } else {
  await page.screenshot({ path: `${artifacts}/accueil.png` });
  assert.equal(await page.locator('#welcome').getAttribute('role'), 'dialog');
  assert.equal(await page.locator('input[value="training"]').isChecked(), true);
  await page.locator('#welcome-form button[type="submit"]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('input[value="training"]').evaluate(input => input === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#welcome-form button[type="submit"]').evaluate(button => button === document.activeElement), true);
  assert.equal(await page.locator('.radio img, .radio-avatar, .radio svg').count(), 0);
  await page.locator('#welcome-form button[type="submit"]').click();
  await page.waitForSelector('#app[data-phase="briefing"]');
  assert.equal(await page.locator('#debug-validate').isDisabled(), true);
  assert.equal(await page.locator('#lamp').isDisabled(), true);
  assert.equal(await page.locator('.toolbelt button:disabled').count(), 7);
  await page.keyboard.press('l'); await page.keyboard.press('1');
  assert.equal(await page.locator('#lamp').getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => document.querySelector('#debug-validate').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(await page.locator('.checklist-step[data-status="complete"]').count(), 0);
  for (let index = 1; index <= 6; index++) {
    await page.waitForFunction(index => document.querySelector('#radio-category').textContent.endsWith(`${index} SUR 6`), index);
    if (index === 2) assert.equal(await page.locator('#checklist').getAttribute('class'), 'checklist is-presented');
    if (index === 6) assert.equal(await page.locator('.gesture-tutorial > div').count(), 3);
    await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
    await page.locator('#radio-next').press('Space');
  }
  await page.waitForSelector('#app[data-phase="running"]');
  assert.equal(await page.locator('.checklist-step[aria-current="step"]').getAttribute('data-step'), 'power');
  assert.equal(await page.locator('.substeps li').count(), 2);
  assert.equal(await page.locator('#debug-validate').isDisabled(), true);
  await page.locator('[data-tool="phillips"]').click();
  assert.equal(await page.locator('[data-tool="phillips"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#mars-view').focus(); await page.keyboard.press('2');
  assert.equal(await page.locator('[data-tool="flat"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('l'); assert.equal(await page.locator('#lamp').getAttribute('aria-pressed'), 'true');
  for (let level = 1; level <= 3; level++) {
    await page.locator('#help').click();
    assert.equal(await page.locator('#hint-count').textContent(), String(level));
    assert.equal(await page.locator('#radio-category').textContent(), `Indice ${level} / 3`);
  }
  assert.equal(await page.locator('[data-demo="power"]').count(), 1);
  await page.locator('#radio-toggle').click();
  await page.locator('#help').click();
  assert.equal(await page.locator('#radio-body').isHidden(), true);
  assert.equal(await page.locator('#radio-unread').isVisible(), true);
  await page.locator('#radio-toggle').click();
  await page.locator('#debug-error').click();
  assert.equal(await page.locator('#radio').getAttribute('data-kind'), 'error');
  assert.equal(await page.locator('[data-step="power"] .error-marker').count(), 1);
  await powerOffByKeyboard(page);
  assert.equal(await page.locator('[data-step="power"]').getAttribute('data-status'), 'complete');
  assert.equal(await page.locator('[data-step="power"] .error-marker').count(), 1);
  assert.equal(await page.locator('#radio').getAttribute('data-kind'), 'success');
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : OFF');
  await page.locator('#briefing').click();
  assert.equal(await page.locator('#debug-validate').isDisabled(), true);
  for (let index = 0; index < 6; index++) {
    await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
    await page.locator('#radio-next').click();
  }
  await page.waitForSelector('#app[data-phase="running"]');
  assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-step'), 'open');
  assert.equal(await page.locator('[data-tool="flat"]').getAttribute('aria-pressed'), 'true');
  await openHatchByKeyboard(page);
  await page.waitForSelector('[data-step="wires"][aria-current="step"]');
  assert.equal(await page.locator('.substeps li').count(), 5);
  await page.locator('#help').click();
  await page.screenshot({ path: `${artifacts}/accompagnement.png` });
  // Narrow layouts keep the checklist and message column outside the canvas.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${artifacts}/accompagnement-mobile.png` });
  const layout = await page.evaluate(() => {
    const scene = document.querySelector('#mars-view').getBoundingClientRect();
    const radio = document.querySelector('#radio').getBoundingClientRect();
    const checklist = document.querySelector('.checklist-panel').getBoundingClientRect();
    return { overlaps: scene.left < radio.right && scene.right > radio.left && scene.top < radio.bottom && scene.bottom > radio.top, checklistVisible: checklist.width > 0 && checklist.height > 0, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(layout.overlaps, false); assert.equal(layout.checklistVisible, true); assert.equal(layout.overflow, false);
  await page.setViewportSize({ width: 1280, height: 900 });
  await repairWiresByKeyboard(page);
  for (let index = 0; index < 2; index++) { await page.locator('#debug-validate').click(); await page.waitForTimeout(100); }
  await page.waitForSelector('#app[data-phase="debrief"]');
  assert.equal(await page.locator('.checklist-step[data-status="complete"]').count(), 5);
  const transcript = [];
  for (let index = 0; index < 12; index++) {
    if (await page.locator('#app').getAttribute('data-phase') === 'complete') break;
    await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
    transcript.push(await page.locator('#radio-text').textContent());
    await page.locator('#radio-next').click();
  }
  assert.equal(await page.locator('#app').getAttribute('data-phase'), 'complete');
  assert.ok(transcript.join(' ').includes('Toujours couper l’alimentation avant d’ouvrir.'));
  await page.locator('#restart').click();
  await page.locator('input[value="evaluation"]').check();
  await page.locator('#welcome-sound').uncheck();
  await page.locator('#welcome-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#radio-category').textContent.endsWith('1 SUR 1'));
  await page.waitForFunction(() => document.querySelector('#radio-next').textContent === 'Je suis prêt');
  await page.locator('#radio-next').click();
  await page.waitForSelector('#app[data-phase="running"][data-mode="evaluation"]');
  assert.equal(await page.locator('#help').isHidden(), true);
  assert.equal(await page.locator('.substeps').count(), 0);
  assert.equal(await page.locator('.checklist-step').count(), 5);
  await page.locator('#debug-error').click();
  assert.equal(await page.locator('.error-marker').count(), 0);
  assert.equal(await page.locator('#error-count').textContent(), 'Au bilan');
  assert.ok((await page.locator('#radio-text').textContent()).includes('Tu avances en autonomie.'));
  await powerOffByKeyboard(page);
  await openHatchByKeyboard(page);
  await repairWiresByKeyboard(page);
  for (let index = 0; index < 2; index++) { await page.locator('#debug-validate').click(); await page.waitForTimeout(100); }
  await page.waitForSelector('#app[data-phase="debrief"]');
  assert.equal(await page.locator('#error-count').textContent(), '1');
  assert.equal(await page.locator('[data-step="power"] .error-marker').count(), 1);
  await runPowerChecks(page, artifacts);
  await runHatchChecks(page, artifacts, powerOffByKeyboard);
  await runWireChecks(page, artifacts, powerOffByKeyboard, openHatchByKeyboard);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(hatchOnly || wiresOnly ? { passed: true, scope: wiresOnly ? 'wire replacement' : 'hatch gestures', consoleErrors: errors, artifacts }
    : { passed: true, training: '6-message lock, tools, hints, errors, replay, five stages, debrief', evaluation: '1-message lock, no help, hidden feedback until debrief', layout: 'desktop and mobile, no overlap', consoleErrors: errors, artifacts }, null, 2));
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: `${artifacts}/echec-parcours.png` }).catch(() => {});
    const state = await page.evaluate(() => window.__MARS_DEBUG__?.snapshot() ?? ({ phase: document.querySelector('#app')?.dataset.phase, feedback: document.querySelector('#wire-feedback')?.textContent })).catch(() => null);
    await writeFile(`${artifacts}/echec-etat.json`, JSON.stringify(state, null, 2));
  }
  throw error;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) server.kill('SIGTERM');
}
