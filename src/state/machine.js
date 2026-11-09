// Repair events will be introduced with the briefing and step interactions.
// Observation never advances the procedure or unlocks a repair gesture.
export function createMachine() {
  let state = Object.freeze({ phase: 'loading', repairLocked: true, headlamp: false, audio: false });
  const listeners = new Set();
  return {
    get state() { return state; },
    dispatch(event) {
      const next = { ...state };
      if (event.type === 'SCENE_READY' && state.phase === 'loading') next.phase = 'observation';
      if (event.type === 'TOGGLE_LAMP' && state.phase === 'observation') next.headlamp = !state.headlamp;
      if (event.type === 'SET_AUDIO') next.audio = Boolean(event.enabled);
      state = Object.freeze(next);
      listeners.forEach(listener => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}
