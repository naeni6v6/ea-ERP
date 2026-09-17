/**
 * 큰 모니터용 UI 확대 배율 (globals.css 의 html { zoom: var(--ui-zoom) }).
 *
 * zoom 이 걸리면 getBoundingClientRect·innerHeight 는 확대된 화면 px 로 나오는데,
 * style 에 넣는 px 는 다시 확대돼 그려진다. 측정값을 style 좌표로 쓸 때는 이 값으로 나눈다.
 */
export function uiZoom(): number {
  if (typeof window === 'undefined') return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return z > 0 ? z : 1;
}
