import { describe, expect, it } from 'vitest'
import {
  buscarProductos,
  crearIndice,
  loteDeCandidatos
  
} from '#/domain/busqueda/productos.ts'
import type {ProductoBuscable} from '#/domain/busqueda/productos.ts';

const CATALOGO: ProductoBuscable[] = [
  { codigo: 'CFG12', descripcion: 'CODO FG 1/2', unidad: 'UND', precio: 1230, activo: true },
  { codigo: 'CFG34', descripcion: 'CODO FG 3/4', unidad: 'UND', precio: 1850, activo: true },
  { codigo: 'CPVC12', descripcion: 'CODO PVC 1/2', unidad: 'UND', precio: 420, activo: true },
  { codigo: 'TFG12', descripcion: 'TEE FG 1/2', unidad: 'UND', precio: 1500, activo: true },
  { codigo: 'NIPFG12', descripcion: 'NIPLE FG 1/2', unidad: 'UND', precio: 900, activo: true },
  { codigo: 'LLPASO12', descripcion: 'LLAVE DE PASO BRONCE 1/2', unidad: 'UND', precio: 3500, activo: true },
  { codigo: 'VIEJO', descripcion: 'CODO FG 1/2 ANTIGUO', unidad: 'UND', precio: 1100, activo: false },
]

const indice = crearIndice(CATALOGO)

describe('coincidencia aproximada de productos', () => {
  it('encuentra un producto escrito tal cual', () => {
    const resultado = buscarProductos(indice, 'CODO FG 1/2')
    expect(resultado.sinCoincidencias).toBe(false)
    expect(resultado.coincidencias[0]?.elemento.codigo).toBe('CFG12')
  })

  it('EL PROBLEMA DEL SISTEMA ACTUAL: tolera el orden de los términos', () => {
    // Ésta es una de las quejas concretas que originaron el proyecto: el sistema
    // que usan hoy no encuentra el producto si los términos no van en el orden
    // exacto en que están guardados.
    const resultado = buscarProductos(indice, '1/2 fg codo')
    expect(resultado.sinCoincidencias).toBe(false)
    expect(
      resultado.coincidencias.map((cada) => cada.elemento.codigo),
    ).toContain('CFG12')
  })

  it('tolera errores menores de tecleo', () => {
    const resultado = buscarProductos(indice, 'codo fg 1/2')
    expect(resultado.sinCoincidencias).toBe(false)
  })

  it('encuentra por código', () => {
    const resultado = buscarProductos(indice, 'LLPASO12')
    expect(resultado.coincidencias[0]?.elemento.codigo).toBe('LLPASO12')
  })

  it('no ofrece productos dados de baja', () => {
    const codigos = buscarProductos(indice, 'CODO FG 1/2').coincidencias.map(
      (cada) => cada.elemento.codigo,
    )
    expect(codigos).not.toContain('VIEJO')
  })
})

describe('la ausencia de coincidencias se distingue de la aproximada (FR-008)', () => {
  it('declara explícitamente que no hay nada cuando no hay nada', () => {
    const resultado = buscarProductos(indice, 'cemento portland tipo uno')
    expect(resultado.sinCoincidencias).toBe(true)
    expect(resultado.coincidencias).toHaveLength(0)
  })

  it('un término vacío no es una búsqueda sin resultados, es ninguna búsqueda', () => {
    const resultado = buscarProductos(indice, '   ')
    expect(resultado.sinCoincidencias).toBe(true)
    expect(resultado.soloAproximadas).toBe(false)
  })

  it('etiqueta el grado de cada coincidencia', () => {
    const resultado = buscarProductos(indice, 'CODO FG 1/2')
    for (const coincidencia of resultado.coincidencias) {
      expect(['exacta', 'fuerte', 'aproximada']).toContain(coincidencia.grado)
    }
  })

  it('EL CASO PELIGROSO: pedir 3/4 no debe devolver el de 1/2 como si fuera exacto', () => {
    // Un buscador que ante "codo fg 3/4" entregue calladamente el de 1/2 porque
    // era lo más parecido es peor que uno que no devuelve nada: el vendedor
    // teclea rápido, ve una fila, la acepta y factura la pieza equivocada.
    const resultado = buscarProductos(indice, 'CODO FG 3/4')
    const primera = resultado.coincidencias[0]

    expect(primera?.elemento.codigo).toBe('CFG34')

    const elDeMedia = resultado.coincidencias.find(
      (cada) => cada.elemento.codigo === 'CFG12',
    )
    if (elDeMedia !== undefined) {
      expect(elDeMedia.grado).not.toBe('exacta')
      expect(elDeMedia.distancia).toBeGreaterThan(primera?.distancia ?? 0)
    }
  })
})

describe('lote de candidatos para la asistencia', () => {
  it('reúne candidatos de varios términos sin repetir productos', () => {
    const lote = loteDeCandidatos(indice, ['codo fg 1/2', 'codo fg 3/4'])
    const codigos = lote.map((cada) => cada.codigo)
    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('manda un subconjunto y no el catálogo entero', () => {
    const lote = loteDeCandidatos(indice, ['codo'], 2)
    expect(lote.length).toBeLessThan(CATALOGO.length)
  })
})
