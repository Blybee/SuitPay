import { describe, expect, it } from 'vitest'
import {
  scrollerDePagina,
  subirScrollerDePagina,
} from '../../../src/features/catalogo/scroll-pagina.ts'

describe('scrollerDePagina', () => {
  it('elige el ancestro con overflow auto, no un hijo', () => {
    const pagina = document.createElement('main')
    pagina.style.overflowY = 'auto'
    const tabla = document.createElement('div')
    tabla.style.overflowY = 'visible'
    const ancla = document.createElement('aside')
    tabla.append(ancla)
    pagina.append(tabla)
    document.body.append(pagina)

    expect(scrollerDePagina(ancla)).toBe(pagina)

    pagina.scrollTo = ((opciones: ScrollToOptions) => {
      pagina.dataset['top'] = String(opciones.top ?? '')
    }) as typeof pagina.scrollTo
    subirScrollerDePagina(ancla, 'auto')
    expect(pagina.dataset['top']).toBe('0')
    pagina.remove()
  })
})
