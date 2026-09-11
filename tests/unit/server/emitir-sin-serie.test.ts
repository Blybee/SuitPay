import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import {
  CLIENTE_IDENTIFICADO,
  montarEscenario,
  peticion,
} from './ayudas-emision.ts'

/**
 * Serie no configurada (FR-031).
 *
 * Lo que importa aquí es el **momento** del rechazo: tiene que ocurrir antes de
 * tocar la serie y antes de llamar al proveedor. Un fallo tardío dejaría un
 * comprobante a medias y quizá un correlativo consumido de otra serie, por un
 * problema que es puramente de configuración.
 *
 * El escenario es real: un vendedor nuevo empieza el lunes, nadie le asignó serie
 * de facturas y se entera con el primer cliente que pide factura delante.
 */
describe('emisión sin serie configurada', () => {
  it('se rechaza con serie_no_configurada', async () => {
    const { contexto } = montarEscenario({ series: ['boleta'] })

    await expect(
      emitirComprobante(
        contexto,
        // Con cliente: una factura sin cliente fallaría antes por exigirlo el
        // tipo, y entonces esta prueba no estaría comprobando la serie.
        peticion({ tipoDocumento: 'factura', cliente: CLIENTE_IDENTIFICADO }),
      ),
    ).rejects.toMatchObject({ codigo: 'serie_no_configurada' })
  })

  it('no crea ningún comprobante ni llama al proveedor', async () => {
    // La transacción se descarta entera. Es lo que garantiza que un fallo a mitad
    // no deje rastro: sin atomicidad real, el comprobante podría quedar creado.
    const { almacen, proveedor, contexto } = montarEscenario({
      series: ['boleta'],
    })

    await expect(
      emitirComprobante(
        contexto,
        peticion({ tipoDocumento: 'factura', cliente: CLIENTE_IDENTIFICADO }),
      ),
    ).rejects.toThrow()

    expect(almacen.totalDeComprobantes).toBe(0)
    expect(proveedor.llamadasA('emitir')).toBe(0)
  })

  it('no toca el correlativo de otra serie', async () => {
    const { almacen, contexto } = montarEscenario({ series: ['boleta'] })

    await expect(
      emitirComprobante(
        contexto,
        peticion({ tipoDocumento: 'factura', cliente: CLIENTE_IDENTIFICADO }),
      ),
    ).rejects.toThrow()

    const boletas = await almacen.leerSerie('vendedor-1__boleta')
    expect(boletas?.ultimoNumero).toBe(0)
  })

  it('una serie desactivada se trata como no configurada', async () => {
    // Desactivar una serie es la forma de retirarla sin borrar historia. Si
    // siguiera emitiendo, desactivarla no serviría de nada.
    const { almacen, contexto } = montarEscenario()
    almacen.sembrarSerie({
      id: 'vendedor-1__boleta',
      serie: 'B001',
      tipoDocumento: 'boleta',
      vendedorId: 'vendedor-1',
      numeroInicial: 1,
      ultimoNumero: 5,
      ultimoNumeroConfirmado: 5,
      activa: false,
    })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      codigo: 'serie_no_configurada',
    })
  })

  it('una serie con prefijo equivocado se rechaza antes de emitir', async () => {
    // Una serie de boletas que empieza por F llegaría al proveedor y volvería
    // como un rechazo con un mensaje que nadie en el mostrador sabría interpretar.
    const { almacen, proveedor, contexto } = montarEscenario()
    almacen.sembrarSerie({
      id: 'vendedor-1__boleta',
      serie: 'F001',
      tipoDocumento: 'boleta',
      vendedorId: 'vendedor-1',
      numeroInicial: 1,
      ultimoNumero: 0,
      ultimoNumeroConfirmado: 0,
      activa: true,
    })

    await expect(emitirComprobante(contexto, peticion())).rejects.toMatchObject({
      codigo: 'serie_no_configurada',
    })
    expect(proveedor.llamadasA('emitir')).toBe(0)
  })

  it('una nota de venta reclama correlativo local, no serie regulada', async () => {
    // No tiene valor tributario, así que no gasta B/F/T ni llama al proveedor.
    // Sí consume el correlativo interno que el administrador configura.
    const { almacen, proveedor, contexto } = montarEscenario({
      series: ['nota_venta'],
    })

    const resultado = await emitirComprobante(
      contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )

    expect(resultado.estado).toBe('aceptado')
    expect(resultado.serie).toBe('')
    expect(resultado.numero).toBe(1)
    expect(proveedor.llamadasA('emitir')).toBe(0)
    expect(almacen.totalDeComprobantes).toBe(1)
    const serie = await almacen.leerSerie('compartida__nota_venta')
    expect(serie?.ultimoNumero).toBe(1)
    expect(serie?.ultimoNumeroConfirmado).toBe(1)
  })

  it('dos vendedores comparten el correlativo de nota de venta', async () => {
    const { almacen, contexto } = montarEscenario({ series: ['nota_venta'] })
    await emitirComprobante(
      contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    const segundo = await emitirComprobante(
      { ...contexto, vendedorId: 'vendedor-2' },
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    expect(segundo.numero).toBe(2)
    const serie = await almacen.leerSerie('compartida__nota_venta')
    expect(serie?.ultimoNumero).toBe(2)
  })

  it('una nota de venta sin numeración local se rechaza antes de emitir', async () => {
    const { almacen, proveedor, contexto } = montarEscenario({ series: [] })

    await expect(
      emitirComprobante(
        contexto,
        peticion({ tipoDocumento: 'nota_venta' }),
      ),
    ).rejects.toMatchObject({ codigo: 'serie_no_configurada' })

    expect(almacen.totalDeComprobantes).toBe(0)
    expect(proveedor.llamadasA('emitir')).toBe(0)
  })
})
