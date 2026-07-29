import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'

/**
 * El total lo decide el servidor.
 *
 * No es desconfianza del vendedor: es que el cliente web puede estar en una
 * pestaña abierta desde ayer, con un catálogo de la semana pasada o con el reloj
 * mal. El total que se imprime en un documento fiscal no puede depender de eso.
 *
 * El importe no positivo es el otro caso en que la aritmética del cliente no puede
 * ser la última palabra, y vive en `emitir-importe.test.ts` (FR-013).
 */
describe('el total lo manda el servidor', () => {
  it('cuando el total declarado difiere, se emite el recalculado', async () => {
    const { almacen, contexto } = montarEscenario()

    const resultado = await emitirComprobante(
      contexto,
      // 2 × 12,50 son 25,00. El cliente declara 9,99.
      peticion({ totalDeclarado: 999 }),
    )

    expect(resultado.total).toBe(2_500)
    expect(resultado.totalCorregido).toBe(true)

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.total).toBe(2_500)
  })

  it('avisa de la corrección para que la interfaz pueda mostrarla', async () => {
    // Corregir en silencio sería peor que rechazar: el vendedor cobraría una
    // cifra y el comprobante diría otra. Tiene que poder enterarse.
    const { contexto } = montarEscenario()

    const coincidente = await emitirComprobante(
      contexto,
      peticion({ totalDeclarado: 2_500 }),
    )
    expect(coincidente.totalCorregido).toBe(false)
  })

  it('el importe de cada línea se redondea al céntimo', async () => {
    // El total impreso tiene que ser la suma exacta de los importes impresos: un
    // cliente que sume a mano las líneas del comprobante no puede obtener otra
    // cifra, porque esa conversación en el mostrador cuesta más que el céntimo.
    const { almacen, contexto } = montarEscenario()

    await emitirComprobante(
      contexto,
      peticion({
        lineas: [
          {
            codigo: 'CAB-1',
            descripcion: 'CABLE POR METRO',
            unidad: 'M',
            cantidad: 3.333,
            precio: 1_000,
          },
        ],
      }),
    )

    const [comprobante] = almacen.todosLosComprobantes()
    expect(comprobante?.lineas[0]?.importe).toBe(3_333)
    expect(comprobante?.total).toBe(3_333)
  })

})
