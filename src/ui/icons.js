const paths = {
  arrow: '<path d="M6 20 20 6M7 6h13v13"/>',
  lamp: '<path d="M8 8h7l4 3v4l-4 3H8zM4 10v6m17-8 3-2m-3 12 3 2m-3-7h4"/>',
  audio: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
  phillips: '<path d="m6 21 7-8m-1-1 6-8 4 4-8 6M4 23l3-1m10-17 4 4"/>',
  flat: '<path d="m6 21 7-8m-1-1 6-8 4 4-8 6M4 23l3-1m10-17 4 4M4 23l-1 2"/>',
  stripper: '<path d="m6 23 5-11m9 11-5-11M8 4l3 8h4l3-8m-7 8-2-8m6 8 2-8"/><circle cx="13" cy="12" r="2"/>',
  wire: '<path d="M5 5c17-2 17 5 6 8S1 23 21 21M3 5h2m16 16h3"/>',
  help: '<circle cx="13" cy="13" r="9"/><path d="M10 10a3 3 0 0 1 6 0c0 3-3 2-3 5m0 3v.1"/>',
  book: '<path d="M3 5h7l3 2 3-2h7v16h-7l-3 2-3-2H3zM13 7v16"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}
