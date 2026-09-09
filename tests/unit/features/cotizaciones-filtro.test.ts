import { describe, expect, it } from 'vitest'
import { filtrarPendientes } from '../../../src/features/cotizaciones/filtrar.ts'
import type { Cotizacion } from '../../../src/features/cotizaciones/tipos.ts'

function cotizacion(parcial: {
  readonly id: string
  readonly numero: number
  readonly denominacion?: string | null
  readonly total?: number
}): Cotizacion {
  const denominacion = parcial.denominacion
  return {
    id: parcial.id,
    numero: parcial.numero,
    estado: 'pendiente',
    canal: 'general',
    aliasVecino: null,
    cliente:
      denominacion === undefined || denominacion === null
        ? null
        : {
            tipoDocumento: 'DNI',
            numeroDocumento: '11111111',
            denominacion,
          },
    lineas: [
      {
        codigo: 'X',
        descripcion: 'Pieza',
        unidad: 'UND',
        cantidad: 1,
        precio: parcial.total ?? 900,
      },
    ],
    total: parcial.total ?? 900,
    creadoPor: 'v',
    creadoEn: new Date(0),
    actualizadoEn: null,
    telefonoVecino: null,
  }
}

const LISTA: readonly Cotizacion[] = [
  cotizacion({ id: 'sin', numero: 8, denominacion: null, total: 200 }),
  cotizacion({ id: 'test', numero: 5, denominacion: 'Test', total: 2070 }),
  cotizacion({
    id: 'cliente',
    numero: 4,
    denominacion: 'Cliente Test',
    total: 900,
  }),
]

describe('filtrar pendientes recientes', () => {
  it('sin término devuelve la lista completa', () => {
    expect(filtrarPendientes(LISTA, '')).toEqual(LISTA)
  })

  it('filtra por número exacto', () => {
    const ids = filtrarPendientes(LISTA, '5').map((cada) => cada.id)
    expect(ids).toEqual(['test'])
  })

  it('filtra por nombre de cliente', () => {
    const ids = filtrarPendientes(LISTA, 'cliente').map((cada) => cada.id)
    expect(ids).toContain('cliente')
  })

  it('filtra por monto formateado', () => {
    const ids = filtrarPendientes(LISTA, '20.70').map((cada) => cada.id)
    expect(ids).toContain('test')
  })

  it('una cotización sin cliente aparece si coincide el número', () => {
    const ids = filtrarPendientes(LISTA, '8').map((cada) => cada.id)
    expect(ids).toEqual(['sin'])
  })
})
