import { describe, expect, it } from 'vitest'
import { buscarCotizacionesPorNombre } from '../../../src/domain/busqueda/cotizaciones.ts'
import type { Cotizacion } from '../../../src/features/cotizaciones/tipos.ts'

function cotizacion(parcial: {
  readonly id: string
  readonly numero: number
  readonly denominacion?: string | null
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
        precio: 900,
      },
    ],
    total: 900,
    creadoPor: 'v',
    creadoEn: new Date(0),
    actualizadoEn: null,
    telefonoVecino: null,
  }
}

const LISTA: readonly Cotizacion[] = [
  cotizacion({ id: 'a', numero: 8, denominacion: null }),
  cotizacion({ id: 'b', numero: 5, denominacion: 'Test' }),
  cotizacion({ id: 'c', numero: 4, denominacion: 'Cliente Test' }),
  cotizacion({ id: 'd', numero: 3, denominacion: 'Sin cliente' }),
  cotizacion({ id: 'e', numero: 2, denominacion: 'Aquato SAC' }),
]

describe('buscar cotizaciones por nombre', () => {
  it('encuentra por nombre y tolera una errata', () => {
    const resultado = buscarCotizacionesPorNombre(LISTA, 'clinte test')
    expect(resultado.sinCoincidencias).toBe(false)
    expect(
      resultado.coincidencias.map((cada) => cada.elemento.id),
    ).toContain('c')
  })

  it('ignora sin cliente y las que no tienen nombre', () => {
    const resultado = buscarCotizacionesPorNombre(LISTA, 'cliente')
    const ids = resultado.coincidencias.map((cada) => cada.elemento.id)
    expect(ids).not.toContain('a')
    expect(ids).not.toContain('d')
  })

  it('no busca en tiempo real: un término vacío no lista pendientes', () => {
    const resultado = buscarCotizacionesPorNombre(LISTA, '   ')
    expect(resultado.sinCoincidencias).toBe(true)
    expect(resultado.coincidencias).toHaveLength(0)
  })

  it('encuentra Aquato con token corto extra', () => {
    const resultado = buscarCotizacionesPorNombre(LISTA, 'Aquato s')
    expect(resultado.sinCoincidencias).toBe(false)
    expect(resultado.coincidencias[0]?.elemento.id).toBe('e')
  })
})
