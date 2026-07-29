import { describe, expect, it } from 'vitest'
import {
  CODIGO_POR_ANULAR,
  traducirEstado,
} from '../../../src/server/proveedor/factpro/estados.ts'

/**
 * Estas pruebas protegen la traducción de estados del proveedor, que es la pieza
 * más fácil de romper sin que nada falle a la vista.
 */
describe('traducción de estados del proveedor', () => {
  it('no traduce ningún estado a indeterminado', () => {
    // La invariante central. `indeterminado` expresa **nuestra** incertidumbre
    // sobre si la petición llegó, y ningún estado informado por el proveedor
    // puede producirla: si él nos informa de un estado, la petición llegó.
    // Ver research.md, decisión 4b.
    const todosLosCodigos = [
      '01',
      '03',
      '05',
      '09',
      '11',
      '13',
      '19',
    ] as const

    for (const codigo of todosLosCodigos) {
      const traducido = traducirEstado(codigo)
      expect(traducido.estado, `código ${codigo}`).not.toBe('indeterminado')
    }
  })

  it('distingue sin respuesta de la autoridad de un fallo', () => {
    // Que la autoridad no haya contestado al proveedor es normal: él firma y
    // reintenta por su cuenta. Traducirlo como fallo mandaría a reconciliar
    // ventas que están perfectamente en curso.
    expect(traducirEstado('03').estado).toBe('sin_respuesta_autoridad')
    expect(traducirEstado('19').estado).toBe('sin_respuesta_autoridad')
    expect(traducirEstado('03').codigoDesconocido).toBe(false)
  })

  it('no da por cerrada una anulación que aún está en curso', () => {
    // "Por anular" es una transición, no un final. Si se tradujera a `anulado`,
    // la interfaz diría al vendedor que la baja está hecha cuando todavía puede
    // fallar.
    const enCurso = traducirEstado(CODIGO_POR_ANULAR)

    expect(enCurso.anulacionEnCurso).toBe(true)
    expect(enCurso.estado).not.toBe('anulado')
    expect(enCurso.estado).toBe('aceptado')
  })

  it('marca como desconocido un código nuevo en lugar de suponer', () => {
    // Si el proveedor añade un estado, tiene que aparecer como desconocido. La
    // alternativa —caer en "aceptado" por omisión— daría una venta por buena sin
    // saberlo.
    const desconocido = traducirEstado('77')

    expect(desconocido.codigoDesconocido).toBe(true)
    expect(desconocido.estado).toBeUndefined()
  })

  it('trata la ausencia de código como desconocida', () => {
    expect(traducirEstado(undefined).codigoDesconocido).toBe(true)
    expect(traducirEstado('').codigoDesconocido).toBe(true)
  })

  it('tolera códigos sin el cero inicial', () => {
    // El proveedor los documenta con dos cifras, pero un serializador que los
    // trate como números devolvería 5 en lugar de "05".
    expect(traducirEstado('5').estado).toBe('aceptado')
    expect(traducirEstado(' 09 ').estado).toBe('rechazado')
  })

  it('traduce el rechazo definitivo como tal', () => {
    // Un rechazo no se reintenta: se corrige y se emite un documento nuevo.
    expect(traducirEstado('09').estado).toBe('rechazado')
  })
})
