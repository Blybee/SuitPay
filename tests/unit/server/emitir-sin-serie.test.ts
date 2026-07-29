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

  it('una nota de venta no necesita serie regulada', async () => {
    // No tiene valor tributario, así que gastar numeración regulada en ella
    // abriría un hueco imposible de justificar.
    const { almacen, proveedor, contexto } = montarEscenario({ series: [] })

    const resultado = await emitirComprobante(
      contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )

    expect(resultado.estado).toBe('aceptado')
    expect(resultado.serie).toBe('')
    expect(resultado.numero).toBeNull()
    // Y no se le pide al proveedor: no existe ante la autoridad.
    expect(proveedor.llamadasA('emitir')).toBe(0)
    expect(almacen.totalDeComprobantes).toBe(1)
  })
})
