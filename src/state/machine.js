import { STEPS, TOOLS, canAct, currentStep } from './procedure.js';
import { textes as t } from '../ui/textes.js';

export const briefingCount = state => state.mode === 'evaluation' ? 1 : t.briefing.length;
export const stepStatus = (state, index) => state.steps[index].completed ? 'complete'
  : state.hasBegun && state.stepIndex === index ? 'current' : 'todo';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function initialState(audio = false) {
  return {
    phase: 'loading', mode: null, repairLocked: true, hasBegun: false,
    stepIndex: 0, steps: STEPS.map(step => ({ id: step.id, completed: false,
      substeps: Object.fromEntries(step.substeps.map(id => [id, false])), errors: [], hintLevel: 0 })),
    briefingIndex: 0, resume: null, sequence: 0, message: null, messageQueue: [],
    radioCollapsed: false, unread: false, selectedTool: null, headlamp: false, audio,
    errors: [], hintsUsed: 0, hintLog: [], validations: [],
    elapsedMs: 0, clockAt: null, lastActivityAt: 0, idlePrompted: false,
  };
}

function advanceClock(state, time) {
  if (canAct(state) && state.clockAt !== null) state.elapsedMs += Math.max(0, time - state.clockAt);
  state.clockAt = Math.max(time, state.clockAt ?? time);
}

function activity(state, time) {
  state.lastActivityAt = time;
  state.idlePrompted = false;
}

function message(text, topic = 'step', kind = 'instruction', demo = null) {
  return { text, topic, kind, demo };
}

function showMessages(state, messages) {
  const [first, ...rest] = messages;
  state.message = first ? { ...first, id: ++state.sequence, complete: false } : null;
  state.messageQueue = rest;
  state.unread = Boolean(first && state.radioCollapsed);
}

function showBriefing(state) {
  showMessages(state, [message(t.briefing[state.briefingIndex], 'briefing', 'instruction',
    state.mode === 'training' && state.briefingIndex === 5 ? 'tutorial' : null)]);
}

function finishBriefing(state, time) {
  if (state.resume) {
    const resume = state.resume;
    state.phase = resume.phase;
    state.resume = null;
    showMessages(state, resume.message ? [resume.message, ...resume.queue] : resume.queue);
  } else {
    state.phase = 'running';
    state.hasBegun = true;
    showMessages(state, state.mode === 'training' ? [message(t.steps.power.intro)] : []);
  }
  state.clockAt = time;
  activity(state, time);
}

function debriefMessages(state) {
  const positives = state.steps.filter(step => step.errors.length === 0).map(step => t.steps[step.id].title.toLowerCase());
  const counts = new Map();
  state.errors.forEach(error => counts.set(error.code, (counts.get(error.code) ?? 0) + 1));
  return [
    message(t.debrief.opening(state.errors.length, state.hintsUsed), 'debrief', 'success'),
    message(positives.length ? t.debrief.positives(positives) : t.debrief.allToReview, 'debrief', 'success'),
    ...[...counts].map(([code, count]) => message(t.debrief.error(t.errors[code].label, count, t.errors[code].rule), 'debrief', 'error')),
    message(t.debrief.conclusion, 'debrief', 'success'),
  ];
}

function finishStep(state, time, source) {
  const index = state.stepIndex;
  const step = state.steps[index];
  step.completed = true;
  state.validations.push({ stepId: step.id, source, atMs: state.elapsedMs });
  activity(state, time);
  if (index === STEPS.length - 1) {
    state.phase = 'debrief';
    state.selectedTool = null;
    state.headlamp = false;
    state.radioCollapsed = false;
    showMessages(state, debriefMessages(state));
  } else {
    state.stepIndex++;
    showMessages(state, state.mode === 'training' ? [
      message(t.steps[step.id].success, 'success', 'success'),
      message(t.steps[currentStep(state).id].intro),
    ] : []);
  }
}

function reduce(state, event, time) {
  // Clone only accepted transitions; an invalid event leaves the exact state intact.
  const next = () => { const value = structuredClone(state); advanceClock(value, time); return value; };
  switch (event.type) {
    case 'SCENE_READY': {
      if (state.phase !== 'loading') return state;
      const s = next(); s.phase = 'welcome'; return s;
    }
    case 'START': {
      if (state.phase !== 'welcome' || !['training', 'evaluation'].includes(event.mode)) return state;
      const s = next(); s.mode = event.mode; s.audio = Boolean(event.audio);
      s.phase = 'briefing'; s.radioCollapsed = false; showBriefing(s); return s;
    }
    case 'TYPING_FINISHED': {
      if (!state.message || state.message.id !== event.messageId || state.message.complete) return state;
      const s = next(); s.message.complete = true; return s;
    }
    case 'MESSAGE_NEXT': {
      if (!state.message || state.message.id !== event.messageId || state.radioCollapsed
          || !['briefing', 'running', 'debrief'].includes(state.phase)) return state;
      const s = next();
      if (canAct(s)) activity(s, time);
      if (!s.message.complete) { s.message.complete = true; return s; }
      if (s.phase === 'briefing') {
        if (s.briefingIndex < briefingCount(s) - 1) { s.briefingIndex++; showBriefing(s); }
        else finishBriefing(s, time);
      } else if (s.messageQueue.length) showMessages(s, s.messageQueue);
      else if (s.phase === 'debrief') s.phase = 'complete';
      else showMessages(s, []);
      return s;
    }
    case 'REPLAY_BRIEFING': {
      if (!['running', 'debrief', 'complete'].includes(state.phase)) return state;
      const s = next();
      s.resume = { phase: s.phase, message: s.message, queue: s.messageQueue };
      s.phase = 'briefing'; s.briefingIndex = 0; s.radioCollapsed = false; showBriefing(s); return s;
    }
    case 'TOGGLE_RADIO': {
      if (['loading', 'welcome'].includes(state.phase)) return state;
      const s = next(); s.radioCollapsed = !s.radioCollapsed;
      if (!s.radioCollapsed) s.unread = false;
      if (canAct(s)) activity(s, time);
      return s;
    }
    case 'SELECT_TOOL': {
      if (!canAct(state) || (event.toolId !== null && !TOOLS.some(tool => tool.id === event.toolId))) return state;
      const s = next(); s.selectedTool = s.selectedTool === event.toolId ? null : event.toolId;
      activity(s, time); return s;
    }
    case 'TOGGLE_LAMP': {
      if (!canAct(state)) return state;
      const s = next(); s.headlamp = !s.headlamp; activity(s, time); return s;
    }
    case 'SET_AUDIO': {
      const enabled = Boolean(event.enabled);
      if (enabled === state.audio) return state;
      const s = next(); s.audio = enabled; return s;
    }
    case 'REQUEST_HINT': {
      if (!canAct(state) || state.mode !== 'training') return state;
      const s = next(); const step = s.steps[s.stepIndex];
      step.hintLevel = Math.min(3, step.hintLevel + 1); s.hintsUsed++;
      s.hintLog.push({ stepId: step.id, level: step.hintLevel, atMs: s.elapsedMs });
      showMessages(s, [message(t.steps[step.id].hints[step.hintLevel - 1], 'hint', 'instruction', step.hintLevel === 3 ? currentStep(s).demo : null)]);
      activity(s, time); return s;
    }
    case 'RECORD_ERROR': {
      if (!canAct(state) || event.stepId !== currentStep(state).id || !Object.hasOwn(t.errors, event.code)) return state;
      const s = next();
      const error = { stepId: event.stepId, code: event.code, atMs: s.elapsedMs, source: event.source ?? 'gesture' };
      s.errors.push(error); s.steps[s.stepIndex].errors.push(error);
      if (s.mode === 'training') showMessages(s, [message(t.errors[event.code].why, 'error', 'error')]);
      activity(s, time); return s;
    }
    case 'COMPLETE_SUBSTEP': {
      if (!canAct(state) || event.stepId !== currentStep(state).id
          || !currentStep(state).substeps.includes(event.substepId)
          || state.steps[state.stepIndex].substeps[event.substepId]) return state;
      const s = next(); s.steps[s.stepIndex].substeps[event.substepId] = true; activity(s, time); return s;
    }
    case 'VALIDATE_STEP':
    case 'DEBUG_VALIDATE_STEP': {
      if (!canAct(state) || event.stepId !== currentStep(state).id) return state;
      if (event.type === 'VALIDATE_STEP' && !Object.values(state.steps[state.stepIndex].substeps).every(Boolean)) return state;
      const s = next();
      if (event.type === 'DEBUG_VALIDATE_STEP') {
        currentStep(s).substeps.forEach(id => { s.steps[s.stepIndex].substeps[id] = true; });
      }
      finishStep(s, time, event.type === 'DEBUG_VALIDATE_STEP' ? 'debug' : 'gesture'); return s;
    }
    case 'ACTIVITY': {
      if (!canAct(state)) return state;
      const s = next(); activity(s, time); return s;
    }
    case 'TICK': {
      if (!canAct(state)) return state;
      const s = next();
      if (s.mode === 'training' && !s.idlePrompted && time - s.lastActivityAt >= 30000) {
        showMessages(s, [message(t.radio.idle, 'idle')]); s.idlePrompted = true;
      }
      return s;
    }
    case 'RESTART': {
      if (!['debrief', 'complete'].includes(state.phase)) return state;
      const s = initialState(state.audio); s.phase = 'welcome'; return s;
    }
    default: return state;
  }
}

export function createMachine({ now = () => Date.now() } = {}) {
  let state = freeze(initialState());
  const listeners = new Set();
  return {
    get state() { return state; },
    dispatch(event) {
      const next = reduce(state, event, now());
      if (next === state) return false;
      next.repairLocked = !canAct(next);
      state = freeze(next);
      listeners.forEach(listener => listener(state));
      return true;
    },
    subscribe(listener) {
      listeners.add(listener); listener(state);
      return () => listeners.delete(listener);
    },
  };
}
