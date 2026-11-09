import { finishMissionByKeyboard } from './final-checks.mjs';
import assert from 'node:assert/strict';

const ids = Array.from({ length: 6 }, (_, i) => `wire${i + 1}`);
export async function openWireControls(page) {
  if (!await page.locator('#wire-controls').evaluate(e => e.open)) await page.locator('#wire-controls summary').click();
}
export async function inspectAll(page) {
  if (await page.locator('#lamp').getAttribute('aria-pressed') !== 'true') await page.locator('#lamp').click();
  await openWireControls(page);
  for (const id of ids) await page.locator(`[data-wire="${id}"]`).click();
  return page.locator('[data-wire]').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.wire, diagnosis: button.dataset.diagnosis,
    color: button.textContent.includes('rouge') ? 'red' : button.textContent.includes('jaune') ? 'yellow' : 'black' })));
}
export async function terminalByKeyboard(page, side, expected) {
  const selector = `[data-terminal="${side}"]`;
  if (await page.locator(selector).getAttribute('data-loosen') === String(expected)) return;
  await page.locator(selector).click();
  // Keep keyboard focus in the belt: the selected terminal must still respond.
  await page.locator('[data-tool="flat"]').click();
  await page.keyboard.down('q');
  try { await page.waitForFunction(({ selector, expected }) => document.querySelector(selector).dataset.loosen === String(expected), { selector, expected }, { timeout: 20000 }); }
  finally { await page.keyboard.up('q'); }
}
export async function repairWiresByKeyboard(page) {
  const wires = await inspectAll(page);
  for (const wire of wires.filter(w => w.diagnosis === 'broken')) {
    await page.locator(`[data-wire="${wire.id}"]`).click();
    if (await page.locator('#wire-mark').isEnabled()) await page.locator('#wire-mark').click();
    await page.locator('[data-tool="flat"]').click();
    for (const side of ['L', 'R']) await terminalByKeyboard(page, side, 1);
    await page.locator('#wire-remove').focus(); await page.keyboard.press('End');
    await page.waitForFunction(() => !document.querySelector('#wire-take').disabled);
    await page.locator(`[data-tool="${wire.color}"]`).click(); await page.locator('#wire-take').click();
    await page.locator('[data-tool="stripper"]').click();
    for (const side of ['L', 'R']) await page.locator(`[data-wire-end="${side}"]`).click();
    for (const side of ['L', 'R']) {
      await page.locator(`[data-wire-end="${side}"]`).click(); await page.locator('#wire-aim').click(); await page.locator('#wire-release').click();
      assert.equal(await page.locator(`[data-wire-end="${side}"]`).getAttribute('data-connected'), 'true');
    }
    for (const side of ['L', 'R']) await terminalByKeyboard(page, side, 0);
  }
  await page.waitForSelector('[data-step="close"][aria-current="step"]');
}

export async function runWireChecks(page, artifacts, powerOff, openHatch) {
  if (await page.locator('#app').getAttribute('data-phase') !== 'welcome') await page.locator('#restart').click();
  await page.locator('input[value="training"]').check(); await page.locator('#welcome-sound').check();
  await page.locator('#welcome-form button[type="submit"]').click();
  for (let i = 0; i < 6; i++) { await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message'); await page.locator('#radio-next').click(); }
  await powerOff(page); await openHatch(page); await openWireControls(page);
  assert.equal(await page.locator('#debug-validate').count(), 0);
  await page.locator('[data-wire="wire1"]').click();
  assert.equal(await page.locator('[data-wire="wire1"]').getAttribute('data-diagnosis'), 'unknown');
  assert.ok((await page.locator('#wire-feedback').textContent()).includes('lampe'));
  const wires = await inspectAll(page); const bad = wires.filter(w => w.diagnosis === 'broken');
  assert.ok(bad.length === 1 || bad.length === 2);
  const healthy = wires.find(w => w.diagnosis === 'intact');
  await page.locator(`[data-wire="${healthy.id}"]`).click(); await page.keyboard.press('e');
  assert.equal(await page.locator('#error-count').textContent(), '1');
  const selected = bad[0];
  await page.locator(`[data-wire="${selected.id}"]`).click(); await page.locator('#wire-mark').click();
  await page.locator('[data-terminal="L"]').click(); await page.locator('[data-tool="phillips"]').click(); await page.keyboard.press('q');
  assert.equal(await page.locator('#error-count').textContent(), '2');
  await page.locator('#wire-remove').focus(); await page.keyboard.press('End');
  assert.equal(await page.locator('#wire-remove').getAttribute('aria-valuenow'), '0');
  const dev = await page.evaluate(() => Boolean(window.__MARS_DEBUG__));
  const snapshot = () => page.evaluate(() => window.__MARS_DEBUG__.snapshot());
  await page.locator('[data-tool="flat"]').click();
  if (dev) {
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().camera.inspectionReady);
    const center = (await snapshot()).wireTargets[selected.id].terminals.L;
    await page.mouse.move(center.x, center.y); await page.mouse.down();
    for (let i = 0; i <= 12; i++) { const a = i / 24 * Math.PI * 2; await page.mouse.move(center.x + Math.cos(a) * 24, center.y - Math.sin(a) * 24); }
    await page.mouse.up();
    const state = (await snapshot()).state.wires.items.find(w => w.id === selected.id);
    assert.ok(state.terminals.L > 0.4 && state.terminals.L < 0.6);
  }
  for (const side of ['L', 'R']) await terminalByKeyboard(page, side, 1);
  if (dev) {
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().camera.inspectionReady);
    const p = (await snapshot()).wireTargets[selected.id].body;
    const rect = await page.locator('#mars-view').boundingBox();
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width + 70, p.y, { steps: 8 }); await page.mouse.up();
    assert.equal((await snapshot()).state.wires.items.find(w => w.id === selected.id).removed, true);
  } else { await page.locator('#wire-remove').focus(); await page.keyboard.press('End'); }
  const wrong = selected.color === 'red' ? 'yellow' : 'red';
  await page.locator(`[data-tool="${wrong}"]`).click(); await page.locator('#wire-take').click();
  assert.equal(await page.locator('#error-count').textContent(), '3');
  await page.locator(`[data-tool="${selected.color}"]`).click(); await page.locator('#wire-take').click();
  await page.locator('[data-tool="stripper"]').click();
  await page.locator('[data-wire-end="L"]').click(); await page.locator('[data-wire-end="L"]').click();
  assert.equal(await page.locator('#wire-move').isHidden(), true);
  await page.locator('[data-wire-end="R"]').click();
  if (dev) {
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().camera.inspectionReady);
    for (const side of ['L', 'R']) {
      let t = (await snapshot()).wireTargets[selected.id];
      await page.mouse.move(t.ends[side].x, t.ends[side].y); await page.mouse.down();
      assert.equal((await snapshot()).state.wires.gesture?.kind, 'end');
      await page.mouse.move(t.anchors[side].x, t.anchors[side].y, { steps: 7 });
      assert.equal((await snapshot()).state.wires.gesture.snapped, true);
      await page.mouse.up();
      assert.equal(await page.locator(`[data-wire-end="${side}"]`).getAttribute('data-connected'), 'true');
    }
    assert.ok((await snapshot()).nodes.every(node => node.count === 1));
    await page.locator('[data-tool="flat"]').click();
    const c = (await snapshot()).wireTargets[selected.id].terminals.L;
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    for (let i = 0; i <= 12; i++) { const a = i / 24 * Math.PI * 2; await page.mouse.move(c.x + Math.cos(a) * 24, c.y + Math.sin(a) * 24); }
    await page.mouse.up();
    const loose = (await snapshot()).state.wires.items.find(w => w.id === selected.id).terminals.L;
    assert.ok(loose > 0.4 && loose < 0.6);
  } else for (const side of ['L', 'R']) { await page.locator(`[data-wire-end="${side}"]`).click(); await page.keyboard.press('a'); await page.keyboard.press('Enter'); }
  for (const side of ['L', 'R']) await terminalByKeyboard(page, side, 0);
  if (bad.length > 1) await repairWiresByKeyboard(page);
  await page.waitForSelector('[data-step="close"][aria-current="step"]');
  assert.equal(await page.locator('[data-step="wires"] .error-marker').count(), 1);
  await page.screenshot({ path: `${artifacts}/faisceau-repare.png` });
  await finishMissionByKeyboard(page);
  await page.waitForSelector('#app[data-phase="debrief"]');
  assert.equal(await page.locator('#error-count').textContent(), '3');
  console.log(JSON.stringify({ wires: 'passed', input: dev ? '3D circles, removal, endpoint snapping and keyboard' : 'keyboard', faults: bad.length }));
}
