import { textes as t } from './textes.js';
import { STEPS, TOOLS, canAct, currentStep, sceneState, canUseBreaker, canOpenHatch, canRepairWires } from '../state/procedure.js';
import { isScrewdriver } from '../steps/step1-power.js';
import { ALL_SCREWS, removed, removedCount } from '../steps/step2-hatch.js';
import { WIRE_DEFS, SIDES } from '../steps/step3-wires.js';
import { briefingCount, stepStatus } from '../state/machine.js';
import { icon } from './icons.js';
import { demoMarkup } from './demos.js';
import { createTypewriter } from './typewriter.js';

export function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createHud() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <a class="skip-link" href="#mars-view">${t.skip}</a>
    <header id="mission-header" class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">△</span><div><strong>${t.brand}</strong><span>${t.brandSub}</span></div></div>
      <div class="location"><span class="location-dot"></span>${t.location}</div>
      <div class="header-actions">
        <button id="briefing" type="button">${icon('book')}<span>${t.radio.replay}</span></button>
        <button id="help" type="button">${icon('help')}<span>${t.radio.help}</span></button>
        <button id="audio" type="button" aria-label="${t.controls.audioLabel}" aria-pressed="false">${icon('audio')}<span>${t.controls.audio}</span></button>
      </div>
    </header>
    <main id="mission-layout" class="mission-layout">
      <aside class="checklist-panel" aria-labelledby="checklist-title">
        <p id="mode-label" class="eyebrow"></p>
        <h2 id="checklist-title">${t.checklist.title}</h2>
        <p id="procedure-progress" class="small-note"></p>
        <ol id="checklist" class="checklist"></ol>
        <section class="debug-panel" aria-label="${t.debug.title}">
          <span class="eyebrow">${t.debug.badge}</span><p>${t.debug.note}</p>
          <button id="debug-validate" type="button">${t.debug.validate}</button>
          <button id="debug-error" class="quiet-button" type="button">${t.debug.error}</button>
        </section>
      </aside>
      <section class="scene-shell" aria-label="${t.title}">
        <canvas id="mars-view" tabindex="0" role="img" aria-label="${t.sceneLabel}"></canvas>
        <div class="visor" aria-hidden="true"></div>
        <div class="shock-flash" aria-hidden="true"></div><p id="shock-alert" class="shock-alert" role="alert" hidden>${t.shock.title}</p>
        <div class="scene-telemetry"><span id="power-status"></span><span id="screw-count"></span><span id="alarm-status"></span></div>
        <div id="screw-guide" class="screw-guide" aria-hidden="true" hidden><span id="screw-guide-value"></span></div>
        <p id="hatch-feedback" class="hatch-feedback" role="status" hidden></p>
        <p id="wire-feedback" class="hatch-feedback" role="status" hidden></p>
        <div id="scene-lock" class="scene-lock"><span>${t.controls.locked}</span></div>
        <div class="scene-help"><span id="scene-instructions">${t.controls.look}</span><small>${t.controls.zoom}</small></div>
        <section id="summary" class="summary" aria-labelledby="summary-title" hidden>
          <span class="eyebrow">${t.debug.badge}</span><h2 id="summary-title">${t.debrief.title}</h2><p>${t.debrief.note}</p>
          <button id="restart" class="primary-button" type="button">${t.debrief.restart}</button>
        </section>
      </section>
      <aside class="comms-column">
        <div class="mission-context"><span class="eyebrow">${t.mission}</span><h1>${t.title}</h1><p id="current-step"></p>
          <dl class="metrics"><div><dt>${t.metrics.time}</dt><dd id="elapsed">00:00</dd></div><div><dt>${t.metrics.errors}</dt><dd id="error-count">0</dd></div><div><dt>${t.metrics.hints}</dt><dd id="hint-count">0</dd></div></dl>
        </div>
        <details id="power-controls" class="power-controls"><summary>${t.powerControls.title}</summary>
          <button id="power-cover" type="button">${t.powerControls.cover}</button>
          <div class="lever-input"><div id="power-lever" role="slider" aria-label="${t.powerControls.lever}" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-describedby="lever-keyboard" tabindex="-1"><span class="lever-threshold" aria-hidden="true">${t.powerControls.threshold}</span><span class="lever-handle" aria-hidden="true"></span></div><span id="lever-value"></span></div>
          <p id="lever-keyboard" class="small-note">${t.powerControls.keyboard}</p>
          <button id="hatch-contact" type="button">${t.powerControls.hatch}</button>
        </details>
        <details id="hatch-controls" class="power-controls" hidden><summary>${t.hatchControls.title}</summary>
          <div class="screw-choices" role="group" aria-label="${t.hatchControls.screwsTitle}">${ALL_SCREWS.map(id => `<button type="button" data-screw="${id}" aria-pressed="false">${t.hatchControls.names[id]}<small></small></button>`).join('')}</div>
          <p class="small-note">${t.hatchControls.keyboard}</p>
          <div id="hatch-pull" role="slider" aria-label="${t.hatchControls.pullLabel}" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="110" aria-valuenow="0" tabindex="-1"><span aria-hidden="true">←</span></div>
          <p id="hatch-angle" class="small-note"></p><p class="small-note">${t.hatchControls.pullKeyboard}</p>
        </details>
        <details id="wire-controls" class="power-controls" hidden><summary>${t.wireControls.title}</summary>
          <div class="wire-choices" role="group" aria-label="${t.wireControls.choose}">${WIRE_DEFS.map(wire => `<button type="button" data-wire="${wire.id}" aria-pressed="false">${t.wireControls.wire(wire.index, t.wireControls.colors[wire.color])}<small></small></button>`).join('')}</div>
          <p id="wire-summary" class="small-note"></p><p id="wire-diagnosis"></p>
          <button id="wire-mark" type="button">${t.wireControls.mark}</button>
          <div class="terminal-choices">${SIDES.map(side => `<button type="button" data-terminal="${side}" aria-pressed="false">${t.wireControls.terminal(t.wireControls.sides[side])}<small></small></button>`).join('')}</div>
          <p class="small-note">${t.wireControls.terminalHelp}</p>
          <div id="wire-remove" role="slider" aria-label="${t.wireControls.remove}" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="-1"><span aria-hidden="true">↓</span></div><p class="small-note">${t.wireControls.removeHelp}</p>
          <button id="wire-take" type="button">${t.wireControls.take}</button>
          <div class="wire-ends">${SIDES.map(side => `<button type="button" data-wire-end="${side}"></button>`).join('')}</div>
          <p class="small-note">${t.wireControls.endHelp}</p>
          <div id="wire-move" tabindex="-1" role="group" aria-label="${t.wireControls.moveLabel}" hidden><p id="wire-distance" role="status"></p><p class="small-note">${t.wireControls.moveHelp}</p><button id="wire-aim" type="button">${t.wireControls.aim}</button><button id="wire-release" type="button">${t.wireControls.release}</button></div>
          <button id="wire-overview" type="button">${t.wireControls.overview}</button>
        </details>
        <section id="radio" class="radio" data-kind="instruction" aria-label="${t.radio.title}">
          <div class="radio-header"><span class="radio-signal" aria-hidden="true">≋</span><h2>${t.radio.title}</h2><button id="radio-toggle" type="button" aria-label="${t.radio.collapse}" aria-controls="radio-body" aria-expanded="true">−</button></div>
          <span id="radio-unread" class="unread-badge" hidden>${t.radio.unread}</span>
          <div id="radio-body"><p id="radio-category" class="eyebrow"></p><p id="radio-text" aria-hidden="true"></p><div id="radio-demo"></div>
            <button id="radio-next" class="primary-button" type="button">${t.radio.next}</button><small class="keyboard-note">${t.radio.keyboard}</small>
          </div>
        </section>
      </aside>
    </main>
    <footer id="mission-footer" class="bottom-bar">
      <div class="belt-heading"><h2>${t.tools.title}</h2><span id="selected-tool">${t.tools.none}</span><button id="put-down" class="quiet-button" type="button">${t.tools.putDown}</button></div>
      <div class="toolbelt" role="toolbar" aria-label="${t.tools.title}">
        ${TOOLS.map((tool, index) => `<button type="button" class="tool" data-tool="${tool.id}" aria-label="${t.tools[tool.id].detail}" aria-pressed="false" title="${t.tools[tool.id].detail}"><kbd>${index + 1}</kbd>${icon(tool.icon)}<span>${t.tools[tool.id].label}</span></button>`).join('')}
      </div>
      <div class="view-actions"><button id="lamp" type="button" aria-label="${t.controls.lampLabel}" aria-pressed="false">${icon('lamp')}<kbd>L</kbd></button><button id="reset" type="button" aria-label="${t.controls.resetLabel}">${icon('reset')}<kbd>R</kbd></button></div>
    </footer>
    <div id="welcome" class="welcome-screen" role="dialog" aria-modal="true" aria-labelledby="welcome-title" hidden>
      <form id="welcome-form" class="welcome-card">
        <p class="eyebrow">${t.welcome.eyebrow}</p><h1 id="welcome-title">${t.title}</h1><p class="welcome-intro">${t.welcome.introduction}</p>
        <fieldset><legend>${t.welcome.choice}</legend>
          <label class="mode-card"><input type="radio" name="mode" value="training" checked><span><small>${t.welcome.recommended}</small><strong>${t.welcome.training}</strong><span>${t.welcome.trainingDetail}</span></span></label>
          <label class="mode-card"><input type="radio" name="mode" value="evaluation"><span><small>${t.welcome.independent}</small><strong>${t.welcome.evaluation}</strong><span>${t.welcome.evaluationDetail}</span></span></label>
        </fieldset>
        <label class="sound-choice"><input id="welcome-sound" type="checkbox" checked>${t.welcome.sound}</label>
        <button class="primary-button start-button" type="submit">${t.welcome.start}${icon('arrow')}</button><p class="small-note">${t.welcome.note}</p>
      </form>
    </div>
    <p id="radio-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    <p id="feedback" class="sr-only" role="status" aria-live="polite"></p>
    <div id="loading" class="loading" role="status"><span class="loading-orbit" aria-hidden="true"></span><strong>${t.loading}</strong><span>${t.loadingDetail}</span><progress max="1" value="0" aria-label="${t.loading}"></progress></div>
  `;
  const canvas = document.querySelector('#mars-view');
  const $ = selector => app.querySelector(selector);
  let onAction = () => {};
  let state;
  let checklistSignature;
  let messageId;
  let previousPhase;
  let powerReleaseId = 0;
  let hatchFeedbackId = 0;
  let wireFeedbackId = 0;
  let selectedWire;
  let wireStage = false;
  const writer = createTypewriter($('#radio-text'), id => onAction({ type: 'TYPING_FINISHED', messageId: id }));
  const emit = event => onAction(event);
  const advance = () => {
    if (state?.radioCollapsed) return emit({ type: 'TOGGLE_RADIO' });
    if (state?.message) emit({ type: 'MESSAGE_NEXT', messageId: state.message.id });
  };
  $('#welcome-form').addEventListener('submit', event => {
    event.preventDefault(); emit({ type: 'START', mode: new FormData(event.currentTarget).get('mode'), audio: $('#welcome-sound').checked });
  });
  $('#radio-next').addEventListener('click', advance);
  $('#radio-toggle').addEventListener('click', () => emit({ type: 'TOGGLE_RADIO' }));
  $('#briefing').addEventListener('click', () => emit({ type: 'REPLAY_BRIEFING' }));
  $('#help').addEventListener('click', () => emit({ type: 'REQUEST_HINT' }));
  $('#debug-validate').addEventListener('click', event => {
    if (event.detail < 2) emit({ type: 'DEBUG_VALIDATE_STEP', stepId: currentStep(state).id });
  });
  $('#debug-error').addEventListener('click', () => emit({ type: 'RECORD_ERROR', stepId: currentStep(state).id, code: currentStep(state).error, source: 'debug' }));
  $('#restart').addEventListener('click', () => emit({ type: 'RESTART' }));
  $('#put-down').addEventListener('click', () => emit({ type: 'SELECT_TOOL', toolId: null }));
  $('#power-cover').addEventListener('click', () => emit({ type: 'OPEN_POWER_COVER' }));
  $('#hatch-contact').addEventListener('click', () => emit({ type: 'TOUCH_HATCH', nodeName: 'Hatch' }));
  $('.screw-choices').addEventListener('click', event => {
    const button = event.target.closest('[data-screw]');
    if (button && !button.disabled) { emit({ type: 'SELECT_SCREW', screwId: button.dataset.screw }); $('#feedback').textContent = t.hatchControls.selected(t.hatchControls.names[button.dataset.screw]); }
  });
  $('.wire-choices').addEventListener('click', event => { const button = event.target.closest('[data-wire]'); if (button && !button.disabled) emit({ type: 'WIRE_INSPECT', wireId: button.dataset.wire }); });
  $('.terminal-choices').addEventListener('click', event => { const button = event.target.closest('[data-terminal]'); if (button && !button.disabled) emit({ type: 'WIRE_TERMINAL_SELECT', side: button.dataset.terminal }); });
  $('#wire-mark').addEventListener('click', () => emit({ type: 'WIRE_MARK' }));
  $('#wire-take').addEventListener('click', () => emit({ type: 'WIRE_CHOOSE_REPLACEMENT' }));
  $('#wire-overview').addEventListener('click', () => emit({ type: 'WIRE_CLEAR_SELECTION' }));
  $('.toolbelt').addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (button && !button.disabled) emit({ type: 'SELECT_TOOL', toolId: button.dataset.tool });
  });
  $('.toolbelt').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !canAct(state)) return;
    const buttons = [...$('.toolbelt').querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    event.preventDefault(); buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length].focus();
  });
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || !state) return;
    const target = event.target instanceof Element ? event.target : document.body;
    if (state.phase === 'welcome' && event.key === 'Tab') {
      const controls = [...$('#welcome').querySelectorAll('input, button')]
        .filter(control => !control.disabled && (control.type !== 'radio' || control.checked));
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (target === first || !$('#welcome').contains(target))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (target === last || !$('#welcome').contains(target))) {
        event.preventDefault(); first.focus();
      }
      return;
    }
    const nativeControl = target.closest('button, input, select, textarea, a, [role="slider"]');
    if (event.code === 'Space' && !nativeControl && state.message) { event.preventDefault(); advance(); return; }
    if (!canAct(state) || target.closest('input, select, textarea')) return;
    const tool = TOOLS.find(item => item.key === event.code);
    if (tool) { event.preventDefault(); emit({ type: 'SELECT_TOOL', toolId: tool.id }); }
    if (event.code === 'Escape') emit({ type: 'SELECT_TOOL', toolId: null });
  });

  function renderChecklist(s) {
    const signature = JSON.stringify([s.steps, s.mode, s.stepIndex, s.hasBegun, s.phase, s.briefingIndex]);
    if (signature === checklistSignature) return;
    checklistSignature = signature;
    const detailed = s.mode === 'training';
    const showErrors = detailed || ['debrief', 'complete'].includes(s.phase);
    $('#checklist').classList.toggle('is-presented', s.phase === 'briefing' && s.briefingIndex === 1);
    $('#checklist').innerHTML = STEPS.map((step, index) => {
      const result = s.steps[index]; const status = stepStatus(s, index);
      const hasError = showErrors && result.errors.length;
      return `<li class="checklist-step" data-step="${step.id}" data-status="${status}" ${status === 'current' ? 'aria-current="step"' : ''}>
        <div class="step-heading" aria-label="${t.steps[step.id].title} : ${t.checklist[status]}"><span class="step-number" aria-hidden="true">${status === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}</span><span class="step-title">${t.steps[step.id].title}${detailed ? `<small>${t.checklist[status]}</small>` : ''}</span>${hasError ? `<span class="error-marker" role="img" aria-label="${t.checklist.error(result.errors.length)}">⚠</span>` : ''}</div>
        ${detailed && status === 'current' ? `<ul class="substeps">${step.substeps.map(id => `<li data-done="${result.substeps[id]}" aria-label="${t.steps[step.id].substeps[id]} : ${result.substeps[id] ? t.checklist.substepDone : t.checklist.todo}"><span aria-hidden="true">${result.substeps[id] ? '✓' : '○'}</span>${t.steps[step.id].substeps[id]}</li>`).join('')}</ul>` : ''}
      </li>`;
    }).join('');
  }

  return {
    canvas, app,
    leverControl: $('#power-lever'),
    hatchControls: $('#hatch-controls'), hatchSlider: $('#hatch-pull'), screwGuide: $('#screw-guide'),
    wireControls: $('#wire-controls'), wireRemove: $('#wire-remove'), wireMove: $('#wire-move'), wireAim: $('#wire-aim'), wireRelease: $('#wire-release'), wireEnds: $('.wire-ends'),
    lampButton: $('#lamp'), audioButton: $('#audio'), resetButton: $('#reset'),
    connect(handler) { onAction = handler; },
    progress(value) { $('progress').value = value; },
    ready() {
      $('#loading').remove();
      app.dataset.ready = 'true';
    },
    feedback(message) { $('#feedback').textContent = message; },
    render(s) {
      state = s;
      const active = canAct(s);
      const welcome = ['loading', 'welcome'].includes(s.phase);
      const finished = ['debrief', 'complete'].includes(s.phase);
      const hiddenEvaluation = s.mode === 'evaluation' && !finished;
      app.dataset.phase = s.phase;
      app.dataset.mode = s.mode ?? '';
      $('#welcome').hidden = !welcome;
      for (const selector of ['#mission-header', '#mission-layout', '#mission-footer']) $(selector).inert = welcome;
      canvas.inert = !active;
      canvas.tabIndex = active ? 0 : -1;
      $('#scene-lock').hidden = active || finished || s.phase === 'running';
      $('.scene-shell').classList.toggle('is-shocked', s.shock.active);
      app.dataset.shock = String(s.shock.id);
      $('#shock-alert').hidden = !s.shock.active;
      $('#scene-instructions').textContent = active && s.stepIndex === 0 ? t.powerControls.pointer : active && s.stepIndex === 1 ? t.hatchControls.pointer : active && s.stepIndex === 2 ? t.wireControls.pointer : t.controls.look;
      $('#mode-label').textContent = s.mode ? t.modes[s.mode] : t.welcome.choice;
      $('#procedure-progress').textContent = t.checklist.progress(s.steps.filter(step => step.completed).length, STEPS.length);
      $('#current-step').textContent = finished ? t.debrief.title : t.steps[currentStep(s).id].title;
      $('#elapsed').textContent = formatTime(s.elapsedMs);
      $('#error-count').textContent = hiddenEvaluation ? t.metrics.endOnly : String(s.errors.length);
      $('#hint-count').textContent = hiddenEvaluation ? '—' : String(s.hintsUsed);
      const physical = sceneState(s);
      $('#power-status').textContent = physical.circuitOn ? t.power.on : t.power.off;
      $('#alarm-status').textContent = physical.alarmActive ? t.power.alarm : t.power.restored;
      $('#alarm-status').dataset.active = String(physical.alarmActive);
      $('#lamp').setAttribute('aria-pressed', String(s.headlamp));
      $('#audio').setAttribute('aria-pressed', String(s.audio));
      for (const selector of ['#lamp', '#reset', '#debug-error']) $(selector).disabled = !active;
      $('#reset').disabled = !active || s.power.dragging || s.hatch.turning || s.hatch.dragging || Boolean(s.wires.gesture);
      $('#debug-validate').disabled = !active || s.stepIndex < 3;
      $('#debug-validate').title = s.stepIndex === 0 ? t.debug.realPower : s.stepIndex === 1 ? t.debug.realHatch : s.stepIndex === 2 ? t.debug.realWires : t.debug.validate;
      $('#power-cover').disabled = !canUseBreaker(s) || s.power.cover !== 'closed';
      $('#power-cover').textContent = s.power.cover === 'closed' ? t.powerControls.cover : s.power.cover === 'opening' ? t.powerControls.opening : t.powerControls.opened;
      const leverEnabled = canUseBreaker(s) && s.power.cover === 'open';
      $('#power-lever').setAttribute('aria-disabled', String(!leverEnabled));
      $('#power-lever').tabIndex = leverEnabled ? 0 : -1;
      const percent = Math.round(s.power.leverProgress * 100);
      $('#power-lever').setAttribute('aria-valuenow', String(percent));
      $('#power-lever').setAttribute('aria-valuetext', t.powerControls.progress(percent));
      $('#power-lever').style.setProperty('--lever-progress', s.power.leverProgress);
      $('#lever-value').textContent = t.powerControls.progress(percent);
      $('#hatch-contact').disabled = !active || !isScrewdriver(s.selectedTool);
      $('#hatch-contact').title = isScrewdriver(s.selectedTool) ? t.powerControls.hatch : t.powerControls.toolRequired;
      if (s.phase === 'welcome') powerReleaseId = 0;
      if (s.shock.active || (s.power.releaseId !== powerReleaseId && s.power.lastRelease === 'success')) $('#power-controls').open = false;
      powerReleaseId = s.power.releaseId;
      const h = s.hatch;
      $('#hatch-controls').hidden = s.stepIndex !== 1 || finished;
      const hatchEnabled = canOpenHatch(s);
      $('#screw-count').textContent = t.hatchControls.counter(s.steps[3].completed ? 0 : removedCount(h));
      $('#screw-count').hidden = !s.hasBegun;
      for (const button of $('.screw-choices').querySelectorAll('[data-screw]')) {
        const id = button.dataset.screw; const screw = h.screws[id];
        button.disabled = !hatchEnabled || removed(screw);
        button.setAttribute('aria-pressed', String(h.selectedScrew === id));
        button.querySelector('small').textContent = removed(screw) ? t.hatchControls.removedLabel : t.hatchControls.turns(screw.turns);
      }
      const pullEnabled = hatchEnabled && removedCount(h) === 4;
      $('#hatch-pull').setAttribute('aria-disabled', String(!pullEnabled));
      $('#hatch-pull').tabIndex = pullEnabled ? 0 : -1;
      const angle = Math.round(h.progress * 110);
      $('#hatch-pull').setAttribute('aria-valuenow', String(angle));
      $('#hatch-pull').setAttribute('aria-valuetext', t.hatchControls.angle(angle));
      $('#hatch-pull').style.setProperty('--hatch-progress', h.progress);
      $('#hatch-angle').textContent = t.hatchControls.angle(angle);
      $('#screw-guide-value').textContent = h.selectedScrew ? t.hatchControls.turns(h.screws[h.selectedScrew].turns) : '';
      $('#hatch-feedback').hidden = !active || s.stepIndex !== 1 || !h.feedbackCode;
      if (h.feedbackId !== hatchFeedbackId) {
        hatchFeedbackId = h.feedbackId;
        const feedback = (s.mode === 'evaluation' ? t.hatchControls.evaluation[h.feedbackCode] : null) ?? t.hatchControls.feedback[h.feedbackCode] ?? '';
        $('#hatch-feedback').textContent = feedback;
      }
      if (s.stepIndex !== 1) $('#hatch-controls').open = false;
      const repair = canRepairWires(s); const w = s.wires.items.find(item => item.id === s.wires.selected);
      $('#wire-controls').hidden = s.stepIndex !== 2 || finished;
      if (s.stepIndex === 2 && !wireStage) $('#wire-controls').open = true;
      wireStage = s.stepIndex === 2;
      if (w && selectedWire !== w.id) $('#wire-controls').open = true;
      selectedWire = w?.id;
      if (s.stepIndex !== 2) $('#wire-controls').open = false;
      for (const button of $('.wire-choices').querySelectorAll('[data-wire]')) {
        const wire = s.wires.items.find(item => item.id === button.dataset.wire);
        button.disabled = !repair; button.setAttribute('aria-pressed', String(wire.id === w?.id));
        const diagnosis = !wire.inspected || !s.headlamp ? 'unknown' : wire.repaired ? 'repaired' : wire.broken ? 'broken' : 'intact';
        button.dataset.diagnosis = diagnosis;
        button.querySelector('small').textContent = t.wireControls.diagnosis[diagnosis] ?? t.wireControls.unknown;
      }
      $('#wire-summary').textContent = t.wireControls.summary(s.wires.items.filter(item => item.marked).length, s.wires.items.filter(item => item.repaired).length);
      $('#wire-diagnosis').textContent = w?.inspected && s.headlamp ? t.wireControls.diagnosis[w.repaired ? 'repaired' : w.broken ? 'broken' : 'intact'] : s.headlamp ? t.wireControls.unknown : t.wireControls.dark;
      $('#wire-mark').disabled = !repair || !s.headlamp || !w?.inspected || w.marked;
      $('#wire-mark').textContent = w?.marked ? t.wireControls.marked : t.wireControls.mark;
      for (const button of $('.terminal-choices').querySelectorAll('[data-terminal]')) {
        const side = button.dataset.terminal;
        button.disabled = !repair || !s.headlamp || !w?.marked || w.repaired;
        button.setAttribute('aria-pressed', String(side === s.wires.terminal));
        button.dataset.loosen = String(w?.terminals[side] ?? 0);
        button.querySelector('small').textContent = t.wireControls.turns(w?.terminals[side] ?? 0);
      }
      const canRemove = repair && s.headlamp && w?.marked && !w.removed && SIDES.every(side => w.terminals[side] === 1);
      $('#wire-remove').setAttribute('aria-disabled', String(!canRemove)); $('#wire-remove').tabIndex = canRemove ? 0 : -1;
      $('#wire-remove').setAttribute('aria-valuenow', String(Math.round((s.wires.gesture?.kind === 'remove' ? s.wires.gesture.progress : 0) * 100)));
      $('#wire-take').disabled = !repair || !s.headlamp || !w?.removed || Boolean(w.replacement);
      for (const button of $('.wire-ends').querySelectorAll('[data-wire-end]')) {
        const side = button.dataset.wireEnd; const r = w?.replacement;
        button.disabled = !repair || !s.headlamp || !r || r.connected[side];
        button.textContent = r?.connected[side] ? t.wireControls.connected(t.wireControls.sides[side]) : r?.stripped[side] ? t.wireControls.grab(t.wireControls.sides[side]) : t.wireControls.strip(t.wireControls.sides[side]);
        button.dataset.stripped = String(r?.stripped[side] ?? false); button.dataset.connected = String(r?.connected[side] ?? false);
      }
      const movingEnd = s.wires.gesture?.kind === 'end';
      $('#wire-move').hidden = !movingEnd;
      $('#wire-distance').textContent = movingEnd ? s.wires.gesture.snapped ? t.wireControls.snapped : t.wireControls.distance(s.wires.gesture.distance ?? 0) : '';
      $('#wire-overview').disabled = !repair || !w;
      $('#wire-feedback').hidden = !repair || !s.wires.feedbackCode || (s.wires.feedbackCode === 'dark' && s.headlamp);
      if (wireFeedbackId !== s.wires.feedbackId) {
        wireFeedbackId = s.wires.feedbackId;
        $('#wire-feedback').textContent = s.wires.feedbackCode === 'diagnosis' && w?.inspected && s.headlamp
          ? t.wireControls.diagnosis[w.repaired ? 'repaired' : w.broken ? 'broken' : 'intact']
          : (s.mode === 'evaluation' ? t.wireControls.physical[s.wires.feedbackCode] : null) ?? t.wireControls.feedback[s.wires.feedbackCode] ?? '';
      }
      $('#put-down').disabled = !active || !s.selectedTool;
      $('#briefing').disabled = !['running', 'debrief', 'complete'].includes(s.phase);
      $('#help').hidden = s.mode !== 'training'; $('#help').disabled = !active;
      $('#help').title = s.steps[s.stepIndex].hintLevel === 3 ? t.radio.demoAgain : t.radio.help;
      $('#summary').hidden = !finished;
      for (const button of $('.toolbelt').querySelectorAll('button')) {
        button.disabled = !active; button.setAttribute('aria-pressed', String(button.dataset.tool === s.selectedTool));
      }
      $('#selected-tool').textContent = s.selectedTool ? t.tools[s.selectedTool].detail : t.tools.none;
      renderChecklist(s);
      const m = s.message;
      $('#radio').dataset.kind = m?.kind ?? 'instruction';
      $('#radio').classList.toggle('is-collapsed', s.radioCollapsed);
      $('#radio').classList.toggle('has-unread', s.unread);
      $('#radio-body').hidden = s.radioCollapsed;
      $('#radio-unread').hidden = !s.unread;
      $('#radio-toggle').textContent = s.radioCollapsed ? '+' : '−';
      $('#radio-toggle').setAttribute('aria-expanded', String(!s.radioCollapsed));
      $('#radio-toggle').setAttribute('aria-label', s.radioCollapsed ? t.radio.expand : t.radio.collapse);
      $('#radio-category').textContent = s.phase === 'briefing' ? `${s.resume ? `${t.radio.replayNote} · ` : ''}${t.radio.briefing(s.briefingIndex + 1, briefingCount(s))}`
        : m?.topic === 'hint' ? t.radio.hintProgress(s.steps[s.stepIndex].hintLevel) : t.radio[m?.kind ?? 'instruction'];
      if (m) writer.render(m);
      else { writer.render(null); $('#radio-text').textContent = s.mode === 'evaluation' ? t.radio.evaluationSilence : t.radio.waiting; }
      if (m?.id !== messageId) {
        messageId = m?.id;
        $('#radio-announcement').textContent = m ? `${t.radio.title}. ${m.text}` : '';
        $('#radio-demo').innerHTML = m?.demo ? demoMarkup(m.demo, currentStep(s).id) : '';
      }
      $('#radio-next').hidden = !m || s.phase === 'complete';
      $('#radio-next').textContent = m && !m.complete ? t.radio.reveal
        : s.phase === 'briefing' && s.briefingIndex === briefingCount(s) - 1 ? t.radio.ready
          : s.phase === 'running' && !s.messageQueue.length ? t.radio.understood : t.radio.next;
      if (s.phase !== previousPhase) {
        if (s.phase === 'welcome' && previousPhase && previousPhase !== 'loading') $('#welcome-sound').checked = s.audio;
        previousPhase = s.phase;
        queueMicrotask(() => {
          if (s.phase === 'welcome') $('#welcome input[name="mode"]:checked').focus();
          else if (s.phase === 'briefing' || s.phase === 'debrief') $('#radio-next').focus();
          else if (s.phase === 'running') canvas.focus({ preventScroll: true });
          else if (s.phase === 'complete') $('#restart').focus();
        });
      }
    },
    fatal() {
      const loading = $('#loading');
      if (loading) loading.innerHTML = `<strong role="alert">${t.fatalTitle}</strong><span>${t.fatalMessage}</span>`;
    },
  };
}
