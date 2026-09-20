import { describe, expect, it } from 'vitest'
import { AlmacenDeInventarioMemoria } from '../../../src/server/inventario/almacen-memoria.ts'
import { aplicarPreciosCompra } from '../../../src/server/compras/aplicar.ts'
import { extraerPreciosCompraSimulado, exigirMediosDeCompra } from '../../../src/server/compras/extraer.ts'
import { promptDePreciosCompra } from '../../../src/server/compras/prompts.ts'
import { ErrorDeSuitPay } from '../../../src/server/errores.ts'

describe('exigirMediosDeCompra', () => {
  it('rechaza un lote vacío', () => {
    expect(() => exigirMediosDeCompra([])).toThrow(ErrorDeSuitPay)
  })
})

describe('extraerPreciosCompraSimulado', () => {
  it('usa el primer SKU del catálogo', () => {
    const boceto = extraerPreciosCompraSimulado(new Set(['TUB-1-2', 'CODO']))
    expect(boceto.modelo).toBe('simulado')
    expect(boceto.coincidencias[0]?.codigo).toBe('TUB-1-2')
    expect(boceto.coincidencias[0]?.precioCompraCentimos).toBe(1250)
    expect(boceto.sinMatch.length).toBeGreaterThan(0)
  })
})

describe('aplicarPreciosCompra', () => {
  it('escribe costo sin inventar cantidad', async () => {
    const inventario = new AlmacenDeInventarioMemoria()
    await aplicarPreciosCompra({
      coincidencias: [
        {
          codigo: 'TUB-1-2',
          precioCompraCentimos: 900,
          precioCompraEn: '2026-03-15',
          etiquetaFactura: 'tubo',
        },
      ],
      autorId: 'admin',
      momento: new Date('2026-09-19'),
      inventario,
    })
    const leida = await inventario.leer('TUB-1-2')
    expect(leida?.precioCompraCentimos).toBe(900)
    expect(leida?.cantidad).toBeUndefined()
  })

  it('al aplicar costo no borra una cantidad previa', async () => {
    const inventario = new AlmacenDeInventarioMemoria()
    inventario.sembrar({
      codigo: 'TUB-1-2',
      cantidad: 10,
      maximo: 10,
      alerta: false,
      actualizadoPor: 'admin',
      actualizadoEn: new Date(),
    })
    await aplicarPreciosCompra({
      coincidencias: [
        {
          codigo: 'TUB-1-2',
          precioCompraCentimos: 900,
          etiquetaFactura: 'tubo',
        },
      ],
      autorId: 'admin',
      momento: new Date(),
      inventario,
    })
    const leida = await inventario.leer('TUB-1-2')
    expect(leida?.cantidad).toBe(10)
    expect(leida?.precioCompraCentimos).toBe(900)
  })
})

describe('promptDePreciosCompra', () => {
  it('no pide precio de venta y declara compacto sin precio', () => {
    const prompt = promptDePreciosCompra({
      catalogoJson: '{"id":"C1","n":"CODO","m":"Pavco"}',
      archivos: 1,
    })
    expect(prompt).toMatch(/SIN precio/)
    expect(prompt).toMatch(/No uses el precio de venta/)
  })
})
