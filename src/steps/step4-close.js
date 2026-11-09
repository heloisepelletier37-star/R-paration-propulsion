import { canCloseHatch } from '../state/procedure.js';
import { ALL_SCREWS, SCREWS, SAFETY_SCREW, TAU, HATCH_SETTLE_MS } from './step2-hatch.js';
import { clampProgress, isScrewdriver } from './step1-power.js';
import { textes as t } from '../ui/textes.js';

export const CROSS_ORDER = ['Screw_TL', 'Screw_BR', 'Screw_TR', 'Screw_BL'];
export const tightened = screw => screw.fitted !== false && screw.turns === 0;
export const tightenedCount = hatch => SCREWS.filter(id => tightened(hatch.screws[id])).length;
export const closureReady = hatch => !hatch.opened && !hatch.settling && hatch.progress === 0 && tightenedCount(hatch) === 4;
export const storedScrews = hatch => SCREWS.filter(id => hatch.screws[id].fitted === false).length;

export function reduceClosing(state, event, time, api) {
  const { next, activity, showMessages, message, finishStep, cancelHatch } = api;
  const feedback = (s, code, sound = null) => {
    Object.assign(s.hatch, { feedbackCode: code, feedbackScrew: s.hatch.selectedScrew, feedbackId: s.hatch.feedbackId + 1 });
    if (sound) { s.hatch.soundId++; s.hatch.soundKind = sound; }
    activity(s, time); return s;
  };
  const error = (s, code, screwId = s.hatch.selectedScrew) => {
    const entry = { stepId: 'close', code, nodeName: screwId, source: 'gesture', atMs: s.elapsedMs };
    s.errors.push(entry); s.steps[3].errors.push(entry);
    if (s.mode === 'training') showMessages(s, [message(t.errors[code].why, 'error', 'error')]);
    return s;
  };
  const h = state.hatch;
  if (event.type === 'HATCH_DRAG_CANCEL' || event.type === 'SCREW_TURN_END') {
    if (event.gestureId !== h.gestureId || !(h.dragging || h.turning)) return state;
    const s = next(); cancelHatch(s); activity(s, time); return s;
  }
  if (event.type === 'HATCH_CLOSED') {
    if (state.phase !== 'running' || state.shock.active || state.power.circuitOn || !h.settling
        || event.settleId !== h.settleId || time - h.settleStartedAt < HATCH_SETTLE_MS || h.progress !== 0) return state;
    const s = next(); s.hatch.settling = false; s.hatch.opened = false; s.steps[3].substeps.hatch = true;
    return feedback(s, 'closed', 'hatch');
  }
  if (!canCloseHatch(state)) return state;
  switch (event.type) {
    case 'HATCH_DRAG_START': {
      if (h.dragging || h.turning || !h.opened) return state;
      const s = next();
      Object.assign(s.hatch, { dragging: true, gestureId: h.gestureId + 1, dragOrigin: h.progress });
      return feedback(s, 'push');
    }
    case 'HATCH_DRAG_MOVE': {
      if (!h.dragging || event.gestureId !== h.gestureId || !Number.isFinite(event.progress)) return state;
      const s = next(); s.hatch.progress = clampProgress(event.progress); activity(s, time); return s;
    }
    case 'HATCH_DRAG_END': {
      if (!h.dragging || event.gestureId !== h.gestureId) return state;
      const s = next(); s.hatch.dragging = false; activity(s, time);
      if (s.hatch.progress === 0) Object.assign(s.hatch, { settling: true, settleId: h.settleId + 1, settleStartedAt: time });
      return s;
    }
    case 'SELECT_SCREW': {
      if (h.opened || !ALL_SCREWS.includes(event.screwId) || (event.screwId !== SAFETY_SCREW && tightened(h.screws[event.screwId]))) return state;
      const s = next(); cancelHatch(s); s.hatch.selectedScrew = event.screwId; activity(s, time); return s;
    }
    case 'SCREW_TURN_START': {
      const id = event.screwId ?? h.selectedScrew;
      if (h.opened || h.dragging || h.turning || !ALL_SCREWS.includes(id) || (id !== SAFETY_SCREW && tightened(h.screws[id]))) return state;
      const s = next(); s.hatch.selectedScrew = id;
      if (!isScrewdriver(s.selectedTool)) return feedback(s, 'toolRequired');
      if (id === SAFETY_SCREW) return feedback(error(s, 'safetyScrew', id), 'safety', 'blocked');
      if (s.selectedTool !== 'phillips') {
        s.hatch.screws[id].scratched = true;
        return feedback(error(s, 'wrongDriver', id), 'slip', 'slip');
      }
      s.hatch.screws[id].fitted = true;
      Object.assign(s.hatch, { turning: true, gestureId: h.gestureId + 1, reverseDebt: 0, directionWarned: false });
      return feedback(s, 'tightening');
    }
    case 'SCREW_TURN_MOVE': {
      if (!h.turning || event.gestureId !== h.gestureId || !Number.isFinite(event.radians)
          || !event.radians || Math.abs(event.radians) > Math.PI / 2 + 1e-8) return state;
      const s = next(); const target = s.hatch; const screw = target.screws[target.selectedScrew];
      const delta = -event.radians;
      activity(s, time);
      if (delta < 0) {
        target.reverseDebt += -delta;
        if (!target.directionWarned) {
          target.directionWarned = true; feedback(s, 'counterclockwise', 'blocked');
          if (s.mode === 'training') showMessages(s, [message(t.closeControls.counterclockwise)]);
        }
        return s;
      }
      const usable = Math.max(0, delta - target.reverseDebt);
      target.reverseDebt = Math.max(0, target.reverseDebt - delta);
      const before = screw.turns;
      screw.turns = Math.max(0, before - usable / TAU);
      if (screw.turns < 1e-8) screw.turns = 0;
      if (Math.floor(before * 4) !== Math.floor(screw.turns * 4)) { target.soundId++; target.soundKind = 'screw'; }
      if (tightened(screw)) {
        target.turning = false;
        const expected = CROSS_ORDER[target.closeOrder.length];
        target.closeOrder.push(target.selectedScrew);
        feedback(s, 'tight');
        if (target.selectedScrew !== expected && !target.crossWarning) {
          target.crossWarning = true;
          s.warnings.push({ stepId: 'close', code: 'crossOrder', atMs: s.elapsedMs, expected, actual: target.selectedScrew });
          feedback(s, 'crossOrder', 'blocked');
          if (s.mode === 'training') showMessages(s, [message(t.closeControls.crossWarning, 'step')]);
        }
        if (tightenedCount(target) === 4) { s.steps[3].substeps.cross = true; feedback(s, 'allTight'); }
      }
      return s;
    }
    case 'CHECK_CLOSURE': {
      if (h.turning || h.dragging) return state;
      const s = next();
      if (h.opened || h.progress !== 0) return feedback(s, 'closeFirst', 'blocked');
      if (!closureReady(h)) return feedback(error(s, 'looseScrew', SCREWS.find(id => !tightened(h.screws[id]))), 'looseScrew', 'blocked');
      s.steps[3].substeps.tighten = true;
      finishStep(s, time, 'gesture'); return s;
    }
    default: return state;
  }
}
