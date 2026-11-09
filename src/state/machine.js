import { STEPS, TOOLS, canAct, currentStep, canUseBreaker, canOperatePowerBox, canOpenHatch } from './procedure.js';
import { initialPowerState, COVER_DURATION_MS, SHOCK_DURATION_MS, clampProgress, passesThreshold, HATCH_TARGETS, isScrewdriver } from '../steps/step1-power.js';
import { initialHatchState, ALL_SCREWS, SAFETY_SCREW, removed, removedCount, TAU, TURNS_REQUIRED, HATCH_SETTLE_MS } from '../steps/step2-hatch.js';
import { initialWiringState, reduceWiring, cancelWiring } from '../steps/step3-wires.js';
import { reduceClosing, closureReady } from '../steps/step4-close.js';
import { initialTestState, TEST_DURATION_MS, propulsionOperational, wireOperational } from '../steps/step5-test.js';
import { createReport } from './report.js';
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

function initialState(audio = false, random = Math.random) {
  return {
    phase: 'loading', mode: null, repairLocked: true, hasBegun: false,
    stepIndex: 0, steps: STEPS.map(step => ({ id: step.id, completed: false,
      substeps: Object.fromEntries(step.substeps.map(id => [id, false])), errors: [], hintLevel: 0 })),
    briefingIndex: 0, resume: null, sequence: 0, message: null, messageQueue: [],
    radioCollapsed: false, unread: false, selectedTool: null, headlamp: false, audio,
    errors: [], warnings: [], hintsUsed: 0, hintLog: [], validations: [], report: null, test: initialTestState(),
    power: initialPowerState(), hatch: initialHatchState(), wires: initialWiringState(random), shock: { id: 0, active: false, at: null, until: null, point: null },
    elapsedMs: 0, clockAt: null, lastActivityAt: 0, idlePrompted: false,
  };
}

function advanceClock(state, time) {
  if (state.phase === 'running' && state.clockAt !== null) state.elapsedMs += Math.max(0, time - state.clockAt);
  state.clockAt = Math.max(time, state.clockAt ?? time);
}

function activity(state, time) {
  state.lastActivityAt = time;
  state.idlePrompted = false;
}

function cancelDrag(state) {
  if (!state.power.dragging) return;
  Object.assign(state.power, { dragging: false, leverProgress: state.power.circuitOn ? 0 : 1, lastRelease: 'cancelled',
    dragId: state.power.dragId + 1, releaseId: state.power.releaseId + 1 });
}

function cancelHatch(state) {
  const h = state.hatch;
  if (h.dragging) h.progress = h.dragOrigin;
  if (h.turning || h.dragging) h.gestureId++;
  h.turning = false; h.dragging = false; h.reverseDebt = 0;
}

function hatchFeedback(state, code, screwId = state.hatch.selectedScrew, sound = null) {
  Object.assign(state.hatch, { feedbackCode: code, feedbackScrew: screwId, feedbackId: state.hatch.feedbackId + 1 });
  if (sound) { state.hatch.soundId++; state.hatch.soundKind = sound; }
}

function hatchError(state, code, time, screwId) {
  const error = { stepId: 'open', code, nodeName: screwId, source: 'gesture', atMs: state.elapsedMs };
  state.errors.push(error); state.steps[1].errors.push(error);
  if (state.mode === 'training') showMessages(state, [message(t.errors[code].why, 'error', 'error')]);
  activity(state, time);
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
    state.report = createReport(state);
    showMessages(state, [message(t.testControls.success, 'debrief', 'success'), ...debriefMessages(state)]);
  } else {
    state.stepIndex++;
    if (state.stepIndex === 1 && state.selectedTool === 'phillips') state.steps[1].substeps.driver = true;
    showMessages(state, state.mode === 'training' ? [
      message(t.steps[step.id].success, 'success', 'success'),
      message(t.steps[currentStep(state).id].intro),
    ] : []);
  }
}

function resetProcedure(state) {
  cancelDrag(state); cancelHatch(state); cancelWiring(state);
  state.stepIndex = 0;
  for (const step of state.steps) {
    step.completed = false;
    Object.keys(step.substeps).forEach(id => { step.substeps[id] = false; });
  }
  state.steps[0].substeps.cover = state.power.cover === 'open';
  state.hatch.selectedScrew = null;
  state.hatch.closeOrder = []; state.hatch.crossWarning = false;
  state.test.status = 'idle';
  for (const wire of state.wires.items) {
    wire.inspected = false;
    // A new diagnosis must reflect connections, rather than a previous completion flag.
    if (wire.broken) wire.repaired = wireOperational(wire);
  }
}

function resolveTest(state, time) {
  if (state.test.status !== 'pending' || state.elapsedMs - state.test.startedAtMs < TEST_DURATION_MS) return;
  const passed = propulsionOperational(state);
  state.test.finishedAtMs = state.elapsedMs;
  state.test.attempts.push({ id: state.test.id, startedAtMs: state.test.startedAtMs, finishedAtMs: state.elapsedMs, passed });
  if (passed) {
    state.test.status = 'passed'; state.test.startupId++; state.test.startupAt = time;
    state.steps[4].substeps.alarm = true;
    finishStep(state, time, 'gesture');
  } else {
    const error = { stepId: 'test', code: 'persistentFault', atMs: state.elapsedMs, source: 'gesture' };
    state.errors.push(error); state.steps[4].errors.push(error);
    resetProcedure(state);
    state.test.status = 'failed';
    showMessages(state, state.mode === 'training' ? [message(t.errors.persistentFault.why, 'error', 'error')] : []);
    activity(state, time);
  }
}

// Pure transition, also usable by tests with a prepared hardware state.
export function transition(state, event, time, random = Math.random) {
  // Clone only accepted transitions; an invalid event leaves the exact state intact.
  const next = () => { const value = structuredClone(state); advanceClock(value, time); return value; };
  if (state.stepIndex === 3 && /^(SCREW_|SELECT_SCREW|HATCH_|CHECK_CLOSURE)/.test(event.type)) {
    return reduceClosing(state, event, time, { next, activity, showMessages, message, finishStep, cancelHatch });
  }
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
      cancelDrag(s);
      cancelHatch(s);
      cancelWiring(s);
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
      const s = next(); cancelHatch(s); cancelWiring(s); s.selectedTool = event.toolId;
      if (s.stepIndex === 1 && s.selectedTool === 'phillips') s.steps[1].substeps.driver = true;
      activity(s, time); return s;
    }
    case 'TOGGLE_LAMP': {
      if (!canAct(state)) return state;
      const s = next(); s.headlamp = !s.headlamp; if (!s.headlamp) cancelWiring(s); activity(s, time); return s;
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
    case 'OPEN_POWER_COVER': {
      if (!canOperatePowerBox(state) || state.power.cover !== 'closed') return state;
      const s = next();
      Object.assign(s.power, { cover: 'opening', coverId: s.power.coverId + 1, coverStartedAt: time });
      activity(s, time); return s;
    }
    case 'POWER_COVER_READY': {
      if (!canOperatePowerBox(state) || state.power.cover !== 'opening' || event.coverId !== state.power.coverId
          || time - state.power.coverStartedAt < COVER_DURATION_MS) return state;
      const s = next(); s.power.cover = 'open'; if (s.stepIndex === 0) s.steps[0].substeps.cover = true;
      return s;
    }
    case 'CLOSE_POWER_COVER': {
      if (!canOperatePowerBox(state) || state.stepIndex !== 4 || !state.power.circuitOn || state.power.cover !== 'open' || state.power.dragging || !closureReady(state.hatch)) return state;
      const s = next(); Object.assign(s.power, { cover: 'closing', coverId: s.power.coverId + 1, coverStartedAt: time });
      activity(s, time); return s;
    }
    case 'POWER_COVER_CLOSED': {
      if (!canOperatePowerBox(state) || state.stepIndex !== 4 || !state.power.circuitOn || state.power.cover !== 'closing'
          || event.coverId !== state.power.coverId || time - state.power.coverStartedAt < COVER_DURATION_MS) return state;
      const s = next(); s.power.cover = 'closed'; s.steps[4].substeps.cover = true;
      Object.assign(s.test, { status: 'pending', id: s.test.id + 1, startedAtMs: s.elapsedMs, finishedAtMs: null });
      activity(s, time); return s;
    }
    case 'PROPULSION_TEST_FINISHED': {
      if (state.phase !== 'running' || state.test.status !== 'pending' || event.testId !== state.test.id) return state;
      const s = next();
      if (s.elapsedMs - s.test.startedAtMs < TEST_DURATION_MS) return state;
      resolveTest(s, time); return s;
    }
    case 'POWER_DRAG_START': {
      if (!canUseBreaker(state) || state.power.cover !== 'open' || state.power.dragging || (state.stepIndex === 4 && !closureReady(state.hatch))) return state;
      const s = next(); s.power.dragging = true; s.power.dragId++; s.power.lastRelease = null;
      activity(s, time); return s;
    }
    case 'POWER_DRAG_MOVE': {
      if (!canUseBreaker(state) || !state.power.dragging || event.dragId !== state.power.dragId || !Number.isFinite(event.progress)) return state;
      const s = next(); s.power.leverProgress = clampProgress(event.progress); activity(s, time); return s;
    }
    case 'POWER_DRAG_END': {
      if (!canUseBreaker(state) || !state.power.dragging || event.dragId !== state.power.dragId) return state;
      const s = next(); s.power.dragging = false; s.power.releaseId++;
      const restoring = s.stepIndex === 4;
      if (passesThreshold(restoring ? 1 - s.power.leverProgress : s.power.leverProgress)) {
        Object.assign(s.power, { circuitOn: restoring, leverProgress: restoring ? 0 : 1, lastRelease: restoring ? 'restored' : 'success' });
        s.steps[s.stepIndex].substeps.breaker = true;
        if (!restoring) finishStep(s, time, 'gesture');
      } else {
        Object.assign(s.power, { leverProgress: restoring ? 1 : 0, lastRelease: 'short' });
        activity(s, time);
      }
      return s;
    }
    case 'POWER_DRAG_CANCEL': {
      if (!state.power.dragging || event.dragId !== state.power.dragId) return state;
      const s = next(); cancelDrag(s); return s;
    }
    case 'TOUCH_HATCH': {
      if (!canAct(state) || !state.power.circuitOn || !isScrewdriver(state.selectedTool) || !HATCH_TARGETS.includes(event.nodeName)) return state;
      const s = next(); resetProcedure(s);
      s.power.leverProgress = 0;
      s.shock = { id: s.shock.id + 1, active: true, at: time, until: time + SHOCK_DURATION_MS,
        point: Array.isArray(event.point) && event.point.length === 3 && event.point.every(Number.isFinite) ? [...event.point] : null };
      const error = { stepId: 'power', code: 'liveCircuit', atMs: s.elapsedMs, source: 'gesture' };
      s.errors.push(error); s.steps[0].errors.push(error);
      if (s.mode === 'training') {
        s.radioCollapsed = false;
        showMessages(s, [message(t.errors.liveCircuit.why, 'error', 'error')]);
      }
      activity(s, time); return s;
    }
    case 'SHOCK_FINISHED': {
      if (!state.shock.active || event.shockId !== state.shock.id || time < state.shock.until) return state;
      const s = next(); s.shock.active = false; return s;
    }
    case 'SELECT_SCREW': {
      if (!canOpenHatch(state) || !ALL_SCREWS.includes(event.screwId) || removed(state.hatch.screws[event.screwId])) return state;
      const s = next(); cancelHatch(s); s.hatch.selectedScrew = event.screwId; activity(s, time); return s;
    }
    case 'SCREW_TURN_START': {
      const id = event.screwId ?? state.hatch.selectedScrew;
      if (!canOpenHatch(state) || state.hatch.turning || state.hatch.dragging || !ALL_SCREWS.includes(id) || removed(state.hatch.screws[id])) return state;
      const s = next(); s.hatch.selectedScrew = id; activity(s, time);
      if (!isScrewdriver(s.selectedTool)) { hatchFeedback(s, 'toolRequired'); return s; }
      if (id === SAFETY_SCREW) {
        hatchError(s, 'safetyScrew', time, id); hatchFeedback(s, 'safety', id, 'blocked'); return s;
      }
      if (s.selectedTool !== 'phillips') {
        s.hatch.screws[id].scratched = true;
        hatchError(s, 'wrongDriver', time, id); hatchFeedback(s, 'slip', id, 'slip'); return s;
      }
      Object.assign(s.hatch, { turning: true, gestureId: s.hatch.gestureId + 1, reverseDebt: 0, directionWarned: false });
      s.steps[1].substeps.driver = true; hatchFeedback(s, 'turning'); return s;
    }
    case 'SCREW_TURN_MOVE': {
      const h = state.hatch;
      if (!canOpenHatch(state) || !h.turning || event.gestureId !== h.gestureId || !Number.isFinite(event.radians)
          || event.radians === 0 || Math.abs(event.radians) > Math.PI / 2 + 1e-8) return state;
      const s = next(); const target = s.hatch; const screw = target.screws[target.selectedScrew];
      activity(s, time);
      if (event.radians < 0) {
        target.reverseDebt += -event.radians;
        if (!target.directionWarned) {
          target.directionWarned = true; hatchFeedback(s, 'clockwise', target.selectedScrew, 'blocked');
          if (s.mode === 'training') showMessages(s, [message(t.hatchControls.clockwise, 'step')]);
        }
        return s;
      }
      const usable = Math.max(0, event.radians - target.reverseDebt);
      target.reverseDebt = Math.max(0, target.reverseDebt - event.radians);
      const before = screw.turns;
      screw.turns = Math.min(TURNS_REQUIRED, before + usable / TAU);
      if (screw.turns > TURNS_REQUIRED - 1e-8) screw.turns = TURNS_REQUIRED;
      if (Math.floor(screw.turns * 4) > Math.floor(before * 4)) { target.soundId++; target.soundKind = 'screw'; }
      if (removed(screw)) {
        screw.fitted = false;
        target.turning = false;
        hatchFeedback(s, 'removed');
        s.steps[1].substeps.screws = removedCount(target) === 4;
      } else if (Math.floor(screw.turns) > Math.floor(before)) hatchFeedback(s, 'quarter');
      return s;
    }
    case 'SCREW_TURN_END': {
      if (!state.hatch.turning || event.gestureId !== state.hatch.gestureId) return state;
      const s = next(); cancelHatch(s); activity(s, time); return s;
    }
    case 'HATCH_DRAG_START': {
      if (!canOpenHatch(state) || state.hatch.turning || state.hatch.dragging) return state;
      const s = next(); activity(s, time);
      if (removedCount(s.hatch) !== 4) { hatchFeedback(s, 'fastened', null, 'blocked'); return s; }
      if (event.edge === false) { hatchFeedback(s, 'edge', null); return s; }
      Object.assign(s.hatch, { dragging: true, gestureId: s.hatch.gestureId + 1, dragOrigin: s.hatch.progress });
      hatchFeedback(s, 'pull', null); return s;
    }
    case 'HATCH_DRAG_MOVE': {
      if (!canOpenHatch(state) || !state.hatch.dragging || event.gestureId !== state.hatch.gestureId || !Number.isFinite(event.progress)) return state;
      const s = next(); s.hatch.progress = clampProgress(event.progress); activity(s, time); return s;
    }
    case 'HATCH_DRAG_END': {
      if (!canOpenHatch(state) || !state.hatch.dragging || event.gestureId !== state.hatch.gestureId) return state;
      const s = next(); s.hatch.dragging = false; activity(s, time);
      if (s.hatch.progress >= 1) {
        Object.assign(s.hatch, { settling: true, settleId: s.hatch.settleId + 1, settleStartedAt: time });
      }
      return s;
    }
    case 'HATCH_DRAG_CANCEL': {
      if (!state.hatch.dragging || event.gestureId !== state.hatch.gestureId) return state;
      const s = next(); cancelHatch(s); return s;
    }
    case 'HATCH_OPENED': {
      if (!canAct(state) || state.stepIndex !== 1 || state.power.circuitOn || !state.hatch.settling
          || event.settleId !== state.hatch.settleId || time - state.hatch.settleStartedAt < HATCH_SETTLE_MS
          || removedCount(state.hatch) !== 4) return state;
      const s = next(); s.hatch.settling = false; s.hatch.opened = true;
      s.steps[1].substeps.hatch = true; hatchFeedback(s, 'opened', null, 'hatch');
      finishStep(s, time, 'gesture'); return s;
    }
    case 'COMPLETE_SUBSTEP':
    case 'VALIDATE_STEP':
    case 'DEBUG_VALIDATE_STEP': return state;
    case 'ACTIVITY': {
      if (!canAct(state)) return state;
      const s = next(); activity(s, time); return s;
    }
    case 'TICK': {
      if (state.phase !== 'running') return state;
      const s = next();
      if (s.shock.active && time >= s.shock.until) s.shock.active = false;
      resolveTest(s, time);
      if (s.phase !== 'running') return s;
      if (canAct(s) && s.mode === 'training' && !s.idlePrompted && time - s.lastActivityAt >= 30000) {
        showMessages(s, [message(t.radio.idle, 'idle')]); s.idlePrompted = true;
      }
      return s;
    }
    case 'RESTART': {
      if (!['debrief', 'complete'].includes(state.phase)) return state;
      const s = initialState(state.audio, random); s.phase = 'welcome'; return s;
    }
    default: return reduceWiring(state, event, time, { next, activity, showMessages, message, finishStep });
  }
}

export function createMachine({ now = () => Date.now(), random = Math.random } = {}) {
  let state = freeze(initialState(false, random));
  const listeners = new Set();
  return {
    get state() { return state; },
    dispatch(event) {
      const next = transition(state, event, now(), random);
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
