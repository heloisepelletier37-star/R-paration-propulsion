import assert from 'node:assert/strict';
import { openHatchByKeyboard } from './hatch-checks.mjs';
import { repairWiresByKeyboard } from './wires-checks.mjs';

export async function openPowerControls(page) {
  if (!await page.locator('#power-controls').evaluate(element => element.open)) await page.locator('#power-controls summary').click();
}
export async function powerOffByKeyboard(page) {
  await openPowerControls(page);
  if (await page.locator('#power-cover').isEnabled()) await page.locator('#power-cover').click();
  await page.waitForFunction(() => document.querySelector('#power-lever').getAttribute('aria-disabled') === 'false');
  await page.locator('#power-lever').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('#power-status').textContent === 'Tension : OFF');
  await page.waitForSelector('[data-step="open"][aria-current="step"]');
}
async function begin(page, mode) {
  await page.locator('#restart').click();
  await page.locator(`input[value="${mode}"]`).check();
  await page.locator('#welcome-sound').check();
  await page.locator('#welcome-form button[type="submit"]').click();
  for (let index = 0; index < 6; index++) {
    if (await page.locator('#app').getAttribute('data-phase') !== 'briefing') break;
    await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
    await page.locator('#radio-next').click();
  }
  await page.waitForSelector('#app[data-phase="running"]');
}
async function finishRemaining(page) {
  await openHatchByKeyboard(page);
  await repairWiresByKeyboard(page);
  for (let index = 0; index < 2; index++) { await page.locator('#debug-validate').click(); await page.waitForTimeout(100); }
  await page.waitForSelector('#app[data-phase="debrief"]');
}

export async function runPowerChecks(page, artifacts) {
  await begin(page, 'training');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const dev = await page.evaluate(() => typeof window.__MARS_DEBUG__ !== 'undefined');
  const snapshot = () => page.evaluate(() => window.__MARS_DEBUG__.snapshot());
  const targets = async () => (await snapshot()).interactions;
  await openPowerControls(page);
  // Even synthetic input cannot move the covered lever.
  await page.evaluate(() => document.querySelector('#power-lever').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
  assert.equal(await page.locator('#power-lever').getAttribute('aria-valuenow'), '0');
  await page.evaluate(() => {
    window.powerShockTrace = [];
    const scene = document.querySelector('.scene-shell');
    new MutationObserver(() => { if (scene.classList.contains('is-shocked')) window.powerShockTrace.push(true); }).observe(scene, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('pointerdown', event => { if (event.target.id === 'mars-view') window.powerPointer = event.pointerId; }, { capture: true });
  });
  if (dev) {
    const t = await targets();
    await page.mouse.click(t.hatch.x, t.hatch.y);
    assert.equal(await page.locator('#app').getAttribute('data-shock'), '0');
  }
  await page.locator('[data-tool="phillips"]').click();
  if (dev) {
    const t = await targets();
    await page.mouse.move(t.hatch.x, t.hatch.y); await page.mouse.down();
    await page.mouse.move(t.hatch.x + 4, t.hatch.y + 4, { steps: 3 }); await page.mouse.up();
  } else await page.locator('#hatch-contact').click();
  await page.waitForSelector('#app[data-shock="1"]');
  assert.equal(await page.locator('#error-count').textContent(), '1');
  assert.equal(await page.locator('#radio').getAttribute('data-kind'), 'error');
  assert.ok((await page.locator('#shock-alert').textContent()).startsWith('Choc électrique !'));
  assert.equal(await page.locator('[data-step="power"]').getAttribute('aria-current'), 'step');
  assert.equal(await page.evaluate(() => window.powerShockTrace.length > 0), true);
  await page.waitForFunction(() => !document.querySelector('#power-cover').disabled);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (dev) {
    assert.equal((await snapshot()).effect.shockId, 1);
    const t = await targets(); await page.mouse.click(t.cover.x, t.cover.y);
  } else {
    await openPowerControls(page); await page.locator('#power-cover').click();
  }
  await page.waitForFunction(() => document.querySelector('#power-lever').getAttribute('aria-disabled') === 'false');

  if (dev) {
    const before = (await snapshot()).camera;
    let t = await targets();
    await page.mouse.move(t.lever.x, t.lever.y); await page.mouse.down();
    await page.mouse.move(t.lever.x, t.lever.y + t.travel * 0.4, { steps: 5 });
    const progress = Number(await page.locator('#power-lever').getAttribute('aria-valuenow'));
    assert.ok(progress >= 30 && progress <= 55, `Partial drag reached ${progress}%`);
    await page.mouse.up();
    assert.equal(await page.locator('#power-lever').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().visual.leverProgress < 0.000001);
    t = await targets();
    await page.mouse.move(t.lever.x, t.lever.y); await page.mouse.down();
    assert.equal((await snapshot()).state.power.dragging, true);
    await page.mouse.move(t.lever.x, t.lever.y + t.travel * 1.25, { steps: 5 });
    await page.evaluate(() => document.querySelector('#mars-view').dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.powerPointer, bubbles: true })));
    await page.mouse.up();
    assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
    assert.equal(await page.locator('#power-lever').getAttribute('aria-valuenow'), '0');
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().visual.leverProgress < 0.000001);
    t = await targets();
    await page.mouse.move(t.lever.x, t.lever.y); await page.mouse.down();
    assert.equal((await snapshot()).state.power.dragging, true);
    await page.mouse.move(t.lever.x, t.lever.y + t.travel * 1.25, { steps: 6 });
    assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
    await page.mouse.up();
    await page.waitForSelector('[data-step="open"][aria-current="step"]');
    const after = await snapshot();
    assert.equal(after.camera.yaw, before.yaw); assert.equal(after.camera.pitch, before.pitch);
    assert.ok(after.visual.ledEmissive.every(value => value === 0));
    assert.equal(after.audio.alarmAudible, false); assert.equal(after.audio.volume, 0);
    assert.ok(after.nodes.every(node => node.count === 1));
    // Touch the face away from the central safety screw, now active in stage 2.
    t = await targets(); await page.mouse.click(t.hatch.x + 30, t.hatch.y + 30);
  } else {
    await page.locator('#power-lever').focus();
    for (let index = 0; index < 7; index++) await page.keyboard.down('ArrowDown');
    assert.equal(await page.locator('#power-lever').getAttribute('aria-valuenow'), '70');
    await page.keyboard.up('ArrowDown');
    assert.equal(await page.locator('#power-lever').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
    await page.keyboard.down('End'); await page.keyboard.press('Escape'); await page.keyboard.up('End');
    assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
    await powerOffByKeyboard(page);
    await openPowerControls(page); await page.locator('#hatch-contact').click();
    await page.locator('#power-controls summary').click();
  }
  assert.equal(await page.locator('#app').getAttribute('data-shock'), '1');
  assert.equal(await page.locator('#error-count').textContent(), '1');
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : OFF');
  assert.equal(await page.locator('#alarm-status').getAttribute('data-active'), 'true');
  await page.screenshot({ path: `${artifacts}/mise-hors-tension.png` });
  await finishRemaining(page);
  await begin(page, 'evaluation');
  await page.locator('[data-tool="flat"]').click(); await openPowerControls(page);
  await page.locator('#hatch-contact').click();
  await page.waitForSelector('#app[data-shock="1"]');
  assert.equal(await page.locator('#error-count').textContent(), 'Au bilan');
  assert.ok((await page.locator('#radio-text').textContent()).includes('Tu avances en autonomie.'));
  await page.waitForFunction(() => !document.querySelector('#power-cover').disabled);
  await powerOffByKeyboard(page); await finishRemaining(page);
  assert.equal(await page.locator('#error-count').textContent(), '1');
  assert.equal(await page.locator('[data-step="power"] .error-marker').count(), 1);
  console.log(JSON.stringify({ power: 'passed', input: dev ? '3D pointer and keyboard' : 'keyboard', checks: 'cover lock, insufficient drag, cancellation, release, shock, LED, alarm, journal, evaluation' }));
}
