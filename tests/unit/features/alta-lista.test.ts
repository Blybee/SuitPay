import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { CLAVES_DE_CONSULTA } from '../../../src/infra/consultas/cliente.ts'
import type { LineaDeRequerimiento } from '../../../src/domain/lista/tipos.ts'
import {
  aplicarProductosALista,
  parcharLineasDeListaEnCache,
} from '../../../src/features/lista/lineas.ts'

const valvula: LineaDeRequerimiento = {
  id: 'l-1',
  codigo: 'VAL-1',
  descripcion: 'VALVULA VALMAX',
  cantidad: 1,
  urgencia: 'normal',
}

describe('aplicarProductosALista', () => {
  it('agrega un producto nuevo y suma cantidad si el código ya está', () => {
    const conUno = aplicarProductosALista([], [
      {
        id: 'n-1',
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
      },
    ])
    expect(conUno).toEqual([
      {
        id: 'n-1',
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
        cantidad: 1,
        urgencia: 'normal',
      },
    ])

    const conDos = aplicarProductosALista(conUno, [
      {
        id: 'n-2',
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
      },
      {
        id: 'n-3',
        codigo: 'COD-1',
        descripcion: 'CODO PVC',
        cantidad: 3,
        urgencia: 'urgente',
      },
    ])
    expect(conDos).toEqual([
      {
        id: 'n-1',
        codigo: 'VAL-1',
        descripcion: 'VALVULA VALMAX',
        cantidad: 2,
        urgencia: 'normal',
      },
      {
        id: 'n-3',
        codigo: 'COD-1',
        descripcion: 'CODO PVC',
        cantidad: 3,
        urgencia: 'urgente',
      },
    ])
  })
})

describe('parcharLineasDeListaEnCache', () => {
  it('sustituye las líneas del día sin tocar otras fechas', () => {
    const cliente = new QueryClient()
    const hoy = '2026-09-19'
    const ayer = '2026-09-18'
    cliente.setQueryData(
      CLAVES_DE_CONSULTA.listaRequerimiento('v', ayer),
      [valvula],
    )
    cliente.setQueryData(
      CLAVES_DE_CONSULTA.listaRequerimiento('v', hoy),
      [] as LineaDeRequerimiento[],
    )

    const altas: LineaDeRequerimiento[] = [
      {
        id: 'n-1',
        codigo: 'COD-1',
        descripcion: 'CODO PVC',
        cantidad: 2,
        urgencia: 'normal',
      },
    ]
    parcharLineasDeListaEnCache(cliente, 'v', hoy, altas)

    expect(
      cliente.getQueryData<LineaDeRequerimiento[]>(
        CLAVES_DE_CONSULTA.listaRequerimiento('v', hoy),
      ),
    ).toEqual(altas)
    expect(
      cliente.getQueryData<LineaDeRequerimiento[]>(
        CLAVES_DE_CONSULTA.listaRequerimiento('v', ayer),
      ),
    ).toEqual([valvula])
  })
})
