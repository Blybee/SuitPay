import { afterEach, describe, expect, it } from 'vitest'
import {
  precargarRecursoPdf,
  soltarPrecargaPdf,
  resolverYPrecargarPdf,
} from '../../../src/features/emision/precarga.ts'

describe('precarga de PDF', () => {
  afterEach(() => {
    soltarPrecargaPdf()
  })

  it('inserta un link preload de baja prioridad', () => {
    precargarRecursoPdf('https://ejemplo.test/doc.pdf')
    const link = document.head.querySelector('link[rel="preload"]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('https://ejemplo.test/doc.pdf')
    expect(link?.getAttribute('as')).toBe('fetch')
    expect(link?.getAttribute('fetchpriority')).toBe('low')
  })

  it('no duplica el mismo href', () => {
    precargarRecursoPdf('https://ejemplo.test/doc.pdf')
    precargarRecursoPdf('https://ejemplo.test/doc.pdf')
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(1)
  })

  it('con URL ya conocida no consulta al servidor', async () => {
    const url = await resolverYPrecargarPdf(
      'cmp-1',
      'https://ejemplo.test/ya.pdf',
    )
    expect(url).toBe('https://ejemplo.test/ya.pdf')
    expect(
      document.head.querySelector('link[href="https://ejemplo.test/ya.pdf"]'),
    ).not.toBeNull()
  })
})
