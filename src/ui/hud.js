import { textes as t } from './textes.js';

const icons = {
  lamp: '<path d="M9 7h5l4 3v4l-4 3H9zM5 9v6M21 8l2-2m-2 12 2 2M21 12h3"/>',
  audio: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
};
const icon = name => `<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

export function createHud() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <a class="skip-link" href="#mars-view">${t.skip}</a>
    <canvas id="mars-view" tabindex="0" role="img" aria-label="${t.sceneLabel}"></canvas>
    <div class="visor" aria-hidden="true"></div>
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">△</span><div><strong>${t.brand}</strong><span>${t.brandSub}</span></div></div>
      <div class="location"><span class="location-dot"></span>${t.location}</div>
      <div class="connection"><i aria-hidden="true"></i>${t.radioStatus}</div>
    </header>
    <main class="hud" aria-labelledby="mission-title">
      <section class="mission-copy">
        <p class="eyebrow">${t.mission}</p>
        <h1 id="mission-title">${t.title}</h1>
        <p class="subtitle">${t.subtitle}</p>
      </section>
      <aside class="radio" aria-label="${t.radioName} — ${t.radioRole}">
        <div class="radio-header"><div><strong>${t.radioName}</strong><small>${t.radioRole}</small></div><span class="radio-wave" aria-label="${t.live}"><i></i><i></i><i></i><i></i><i></i></span></div>
        <p>${t.radioMessage}</p>
      </aside>
      <section class="observation-card">
        <p class="eyebrow"><span class="phase-line"></span>${t.phase}</p>
        <h2>${t.objectiveTitle}</h2>
        <ol>${t.objectives.map((text, index) => `<li><span>0${index + 1}</span>${text}</li>`).join('')}</ol>
        <p class="observation-note">${t.observation}</p>
      </section>
      <div class="status-strip">
        <span><i class="status-dot power"></i>${t.power}</span>
        <span class="alarm-status" aria-label="${t.alarmCaption}"><i class="status-dot alarm"></i>${t.alarm}</span>
      </div>
    </main>
    <footer class="bottom-bar">
      <div class="view-help"><span class="drag-symbol" aria-hidden="true">↔</span><div><strong>${t.look}</strong><span>${t.keyboard}</span><small>${t.zoom}</small></div></div>
      <div class="actions">
        <button id="lamp" type="button" aria-label="${t.lampLabel}" aria-pressed="false">${icon('lamp')}<span>${t.lamp}</span><kbd>L</kbd></button>
        <button id="audio" type="button" aria-label="${t.audioLabel}" aria-pressed="false">${icon('audio')}<span>${t.audio}</span><span class="toggle-light" aria-hidden="true"></span></button>
        <button id="reset" type="button" aria-label="${t.resetLabel}">${icon('reset')}<span>${t.reset}</span><kbd>R</kbd></button>
      </div>
    </footer>
    <p id="feedback" class="sr-only" role="status" aria-live="polite"></p>
    <div id="loading" class="loading" role="status"><span class="loading-orbit" aria-hidden="true"></span><strong>${t.loading}</strong><span>${t.loadingDetail}</span><progress max="1" value="0" aria-label="${t.loading}"></progress></div>
  `;
  const canvas = document.querySelector('#mars-view');
  return {
    canvas,
    app,
    lampButton: document.querySelector('#lamp'),
    audioButton: document.querySelector('#audio'),
    resetButton: document.querySelector('#reset'),
    progress(value) { document.querySelector('progress').value = value; },
    ready() {
      document.querySelector('#loading').remove();
      app.dataset.ready = 'true';
    },
    feedback(message) { document.querySelector('#feedback').textContent = message; },
    render(state) {
      document.querySelector('#lamp').setAttribute('aria-pressed', String(state.headlamp));
      document.querySelector('#audio').setAttribute('aria-pressed', String(state.audio));
    },
    fatal() {
      document.querySelector('#loading').innerHTML = `<strong role="alert">${t.fatalTitle}</strong><span>${t.fatalMessage}</span>`;
    },
  };
}
