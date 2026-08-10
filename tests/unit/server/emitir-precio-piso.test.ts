import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * El piso de precio mayorista se aplica en el servidor (FR-012 enmendado).
 * Un cliente manipulado no puede emitir por debajo del catálogo.
 */
describe('precio bajo el mayorista impide emitir', () => {
  it('rechaza una línea por debajo del catálogo', async () => {
    const { contexto } = montarEscenario()
    const conCatalogo = {
      ...contexto,
      precioCatalogoPorCodigo: new Map([['TUB-1-2', 1_250]]),
    }

    await expect(
      emitirComprobante(
        conCatalogo,
        peticion({
          lineas: [
            {
              codigo: 'TUB-1-2',
              descripcion: 'TUBO PVC',
              unidad: 'UND',
              cantidad: 1,
              precio: 1_100,
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'precio_bajo_catalogo' })
  })

  it('acepta precio igual al catálogo', async () => {
    const { contexto, almacen, proveedor } = montarEscenario()
    const conCatalogo = {
      ...contexto,
      precioCatalogoPorCodigo: new Map([['TUB-1-2', 1_250]]),
    }

    const respuesta = await emitirComprobante(
      conCatalogo,
      peticion({
        lineas: [
          {
            codigo: 'TUB-1-2',
            descripcion: 'TUBO PVC',
            unidad: 'UND',
            cantidad: 1,
            precio: 1_250,
          },
        ],
      }),
    )

    expect(respuesta.estado).toBe('aceptado')
    expect(almacen.todosLosComprobantes()).toHaveLength(1)
    expect(proveedor.llamadasA('emitir')).toBe(1)
  })

  it('sin mapa de catálogo no aplica el piso (pruebas legacy)', async () => {
    const { contexto } = montarEscenario()

    const respuesta = await emitirComprobante(
      contexto,
      peticion({
        lineas: [
          {
            codigo: 'TUB-1-2',
            descripcion: 'TUBO PVC',
            unidad: 'UND',
            cantidad: 1,
            precio: 100,
          },
        ],
      }),
    )

    expect(respuesta.estado).toBe('aceptado')
  })
})
