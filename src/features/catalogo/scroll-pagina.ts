/**
 * Scroller de página (main overflow-auto), no el de la grilla.
 */

export function scrollerDePagina(desde: Element | null): HTMLElement | null {
  let n: HTMLElement | null =
    desde instanceof HTMLElement ? desde : (desde?.parentElement ?? null)
  while (n !== null) {
    const { overflowY } = getComputedStyle(n)
    if (overflowY === 'auto' || overflowY === 'scroll') return n
    n = n.parentElement
  }
  return null
}

export function subirScrollerDePagina(
  ancla: Element | null,
  behavior: ScrollBehavior,
): void {
  const scroller = scrollerDePagina(ancla)
  if (scroller === null) return
  scroller.scrollTo({ top: 0, behavior })
}
