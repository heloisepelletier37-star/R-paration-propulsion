import { textes as t } from '../ui/textes.js';

export const SCORE_RULES = Object.freeze({ maximum: 20, error: 1, liveCircuit: 3, hint: 0.5, warning: 0 });
export function scoreMission(state) {
  const errors = state.errors.map(e => ({ code: e.code, stepId: e.stepId, points: SCORE_RULES[e.code] ?? SCORE_RULES.error }));
  const errorPenalty = errors.reduce((sum, e) => sum + e.points, 0);
  const hintPenalty = state.hintsUsed * SCORE_RULES.hint;
  return { value: Math.max(0, SCORE_RULES.maximum - errorPenalty - hintPenalty), maximum: SCORE_RULES.maximum,
    errorPenalty, hintPenalty, warningPenalty: 0, rules: { ...SCORE_RULES }, deductions: errors };
}
export function createReport(state) {
  const hint = h => ({ ...h, text: t.steps[h.stepId].hints[h.level - 1] });
  const annotate = e => ({ ...e, label: t.errors[e.code].label, rule: t.errors[e.code].rule });
  return {
    schemaVersion: 1, mission: t.title, mode: state.mode, result: 'success', elapsedMs: state.elapsedMs,
    score: scoreMission(state), totalErrors: state.errors.length, hintsUsed: state.hintsUsed,
    steps: state.steps.map(step => ({ id: step.id, title: t.steps[step.id].title, completed: step.completed,
      substeps: { ...step.substeps }, errors: step.errors.map(annotate),
      hints: state.hintLog.filter(h => h.stepId === step.id).map(hint) })),
    errors: state.errors.map(annotate), hints: state.hintLog.map(hint),
    warnings: state.warnings.map(w => ({ ...w, label: t.closeControls.crossWarning })),
    validations: state.validations.map(v => ({ ...v })),
    crossOrder: [...state.hatch.closeOrder], testAttempts: state.test.attempts.map(a => ({ ...a })),
    wires: state.wires.items.map(w => ({ id: w.id, color: w.color, originallyBroken: w.broken, repaired: w.repaired })),
  };
}
