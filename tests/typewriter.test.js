import test from 'node:test';
import assert from 'node:assert/strict';
import { createTypewriter } from '../src/ui/typewriter.js';

function mockMotion(t, reduced = false) {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: reduced });
  t.after(() => { if (original) globalThis.matchMedia = original; else delete globalThis.matchMedia; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
}

test('text appears progressively and announces completion once', async t => {
  mockMotion(t);
  const element = { textContent: '' }; const completed = [];
  const writer = createTypewriter(element, id => completed.push(id));
  writer.render({ id: 1, text: 'Bonjour Mars', complete: false });
  assert.equal(element.textContent, 'B');
  t.mock.timers.tick(22); assert.equal(element.textContent, 'Bo');
  for (let index = 0; index < 10; index++) t.mock.timers.tick(22);
  await Promise.resolve();
  assert.equal(element.textContent, 'Bonjour Mars'); assert.deepEqual(completed, [1]);
  writer.render({ id: 1, text: 'Bonjour Mars', complete: true });
  assert.deepEqual(completed, [1]);
});

test('skipping typing reveals the whole message and cancels old callbacks', async t => {
  mockMotion(t);
  const element = { textContent: '' }; const completed = [];
  const writer = createTypewriter(element, id => completed.push(id));
  writer.render({ id: 1, text: 'Premier message', complete: false });
  writer.render({ id: 1, text: 'Premier message', complete: true });
  assert.equal(element.textContent, 'Premier message');
  writer.render({ id: 2, text: 'Second', complete: false });
  for (let index = 0; index < 10; index++) t.mock.timers.tick(22);
  await Promise.resolve();
  assert.equal(element.textContent, 'Second'); assert.deepEqual(completed, [2]);
  writer.render(null); t.mock.timers.tick(500);
  assert.equal(element.textContent, '');
});

test('reduced motion shows the complete text immediately', async t => {
  mockMotion(t, true);
  const element = { textContent: '' }; let completed;
  const writer = createTypewriter(element, id => { completed = id; });
  writer.render({ id: 3, text: 'Message sans animation', complete: false });
  assert.equal(element.textContent, 'Message sans animation');
  await Promise.resolve(); assert.equal(completed, 3);
});
