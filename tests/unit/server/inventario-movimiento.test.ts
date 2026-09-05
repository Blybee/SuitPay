import { describe, expect, it } from 'vitest'
import { emitirComprobante } from '../../../src/server/emision/emitir.ts'
import { anularComprobante } from '../../../src/server/emision/anular.ts'
import type { ContextoDeAnulacion } from '../../../src/server/emision/anular.ts'
import { consultarEstadoEmision } from '../../../src/server/emision/consultar-estado.ts'
import { emitirGuia } from '../../../src/server/emision/emitir-guia.ts'
import { montarEscenario, peticion } from './ayudas-emision.ts'
import type { Escenario } from './ayudas-emision.ts'
import { peticionGuia } from './guia-frontera.test.ts'

function anulacionDe(escenario: Escenario): ContextoDeAnulacion {
  return {
    almacen: escenario.almacen,
    proveedor: escenario.proveedor,
    inventario: escenario.inventario,
    ahora: escenario.contexto.ahora,
  }
}

function sembrarTubo(escenario: Escenario): void {
  escenario.inventario.sembrar({
    codigo: 'TUB-1-2',
    cantidad: 10,
    maximo: 10,
    alerta: false,
    actualizadoPor: 'admin',
    actualizadoEn: new Date(),
  })
}

describe('inventario al emitir y anular', () => {
  it('descuenta una vez y reintegra al anular NV', async () => {
    const escenario = montarEscenario({ series: [] })
    sembrarTubo(escenario)

    const emitido = await emitirComprobante(
      escenario.contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    const trasVenta = await escenario.inventario.leer('TUB-1-2')
    expect(trasVenta?.cantidad).toBe(8)

    await emitirComprobante(
      escenario.contexto,
      peticion({
        tipoDocumento: 'nota_venta',
        claveIdempotencia: emitido.comprobanteId,
      }),
    )
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(8)

    await anularComprobante(anulacionDe(escenario), {
      comprobanteId: emitido.comprobanteId,
      motivo: 'error de carga',
      autorId: 'vendedor-1',
    })
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(10)
  })

  it('no inventa cantidad si el SKU no está controlado', async () => {
    const escenario = montarEscenario({ series: [] })
    await emitirComprobante(
      escenario.contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    expect(await escenario.inventario.leer('TUB-1-2')).toBeNull()
  })

  it('aplica el descuento al resolver un indeterminado por consulta', async () => {
    const escenario = montarEscenario()
    sembrarTubo(escenario)
    const p = peticion({ claveIdempotencia: 'bol-indeterminada' })
    escenario.proveedor.configurarEmision({ tipo: 'acepta_pero_no_contesta' })
    await expect(
      emitirComprobante(escenario.contexto, p),
    ).rejects.toMatchObject({ codigo: 'emision_indeterminada' })
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(10)

    const resultado = await consultarEstadoEmision(
      {
        almacen: escenario.almacen,
        proveedor: escenario.proveedor,
        inventario: escenario.inventario,
      },
      p.claveIdempotencia,
    )
    expect(resultado.desenlace).toBe('resuelto')
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(8)
  })

  it('una segunda anulación no vuelve a reintegrar', async () => {
    const escenario = montarEscenario({ series: [] })
    sembrarTubo(escenario)
    const emitido = await emitirComprobante(
      escenario.contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    const ctx = anulacionDe(escenario)
    await anularComprobante(ctx, {
      comprobanteId: emitido.comprobanteId,
      motivo: 'error de carga',
      autorId: 'vendedor-1',
    })
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(10)
    const segunda = await anularComprobante(ctx, {
      comprobanteId: emitido.comprobanteId,
      motivo: 'error de carga',
      autorId: 'vendedor-1',
    })
    expect(segunda.yaEstabaAnulado).toBe(true)
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(10)
  })

  it('anular sin haber aplicado no inventa un documento', async () => {
    const escenario = montarEscenario({ series: [] })
    const emitido = await emitirComprobante(
      escenario.contexto,
      peticion({ tipoDocumento: 'nota_venta' }),
    )
    await anularComprobante(anulacionDe(escenario), {
      comprobanteId: emitido.comprobanteId,
      motivo: 'error de carga',
      autorId: 'vendedor-1',
    })
    expect(await escenario.inventario.leer('TUB-1-2')).toBeNull()
  })

  it('la guía asociada no descuenta de nuevo y un reintegro restaura', async () => {
    const escenario = montarEscenario({ series: ['boleta', 'guia'] })
    sembrarTubo(escenario)
    const boleta = await emitirComprobante(escenario.contexto, peticion())
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(8)

    await emitirGuia(
      escenario.contexto,
      peticionGuia({ comprobanteOrigenId: boleta.comprobanteId }),
    )
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(8)

    await anularComprobante(anulacionDe(escenario), {
      comprobanteId: boleta.comprobanteId,
      motivo: 'error de carga',
      autorId: 'vendedor-1',
    })
    expect((await escenario.inventario.leer('TUB-1-2'))?.cantidad).toBe(10)
  })
})
