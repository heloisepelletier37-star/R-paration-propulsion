// Stable identifiers shared by the five physical procedures.
export const STEPS = [
  { id: 'power', substeps: ['cover', 'breaker'], error: 'liveCircuit', demo: 'power' },
  { id: 'open', substeps: ['driver', 'screws', 'hatch'], error: 'wrongDriver', demo: 'screw' },
  { id: 'wires', substeps: ['inspect', 'mark', 'remove', 'prepare', 'connect'], error: 'wrongColor', demo: 'wire' },
  { id: 'close', substeps: ['hatch', 'cross', 'tighten'], error: 'looseScrew', demo: 'hatch' },
  { id: 'test', substeps: ['breaker', 'cover', 'alarm'], error: 'persistentFault', demo: 'test' },
];
export const TOOLS = [
  { id: 'phillips', model: 'Screwdriver_Phillips', key: 'Digit1', icon: 'phillips' },
  { id: 'flat', model: 'Screwdriver_Flat', key: 'Digit2', icon: 'flat' },
  { id: 'stripper', model: 'Wire_Stripper', key: 'Digit3', icon: 'stripper' },
  { id: 'red', color: 0xbf3c2d, key: 'Digit4', icon: 'wire' },
  { id: 'black', color: 0x20272b, key: 'Digit5', icon: 'wire' },
  { id: 'yellow', color: 0xe3b348, key: 'Digit6', icon: 'wire' },
  { id: 'lamp', model: 'Headlamp', key: 'Digit7', icon: 'lamp' },
];
export const canAct = state => state.phase === 'running' && !state.shock?.active && state.test?.status !== 'pending';
export const currentStep = state => STEPS[state.stepIndex];
export const canOperatePowerBox = state => canAct(state) && (state.stepIndex === 0 || state.stepIndex === 4);
export const canUseBreaker = state => canOperatePowerBox(state) && (state.stepIndex === 0 ? state.power.circuitOn : !state.power.circuitOn);
export const canCloseHatch = state => canAct(state) && state.stepIndex === 3 && !state.power.circuitOn && !state.hatch.settling;
export const canWorkHatch = state => canOpenHatch(state) || canCloseHatch(state);
export const canOpenHatch = state => canAct(state) && state.stepIndex === 1 && !state.power.circuitOn && !state.hatch.opened && !state.hatch.settling;
export const canRepairWires = state => canAct(state) && state.stepIndex === 2 && !state.power.circuitOn && state.hatch.opened;
export const sceneState = state => ({
  circuitOn: state.power.circuitOn,
  hatchOpen: state.hatch.opened,
  alarmActive: state.test.status !== 'passed',
});
