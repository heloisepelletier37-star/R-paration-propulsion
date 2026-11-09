import { textes as t } from './textes.js';

const drawings = {
  power: '<rect x="50" y="12" width="60" height="72" rx="5"/><path d="M64 27h32M80 34v35"/><g class="demo-lever"><rect x="65" y="34" width="30" height="9" rx="3"/></g><path class="demo-arrow" d="m122 32 0 35m-7-7 7 7 7-7"/>',
  screw: '<circle cx="80" cy="48" r="20"/><path d="M68 48h24M80 36v24"/><g class="demo-turn"><path d="M48 32a37 37 0 1 1-3 23M48 32l-13 1 3-12"/></g>',
  wire: '<rect x="20" y="32" width="20" height="30" rx="3"/><rect x="120" y="32" width="20" height="30" rx="3"/><path class="demo-wire" d="M40 47q40 35 80 0"/><circle class="demo-connector" cx="80" cy="65" r="5"/>',
  hatch: '<rect x="37" y="13" width="86" height="72" rx="3"/><circle cx="47" cy="23" r="4"/><circle cx="113" cy="75" r="4"/><circle cx="113" cy="23" r="4"/><circle cx="47" cy="75" r="4"/><path class="demo-cross" d="m47 23 66 52V23L47 75"/>',
  test: '<rect x="35" y="15" width="54" height="70" rx="4"/><path d="M62 33v33"/><g class="demo-lever-up"><rect x="47" y="58" width="30" height="9" rx="3"/></g><circle class="demo-led" cx="120" cy="36" r="11"/><path d="m110 70 7 7 12-16"/>',
};

export function demoMarkup(kind, stepId) {
  if (kind === 'tutorial') {
    return `<div class="gesture-tutorial" aria-label="${t.tutorial.title}">
      <div><span class="gesture-drag" aria-hidden="true">↔</span><strong>${t.tutorial.drag}</strong><small>${t.tutorial.dragKey}</small></div>
      <div><span class="gesture-turn" aria-hidden="true">↶</span><strong>${t.tutorial.turn}</strong><small>${t.tutorial.turnKey}</small></div>
      <div><span class="gesture-mark" aria-hidden="true">⌖</span><strong>${t.tutorial.mark}</strong><small>${t.tutorial.markKey}</small></div>
    </div>`;
  }
  if (!drawings[kind]) return '';
  return `<figure class="action-demo" data-demo="${kind}"><svg viewBox="0 0 160 96" role="img" aria-label="${t.steps[stepId].demo}">${drawings[kind]}</svg><figcaption>${t.steps[stepId].demo}</figcaption></figure>`;
}
