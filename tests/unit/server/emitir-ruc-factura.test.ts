import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import {
  CLIENTE_IDENTIFICADO,
  montarEscenario,
  peticion,
} from './ayudas-emision.ts'

const DNI = {
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  denominacion: 'Cliente DNI',
} as const

describe('factura exige RUC antes del proveedor', () => {
  it('rechaza una factura con DNI sin llamar al proveedor ni consumir serie', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({ tipoDocumento: 'factura', cliente: DNI }),
      ),
    ).rejects.toMatchObject({
      codigo: 'cliente_requerido',
      detalle: { motivo: 'sin_ruc' },
    })

    expect(proveedor.llamadasA('emitir')).toBe(0)
    const serie = await almacen.leerSerie('vendedor-1__factura')
    expect(serie?.ultimoNumero).toBe(0)
    expect(almacen.totalDeComprobantes).toBe(0)
  })

  it('rechaza una factura con RUC inválido sin llamar al proveedor', async () => {
    const { proveedor, contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          tipoDocumento: 'factura',
          cliente: {
            tipoDocumento: 'RUC',
            numeroDocumento: '15123456789',
            denominacion: 'RUC inválido',
          },
        }),
      ),
    ).rejects.toMatchObject({
      codigo: 'cliente_requerido',
      detalle: { motivo: 'sin_ruc' },
    })

    expect(proveedor.llamadasA('emitir')).toBe(0)
  })

  it('una boleta con RUC sigue emitiéndose', async () => {
    const { contexto, proveedor } = montarEscenario()

    const resultado = await emitirComprobante(
      contexto,
      peticion({ cliente: CLIENTE_IDENTIFICADO }),
    )

    expect(resultado.estado).toBe('aceptado')
    expect(proveedor.llamadasA('emitir')).toBe(1)
  })
})
