import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export const crossOrder = ['Screw_TL', 'Screw_BR', 'Screw_TR', 'Screw_BL'];
const screw = (page, id) => page.locator(`[data-screw="${id}"]`);
async function openControls(page, selector) {
  if (!await page.locator(selector).evaluate(element => element.open)) await page.locator(`${selector} summary`).click();
}
export async function tightenByKeyboard(page, id) {
  await openControls(page, '#hatch-controls');
  if (await screw(page, id).getAttribute('data-turns') === '0') return;
  await screw(page, id).click();
  // Selection of a tool in the belt must keep the selected screw's Q shortcut available.
  await page.locator('[data-tool="phillips"]').click(); await page.keyboard.down('q');
  try { await page.waitForFunction(id => document.querySelector(`[data-screw="${id}"]`).dataset.turns === '0', id, { timeout: 60000 }); }
  finally { await page.keyboard.up('q'); }
}
export async function closeHatchByKeyboard(page) {
  await openControls(page, '#hatch-controls');
  await page.locator('#hatch-pull').focus(); await page.keyboard.press('Home');
  await page.waitForFunction(() => !document.querySelector('[data-screw="Screw_TL"]').disabled);
  for (const id of crossOrder) await tightenByKeyboard(page, id);
  await page.locator('#check-closure').click();
  await page.waitForSelector('[data-step="test"][aria-current="step"]');
}
export async function powerOnByKeyboard(page) {
  await openControls(page, '#power-controls');
  await page.locator('#power-lever').focus(); await page.keyboard.press('Home');
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
  await page.locator('#power-cover').click();
  await page.waitForSelector('#app[data-test="pending"]');
  assert.equal(await page.locator('#alarm-status').getAttribute('data-active'), 'true');
  const before = Date.now();
  await page.waitForSelector('#app[data-phase="debrief"]');
  // Allow for the command round-trip, and assert the exact mission duration in the downloaded report below.
  assert.ok(Date.now() - before >= 1500);
  assert.equal(await page.locator('#alarm-status').getAttribute('data-active'), 'false');
}
export async function finishMissionByKeyboard(page) { await closeHatchByKeyboard(page); await powerOnByKeyboard(page); }

async function circle(page, p, clockwise, turns, stopId) {
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let i = 0; i <= turns * 24; i++) {
    const a = i / 24 * Math.PI * 2;
    await page.mouse.move(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26 * (clockwise ? 1 : -1));
    if (stopId && await screw(page, stopId).getAttribute('data-turns') === '0') break;
  }
  await page.mouse.up();
}
export async function downloadReport(page, artifacts, filename = 'bilan.json') {
  const pending = page.waitForEvent('download'); await page.locator('#export-report').click(); const download = await pending;
  assert.equal(download.suggestedFilename(), 'bilan-propulsion.json'); await download.saveAs(`${artifacts}/${filename}`);
  const report = JSON.parse(await readFile(`${artifacts}/${filename}`, 'utf8'));
  assert.equal(report.schemaVersion, 1); assert.equal(report.result, 'success'); assert.equal(report.steps.length, 5);
  assert.ok(report.steps.every(step => step.completed && Object.values(step.substeps).every(Boolean)));
  assert.ok(report.validations.every(v => v.source === 'gesture')); assert.equal(report.validations.length, 5);
  assert.ok(report.testAttempts.at(-1).finishedAtMs - report.testAttempts.at(-1).startedAtMs >= 2000);
  assert.equal(await page.locator('#summary-score').textContent(), `${String(report.score.value).replace('.', ',')} / 20`);
  assert.equal(Number(await page.locator('#error-count').textContent()), report.totalErrors);
  return report;
}
export async function runFinalChecks(page, artifacts, powerOff, openHatch, repairWires) {
  if (await page.locator('#app').getAttribute('data-phase') !== 'welcome') await page.locator('#restart').click();
  await page.locator('input[value="training"]').check();
  await page.locator('#welcome-sound').check();
  await page.locator('#welcome-form button[type="submit"]').click();
  for (let i = 0; i < 6; i++) {
    await page.waitForFunction(() => document.querySelector('#radio-next').textContent !== 'Afficher le message');
    await page.locator('#radio-next').click();
  }
  await powerOff(page); await openHatch(page); await repairWires(page);
  const dev = await page.evaluate(() => Boolean(window.__MARS_DEBUG__));
  const snapshot = () => page.evaluate(() => window.__MARS_DEBUG__.snapshot());
  await openControls(page, '#hatch-controls');
  await page.locator('#help').click();
  assert.equal(await page.locator('#radio').evaluate(radio => { const r = radio.getBoundingClientRect(); const c = radio.parentElement.getBoundingClientRect(); return r.top >= c.top && r.bottom <= c.bottom; }), true, 'Inès stays visible while the closure controls are open');
  // Cancelling a closing gesture must leave the hatch fully open.
  await page.locator('#hatch-pull').focus(); await page.keyboard.down('Home'); await page.keyboard.press('Escape'); await page.keyboard.up('Home');
  assert.equal(await page.locator('#hatch-pull').getAttribute('aria-valuenow'), '110');
  if (dev) {
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().visual.hatchProgress > 0.9999 && !window.__MARS_DEBUG__.snapshot().camera.inspectionReady);
    let t = (await snapshot()).hatchTargets;
    await page.mouse.move(t.edge.x, t.edge.y); await page.mouse.down();
    assert.equal((await snapshot()).state.hatch.dragging, true);
    await page.mouse.move(t.edge.x + t.travel * 0.4, t.edge.y, { steps: 6 }); await page.mouse.up();
    assert.ok((await snapshot()).state.hatch.progress > 0.5); assert.equal((await snapshot()).state.stepIndex, 3);
    await page.waitForTimeout(450); t = (await snapshot()).hatchTargets;
    await page.mouse.move(t.edge.x, t.edge.y); await page.mouse.down();
    assert.equal((await snapshot()).state.hatch.dragging, true);
    await page.mouse.move(t.edge.x + t.travel, t.edge.y, { steps: 8 }); await page.mouse.up();
  } else { await page.locator('#hatch-pull').focus(); await page.keyboard.press('Home'); }
  await page.waitForFunction(() => !document.querySelector('[data-screw="Screw_TL"]').disabled);
  await page.locator('#check-closure').click();
  assert.equal(await page.locator('#error-count').textContent(), '1');
  assert.equal(await page.locator('#hatch-feedback').textContent(), 'Une vis n’est pas serrée.');
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : OFF');
  await page.locator('[data-tool="phillips"]').click();
  if (dev) {
    const before = await snapshot(); const p = before.hatchTargets.screws.Screw_TR;
    await circle(page, p, false, 1);
    assert.equal((await snapshot()).state.hatch.screws.Screw_TR.turns, 4);
    await circle(page, p, true, 1);
    const partial = await snapshot(); assert.ok(partial.state.hatch.screws.Screw_TR.turns < 3.1);
    assert.ok(partial.visual.screws.find(s => s.id === 'Screw_TR').position[2] < before.visual.screws.find(s => s.id === 'Screw_TR').position[2]);
    await circle(page, p, true, 4.2, 'Screw_TR');
    assert.equal((await snapshot()).visual.crooked, true);
    await page.screenshot({ path: `${artifacts}/revissage.png` });
    for (const id of ['Screw_TL', 'Screw_BR', 'Screw_BL']) await tightenByKeyboard(page, id);
    assert.equal((await snapshot()).visual.crooked, false); assert.equal((await snapshot()).state.warnings.length, 1);
  } else for (const id of ['Screw_TR', 'Screw_TL', 'Screw_BR', 'Screw_BL']) await tightenByKeyboard(page, id);
  assert.equal(await page.locator('#screw-count').textContent(), 'Vis serrées : 4 / 4');
  await page.locator('#check-closure').click();
  await page.waitForSelector('[data-step="test"][aria-current="step"]');
  await openControls(page, '#power-controls');
  await page.locator('#power-lever').focus(); await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : OFF');
  await page.locator('#power-lever').focus(); await page.keyboard.down('Home'); await page.keyboard.press('Escape'); await page.keyboard.up('Home');
  assert.equal(await page.locator('#power-status').textContent(), 'Tension : OFF');
  if (dev) {
    await page.waitForFunction(() => window.__MARS_DEBUG__.snapshot().visual.leverProgress > 0.9999);
    const t = (await snapshot()).interactions; await page.mouse.move(t.lever.x, t.lever.y); await page.mouse.down();
    assert.equal((await snapshot()).state.power.dragging, true);
    await page.mouse.move(t.lever.x, t.lever.y - t.travel * 1.1, { steps: 8 }); await page.mouse.up();
    assert.equal(await page.locator('#power-status').textContent(), 'Tension : ON');
    assert.ok((await snapshot()).visual.ledEmissive.some(v => v > 0));
    const cover = (await snapshot()).interactions.cover; await page.mouse.click(cover.x, cover.y);
    await page.waitForSelector('#app[data-test="pending"]');
    assert.equal(await page.locator('#alarm-status').getAttribute('data-active'), 'true');
    await page.waitForSelector('#app[data-phase="debrief"]');
    assert.equal((await snapshot()).audio.lastEffect, 'startup');
  } else await powerOnByKeyboard(page);
  assert.equal(await page.locator('#alarm-status').getAttribute('data-active'), 'false');
  assert.equal(await page.locator('#summary-score').textContent(), '18,5 / 20');
  const report = await downloadReport(page, artifacts);
  assert.equal(report.totalErrors, 1); assert.equal(report.hintsUsed, 1); assert.equal(report.warnings.length, 1);
  assert.equal(report.steps[3].errors[0].code, 'looseScrew');
  // The result stays fixed while Inès explains it, and all actions remain locked.
  const time = await page.locator('#summary-time').textContent(); await page.waitForTimeout(1100);
  assert.equal(await page.locator('#summary-time').textContent(), time); assert.equal(await page.locator('#lamp').isDisabled(), true);
  await page.locator('#summary').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: `${artifacts}/bilan.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#summary').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${artifacts}/bilan-mobile.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await page.locator('#export-report').isEnabled(), true);
  assert.equal(await page.locator('#radio').evaluate(radio => { const r = radio.getBoundingClientRect(); const c = radio.parentElement.getBoundingClientRect(); return r.top >= c.top && r.bottom <= c.bottom; }), true, 'Inès stays visible next to the mobile report');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#restart').click(); assert.equal(await page.locator('#summary').isHidden(), true);
  assert.equal(await page.locator('#elapsed').textContent(), '00:00');
  if (dev) { const s = await snapshot(); assert.equal(s.state.report, null); assert.equal(s.state.test.attempts.length, 0); }
  console.log(JSON.stringify({ final: 'passed', input: dev ? '3D closing, clockwise screws, power up, cover click and keyboard' : 'keyboard', checks: 'partial/cancelled closing, loose screw lock, cross warning, two-second test, 18.5/20, JSON download, mobile result, restart' }));
}
