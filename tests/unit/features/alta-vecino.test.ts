import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { ProductoBuscable } from '../../../src/domain/busqueda/productos.ts'
import type { LineaDePedido } from '../../../src/domain/totales/calculo.ts'
import { CLAVES_DE_CONSULTA } from '../../../src/infra/consultas/cliente.ts'
import type { Cotizacion } from '../../../src/features/cotizaciones/tipos.ts'
import {
  aplicarProductosALineas,
  parcharLineasDeVecinoEnCache,
} from '../../../src/features/vecinos/lineas.ts'

const valvula: ProductoBuscable = {
  codigo: 'VAL-1',
  descripcion: 'VALVULA VALMAX',
  unidad: 'UND',
  precio: 1250,
  activo: true,
}

const codo: ProductoBuscable = {
  codigo: 'COD-1',
  descripcion: 'CODO PVC',
  unidad: 'UND',
  precio: 180,
  activo: true,
}

function cotizacionCon(
  lineas: readonly LineaDePedido[],
  total = 0,
): Cotizacion {
  return {
    id: 'vec-1',
    numero: 1,
    estado: 'pendiente',
    canal: 'vecino',
    aliasVecino: 'Salomon',
    cliente: null,
    lineas,
    total,
    creadoPor: 'v',
    creadoEn: new Date(0),
    actualizadoEn: null,
    telefonoVecino: null,
    generacionPedido: 0,
    diaCivilLineas: '2026-09-17',
    totalDeudas: 0,
  }
}

describe('aplicarProductosALineas', () => {
  it('agrega un producto nuevo y suma cantidad si el código ya está', () => {
    const conUno = aplicarProductosALineas([], [{ producto: valvula }])
    expect(conUno).toEqual([
      {
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
        unidad: 'UND',
        cantidad: 1,
        precio: 1250,
      },
    ])

    const conDos = aplicarProductosALineas(conUno, [
      { producto: valvula },
      { producto: codo, cantidad: 3 },
    ])
    expect(conDos).toEqual([
      {
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
        unidad: 'UND',
        cantidad: 2,
        precio: 1250,
      },
      {
        codigo: 'COD-1',
        descripcion: 'CODO PVC',
        unidad: 'UND',
        cantidad: 3,
        precio: 180,
      },
    ])
  })
})

describe('parcharLineasDeVecinoEnCache', () => {
  it('sustituye las líneas del vecino activo sin tocar a los demás', () => {
    const cliente = new QueryClient()
    const otro = cotizacionCon([], 0)
    const lista: Cotizacion[] = [
      cotizacionCon([], 0),
      { ...otro, id: 'vec-2', aliasVecino: 'Otro' },
    ]
    cliente.setQueryData(CLAVES_DE_CONSULTA.cotizacionesVecinos, lista)

    const lineas: LineaDePedido[] = [
      {
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
        unidad: 'UND',
        cantidad: 1,
        precio: 1250,
      },
    ]
    parcharLineasDeVecinoEnCache(cliente, 'vec-1', lineas, 1250)

    const cache = cliente.getQueryData<Cotizacion[]>(
      CLAVES_DE_CONSULTA.cotizacionesVecinos,
    )
    expect(cache?.[0]?.lineas).toEqual(lineas)
    expect(cache?.[0]?.total).toBe(1250)
    expect(cache?.[1]?.lineas).toEqual([])
  })
})
