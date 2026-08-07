import { describe, expect, it } from 'vitest'
import {
  MAX_CANDIDATOS_ASISTENCIA,
  esquemaInterpretarCaptura,
} from '../../../src/features/captura/captura.funciones.ts'

function candidatos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    codigo: `P${i}`,
    descripcion: `PRODUCTO ${i} FG 1/2`,
    unidad: 'NIU',
  }))
}

describe('esquema interpretarCaptura (audio e imagen)', () => {
  it('acepta catálogo grande en imagen (mismo techo que audio)', () => {
    const parsed = esquemaInterpretarCaptura.safeParse({
      tipo: 'imagen',
      medioUrl: 'capturas/u/c.jpg',
      candidatos: candidatos(800),
    })
    expect(parsed.success).toBe(true)
  })

  it('acepta catálogo grande en audio', () => {
    const parsed = esquemaInterpretarCaptura.safeParse({
      tipo: 'audio',
      medioUrl: 'capturas/u/c.webm',
      candidatos: candidatos(800),
    })
    expect(parsed.success).toBe(true)
  })

  it('rechaza por encima del techo compartido', () => {
    const parsed = esquemaInterpretarCaptura.safeParse({
      tipo: 'imagen',
      medioUrl: 'capturas/u/c.jpg',
      candidatos: candidatos(MAX_CANDIDATOS_ASISTENCIA + 1),
    })
    expect(parsed.success).toBe(false)
  })
})
