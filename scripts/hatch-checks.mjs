import assert from 'node:assert/strict';

const ids = ['Screw_TL', 'Screw_TR', 'Screw_BL', 'Screw_BR'];
const screw = (page, id) => page.locator(`[data-screw="${id}"]`);
export async function openHatchControls(page) {
  if (!await page.locator('#hatch-controls').evaluate(element => element.open)) await page.locator('#hatch-controls summary').click();
}
export async function unscrewByKeyboard(page, id) {
  await openHatchControls(page);
  if (await screw(page, id).isDisabled()) return;
  await screw(page, id).click(); await page.keyboard.down('q');
  try { await page.waitForFunction(id => document.querySelector(`[data-screw="${id}"]`).disabled, id, { timeout: 60000 }); }
  finally { await page.keyboard.up('q'); }
}
export async function openHatchByKeyboard(page) {
  if (await page.locator('[data-tool="phillips"]').getAttribute('aria-pressed') !== 'true') await page.locator('[data-tool="phillips"]').click();
  for (const id of ids) await unscrewByKeyboard(page, id);
  await page.locator('#hatch-pull').focus(); await page.keyboard.press('End');
  await page.waitForSelector('[data-step="wires"][aria-current="step"]');
}
async function circle(page, center, clockwise, turns, stopId) {
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  for (let i = 0; i <= turns * 24; i++) {
    const a = i / 24 * Math.PI * 2;
    await page.mouse.move(center.x + Math.cos(a) * 29, center.y + Math.sin(a) * 29 * (clockwise ? 1 : -1));
    if (stopId && await screw(page, stopId).isDisabled()) break;
  }
  await page.mouse.up();
}
export async function runHatchChecks(page, artifacts, powerOff) {
  if (await page.locator('#app').getAttribute('data-phase') !== 'welcome') await page.locator('#restart').click();
  await page.locator('input[value="training"]').check();
  await page.locator('#welcome-form button[type="submit"]').click();
  for (let i = 0; i < 6; i++) {
    await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
    await page.locator('#radio-next').click();
  }
  await page.waitForSelector('#app[data-phase="running"]');
  await powerOff(page); await openHatchControls(page);
  const dev = await page.evaluate(() => Boolean(window.__MARS_DEBUG__));
  const snapshot = () => page.evaluate(() => window.__MARS_DEBUG__.snapshot());
  const targets = async () => (await snapshot()).hatchTargets;
  assert.equal(await page.locator('#debug-validate').isDisabled(), true);
  await page.locator('[data-tool="flat"]').click();
  if (dev) { const t = await targets(); await page.mouse.click(t.screws.Screw_TL.x, t.screws.Screw_TL.y); }
  else { await screw(page, 'Screw_TL').click(); await page.keyboard.press('q'); }
  assert.equal(await page.locator('#error-count').textContent(), '1');
  assert.ok((await page.locator('#hatch-feedback').textContent()).includes('dérape'));
  assert.equal(await page.locator('#screw-count').textContent(), 'Vis conservées : 0 / 4');
  if (dev) {
    assert.equal((await snapshot()).visual.screws.find(s => s.id === 'Screw_TL').scratched, true);
    assert.equal((await snapshot()).audio.lastEffect, 'slip');
  }
  await page.locator('[data-tool="phillips"]').click();
  if (dev) { const t = await targets(); await page.mouse.click(t.screws.Screw_Safety.x, t.screws.Screw_Safety.y); }
  else { await screw(page, 'Screw_Safety').click(); await page.keyboard.press('q'); }
  assert.equal(await page.locator('#error-count').textContent(), '2');
  assert.ok((await page.locator('#radio-text').textContent()).includes('vis centrale'));
  await page.locator('#hatch-pull').focus(); await page.keyboard.press('End');
  assert.equal(await page.locator('#hatch-pull').getAttribute('aria-valuenow'), '0');
  assert.equal(await page.locator('#hatch-pull').getAttribute('aria-disabled'), 'true');
  // Q means the letter Q, including on AZERTY (where its physical code is KeyA).
  await screw(page, 'Screw_TR').click();
  await screw(page, 'Screw_TR').evaluate(button => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyA', bubbles: true })));
  try {
    await page.waitForFunction(() => !document.querySelector('[data-screw="Screw_TR"] small').textContent.startsWith('0,0'));
    assert.equal(await page.locator('#reset').isDisabled(), true);
  } finally {
    await screw(page, 'Screw_TR').evaluate(button => button.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', code: 'KeyA', bubbles: true })));
  }
  if (dev) {
    const before = await snapshot(); const t = await targets();
    await circle(page, t.screws.Screw_TL, true, 1);
    assert.equal((await snapshot()).state.hatch.screws.Screw_TL.turns, 0);
    assert.equal((await snapshot()).state.hatch.feedbackCode, 'clockwise');
    await circle(page, t.screws.Screw_TL, false, 1.5);
    const partial = await snapshot();
    assert.ok(partial.state.hatch.screws.Screw_TL.turns > 1.4 && partial.state.hatch.screws.Screw_TL.turns < 1.6);
    assert.ok(partial.visual.screws.find(s => s.id === 'Screw_TL').position[2] > before.visual.screws.find(s => s.id === 'Screw_TL').position[2]);
    for (const id of ids) { const t = await targets(); await circle(page, t.screws[id], false, 4.2, id); assert.equal(await screw(page, id).isDisabled(), true); }
    const after = await snapshot();
    assert.equal(after.camera.yaw, before.camera.yaw); assert.equal(after.camera.pitch, before.camera.pitch);
    assert.ok(after.visual.screws.every(s => !s.visible));
    assert.ok(after.nodes.every(n => n.count === 1));
  } else for (const id of ids) await unscrewByKeyboard(page, id);
  assert.equal(await page.locator('#screw-count').textContent(), 'Vis conservées : 4 / 4');
  assert.equal(await page.locator('[data-step="open"]').getAttribute('data-status'), 'current');
  assert.equal(await page.locator('#hatch-pull').getAttribute('aria-disabled'), 'false');
  await page.locator('#hatch-pull').focus(); await page.keyboard.down('End'); await page.keyboard.press('Escape'); await page.keyboard.up('End');
  assert.equal(await page.locator('#hatch-pull').getAttribute('aria-valuenow'), '0');
  if (dev) {
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().visual.hatchProgress < 0.00001);
    let t = await targets();
    await page.mouse.move(t.edge.x, t.edge.y); await page.mouse.down();
    assert.equal((await snapshot()).state.hatch.dragging, true);
    await page.mouse.move(t.edge.x - t.travel * 0.4, t.edge.y, { steps: 6 }); await page.mouse.up();
    assert.equal((await snapshot()).state.stepIndex, 1);
    await page.waitForTimeout(450);
    t = await targets(); await page.mouse.move(t.edge.x, t.edge.y); await page.mouse.down();
    assert.equal((await snapshot()).state.hatch.dragging, true);
    await page.mouse.move(t.edge.x - t.travel * 0.8, t.edge.y, { steps: 10 });
    assert.equal((await snapshot()).state.stepIndex, 1);
    await page.mouse.up();
  } else { await page.locator('#hatch-pull').focus(); await page.keyboard.press('End'); }
  await page.waitForSelector('[data-step="wires"][aria-current="step"]');
  assert.equal(await page.locator('[data-step="open"]').getAttribute('data-status'), 'complete');
  assert.equal(await page.locator('[data-step="open"] .error-marker').count(), 1);
  await page.locator('#lamp').click();
  await page.screenshot({ path: `${artifacts}/trappe-ouverte.png` });
  for (let i = 0; i < 3; i++) { await page.locator('#debug-validate').click(); await page.waitForTimeout(100); }
  await page.waitForSelector('#app[data-phase="debrief"]');
  assert.equal(await page.locator('#error-count').textContent(), '2');
  console.log(JSON.stringify({ hatch: 'passed', input: dev ? '3D circles, 3D pull and keyboard' : 'keyboard',
    checks: dev ? 'wrong tool, safety screw, four turns, clockwise blocking, collection, pull lock, cancellation, hinge, automatic validation'
      : 'wrong tool, safety screw, four turns, Q on AZERTY, collection, pull lock, cancellation, automatic validation' }));
}
