export function createTypewriter(element, onComplete) {
  let timer;
  let id;
  let text = '';
  let count = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  return {
    render(message) {
      if (!message) { clearTimeout(timer); id = null; element.textContent = ''; return; }
      if (message.id === id) {
        if (message.complete) { clearTimeout(timer); count = text.length; element.textContent = text; }
        return;
      }
      clearTimeout(timer); id = message.id; text = message.text; count = 0;
      const currentId = id;
      element.textContent = '';
      const tick = () => {
        if (id !== currentId) return;
        count = message.complete || reducedMotion.matches ? text.length : Math.min(text.length, count + 1);
        element.textContent = text.slice(0, count);
        if (count === text.length) {
          if (!message.complete) queueMicrotask(() => { if (id === currentId) onComplete(currentId); });
        } else timer = setTimeout(tick, 22);
      };
      tick();
    },
  };
}
