import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import {
  CLIENTE_IDENTIFICADO,
  montarEscenario,
  peticion,
} from './ayudas-emision.ts'

/**
 * El umbral de identificación del comprador (FR-021).
 *
 * La afirmación que esta prueba protege no es solo que el umbral se aplique, sino
 * que **se lea de la configuración**. Es un número de origen regulatorio: puede
 * cambiar por norma sin que cambie nada más en SuitPay. Si estuviera cocido en el
 * código, un cambio de norma sería un despliegue, y lo peor no es el despliegue:
 * es que dentro de dos años nadie recuerde que ese número tenía origen legal.
 */
describe('umbral de identificación del comprador', () => {
  const lineaCara = {
    codigo: 'CAL-100',
    descripcion: 'CALENTADOR 100 LITROS',
    unidad: 'UND',
    cantidad: 1,
    precio: 90_000,
  }

  it('rechaza una boleta que supera el umbral sin cliente', async () => {
    const { contexto } = montarEscenario()

    await expect(
      emitirComprobante(contexto, peticion({ lineas: [lineaCara] })),
    ).rejects.toMatchObject({
      codigo: 'cliente_requerido',
      detalle: { motivo: 'supera_umbral' },
    })
  })

  it('la misma venta con cliente identificado sí se emite', async () => {
    const { contexto } = montarEscenario()

    const resultado = await emitirComprobante(
      contexto,
      peticion({ lineas: [lineaCara], cliente: CLIENTE_IDENTIFICADO }),
    )

    expect(resultado.estado).toBe('aceptado')
  })

  it('lee el umbral de la configuración y no de una constante', async () => {
    // La misma venta, dos umbrales distintos, dos resultados distintos. Si el
    // umbral estuviera cocido, esta prueba fallaría.
    const conUmbralAlto = montarEscenario({ umbral: 100_000 })
    const resultado = await emitirComprobante(
      conUmbralAlto.contexto,
      peticion({ lineas: [lineaCara] }),
    )
    expect(resultado.estado).toBe('aceptado')

    const conUmbralBajo = montarEscenario({ umbral: 10_000 })
    await expect(
      emitirComprobante(conUmbralBajo.contexto, peticion({ lineas: [lineaCara] })),
    ).rejects.toMatchObject({ codigo: 'cliente_requerido' })
  })

  it('no consume correlativo cuando rechaza por umbral', async () => {
    // Se comprueba antes de abrir la transacción, porque es un rechazo que el
    // vendedor resuelve pidiendo el documento al cliente. Quemar un correlativo
    // por eso dejaría un hueco en la numeración por cada cliente que no lleva el
    // documento encima.
    const { almacen, proveedor, contexto } = montarEscenario()

    await expect(
      emitirComprobante(contexto, peticion({ lineas: [lineaCara] })),
    ).rejects.toThrow()

    const serie = await almacen.leerSerie('vendedor-1__boleta')
    expect(serie?.ultimoNumero).toBe(0)
    expect(almacen.totalDeComprobantes).toBe(0)
    expect(proveedor.llamadasA('emitir')).toBe(0)
  })

  it('una factura exige cliente identificado sea cual sea el importe', async () => {
    const { contexto } = montarEscenario()

    await expect(
      emitirComprobante(contexto, peticion({ tipoDocumento: 'factura' })),
    ).rejects.toMatchObject({
      codigo: 'cliente_requerido',
      detalle: { motivo: 'tipo_lo_exige' },
    })
  })

  it('el umbral se compara contra el total recalculado, no el declarado', async () => {
    // Si se comparase contra el total del cliente, bastaría declarar un total bajo
    // para saltarse la identificación. El servidor recalcula y compara sobre lo
    // suyo.
    const { contexto } = montarEscenario()

    await expect(
      emitirComprobante(
        contexto,
        peticion({ lineas: [lineaCara], totalDeclarado: 100 }),
      ),
    ).rejects.toMatchObject({
      codigo: 'cliente_requerido',
      detalle: { total: 90_000 },
    })
  })
})
