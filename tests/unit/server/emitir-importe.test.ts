import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * Una línea con importe cero o negativo impide la emisión (FR-013).
 *
 * ## Por qué esto merece su propia prueba
 *
 * Podría parecer un detalle de validación, y es la última barrera antes de que un
 * documento tributario quede emitido con una cifra que no se puede cobrar. Un
 * comprobante en blanco o con una línea de regalo a cero no se corrige después: se
 * anula, y anular cuesta un trámite y una explicación al cliente.
 *
 * Los tres casos de abajo no son variaciones del mismo error, son tres gestos
 * distintos del mostrador. La cantidad a cero sale de corregir una cifra a medias.
 * El precio a cero sale de negociar un accesorio de regalo, que ocurre a diario. Y
 * el pedido vacío sale de pulsar emitir sobre la pantalla recién abierta.
 *
 * ## La afirmación que de verdad importa
 *
 * Es la última: rechazar **antes** de tocar la serie. Si el correlativo se
 * consumiera y luego se rechazara, quedaría un hueco en la numeración por un error
 * de tecleo, y los huecos en la numeración hay que justificarlos ante la autoridad.
 * Es la diferencia entre un rechazo que no deja rastro y uno que genera trabajo
 * administrativo.
 */
describe('el importe no positivo impide emitir', () => {
  it('rechaza una línea con cantidad cero', async () => {
    const { contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          lineas: [
            {
              codigo: 'TUB-1-2',
              descripcion: 'TUBO PVC',
              unidad: 'UND',
              cantidad: 0,
              precio: 1_250,
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'importe_no_positivo' })
  })

  it('rechaza una línea con precio cero', async () => {
    const { contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          lineas: [
            {
              codigo: 'ACC-1',
              descripcion: 'ACCESORIO DE REGALO',
              unidad: 'UND',
              cantidad: 1,
              precio: 0,
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'importe_no_positivo' })
  })

  it('rechaza un pedido vacío', async () => {
    const { contexto } = montarEscenario()

    await expect(
      emitirComprobante(contexto, peticion({ lineas: [] })),
    ).rejects.toMatchObject({ codigo: 'peticion_invalida' })
  })

  it('una línea no emitible no consume correlativo ni llega al proveedor', async () => {
    const { almacen, proveedor, contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({
          lineas: [
            { codigo: 'X', descripcion: 'X', unidad: 'UND', cantidad: 1, precio: 0 },
          ],
        }),
      ),
    ).rejects.toThrow()

    const serie = await almacen.leerSerie('vendedor-1__boleta')
    expect(serie?.ultimoNumero).toBe(0)
    expect(almacen.todosLosComprobantes()).toHaveLength(0)
    expect(proveedor.llamadasA('emitir')).toBe(0)
  })
})
