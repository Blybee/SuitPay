import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearApp } from '../../src/mcp/app.ts'
import { bd, COLECCIONES } from '../../src/server/firebase/admin.ts'
import { resumenDeVentas } from '../../src/server/ventas/resumen-periodo.ts'

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }

async function emuladorEscuchando(): Promise<boolean> {
  try {
    await fetch(`http://${EMULADOR.host}:${EMULADOR.puerto}/`)
    return true
  } catch {
    return false
  }
}

const hayEmulador = await emuladorEscuchando()

if (!hayEmulador) {
  console.warn(
    '\n  AVISO: resumen de ventas NO se verificó contra Firestore (sin emulador).\n',
  )
}

const describeConEmulador = describe.skipIf(!hayEmulador)

const AHORA = new Date('2026-11-18T15:00:00.000Z')
const NOCHE_DEL_ULTIMO_DIA = new Date('2020-12-01T04:30:00.000Z')
const MADRUGADA_DEL_MES_SIGUIENTE = new Date('2020-12-01T05:30:00.000Z')
const MEDIO_MES = new Date('2020-11-15T17:00:00.000Z')

describeConEmulador.sequential('resumen de ventas contra Firestore', () => {
  let base: Firestore

  beforeAll(async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] =
      `${EMULADOR.host}:${EMULADOR.puerto}`
    process.env['GOOGLE_CLOUD_PROJECT'] = 'demo-suitpay'
    base = bd()

    await Promise.all([
      poner(
        base,
        'resumen-nota',
        venta(
          'nota_venta',
          'aceptado',
          100,
          'vend-a',
          NOCHE_DEL_ULTIMO_DIA,
          {
            numeroDocumento: '20100000001',
            denominacion: 'ACME',
          },
          [{ codigo: 'P1', descripcion: 'Nota', importe: 100 }],
        ),
      ),
      poner(
        base,
        'resumen-boleta',
        venta(
          'boleta',
          'aceptado',
          200,
          'vend-b',
          MEDIO_MES,
          {
            numeroDocumento: '12345678',
            denominacion: 'NORTE',
          },
          [{ codigo: 'P2', descripcion: 'Boleta', importe: 200 }],
        ),
      ),
      poner(
        base,
        'resumen-anulado',
        venta('factura', 'anulado', 400, 'vend-a', MEDIO_MES, null, []),
      ),
      poner(
        base,
        'resumen-interno',
        venta(
          'interno_contingencia',
          'pendiente',
          800,
          'vend-a',
          MEDIO_MES,
          null,
          [],
        ),
      ),
      poner(
        base,
        'resumen-rechazado',
        venta('boleta', 'rechazado', 1600, 'vend-a', MEDIO_MES, null, []),
      ),
      poner(
        base,
        'resumen-guia',
        venta('guia', 'aceptado', 3200, 'vend-a', MEDIO_MES, null, []),
      ),
      poner(
        base,
        'resumen-siguiente',
        venta(
          'boleta',
          'aceptado',
          6400,
          'vend-a',
          MADRUGADA_DEL_MES_SIGUIENTE,
          null,
          [],
        ),
      ),
      poner(
        base,
        'resumen-curso',
        venta('boleta', 'aceptado', 777, 'vend-hoy', AHORA, null, []),
      ),
    ])
  })

  afterAll(async () => {
    if (!hayEmulador) return
    const ids = [
      'resumen-nota',
      'resumen-boleta',
      'resumen-anulado',
      'resumen-interno',
      'resumen-rechazado',
      'resumen-guia',
      'resumen-siguiente',
      'resumen-curso',
      'resumen-oct-ok',
      'resumen-oct-indet',
    ]
    await Promise.all(
      ids.map((id) =>
        base.collection(COLECCIONES.comprobantes).doc(id).delete(),
      ),
    )
    await base.collection(COLECCIONES.resumenesVentas).doc('2020-11').delete()
    await base.collection(COLECCIONES.resumenesVentas).doc('2020-10').delete()
    await base.collection(COLECCIONES.resumenesVentas).doc('2026-11').delete()
  })

  it('suma la nota de las 23:30 de Lima y excluye anulado, interno y el mes siguiente', async () => {
    const resumen = await resumenDeVentas({
      periodo: '2020-11',
      ahora: AHORA,
      base,
    })
    expect(resumen.totalCentimos).toBe(300)
    expect(resumen.cantidad).toBe(2)
    expect(resumen.ticketPromedioCentimos).toBe(150)
    expect(resumen.porTipo).toEqual([
      { tipo: 'boleta', totalCentimos: 200, cantidad: 1 },
      { tipo: 'factura', totalCentimos: 0, cantidad: 0 },
      { tipo: 'nota_venta', totalCentimos: 100, cantidad: 1 },
    ])
    expect(resumen.topVendedores.map((puesto) => puesto.vendedorId)).toEqual([
      'vend-b',
      'vend-a',
    ])
    expect(resumen.topClientes[0]?.numeroDocumento).toBe('12345678')
    expect(resumen.topProductos[0]?.codigo).toBe('P2')
  })

  it('materializa el mes cerrado una sola vez', async () => {
    const lecturas = { comprobantes: 0 }
    const observada = observarLecturas(base, lecturas)
    const primero = await resumenDeVentas({
      periodo: '2020-11',
      ahora: AHORA,
      base: observada,
    })
    await base.collection(COLECCIONES.comprobantes).doc('resumen-nota').update({
      total: 99_900,
    })
    const lecturasAntes = lecturas.comprobantes
    const segundo = await resumenDeVentas({
      periodo: '2020-11',
      ahora: AHORA,
      base: observada,
    })
    expect(primero.materializadoEn).toBe(AHORA.toISOString())
    expect(segundo.totalCentimos).toBe(300)
    expect(segundo.materializadoEn).toBe(primero.materializadoEn)
    expect(lecturas.comprobantes).toBe(lecturasAntes)
  })

  it('no congela un mes cerrado mientras quede una venta indeterminada', async () => {
    const octubre = new Date('2020-10-15T17:00:00.000Z')
    await poner(
      base,
      'resumen-oct-ok',
      venta('factura', 'aceptado', 100, 'vend-a', octubre, null, []),
    )
    await poner(
      base,
      'resumen-oct-indet',
      venta('boleta', 'indeterminado', 50, 'vend-a', octubre, null, []),
    )

    const primero = await resumenDeVentas({
      periodo: '2020-10',
      ahora: AHORA,
      base,
    })
    expect(primero.totalCentimos).toBe(100)
    expect(primero.ventasSinResolver).toBe(1)
    expect(primero.materializadoEn).toBeNull()
    expect(
      (
        await base.collection(COLECCIONES.resumenesVentas).doc('2020-10').get()
      ).exists,
    ).toBe(false)

    await base
      .collection(COLECCIONES.comprobantes)
      .doc('resumen-oct-ok')
      .update({ total: 80 })
    const segundo = await resumenDeVentas({
      periodo: '2020-10',
      ahora: AHORA,
      base,
    })
    expect(segundo.totalCentimos).toBe(80)
    expect(segundo.materializadoEn).toBeNull()

    await base
      .collection(COLECCIONES.comprobantes)
      .doc('resumen-oct-indet')
      .update({ estado: 'aceptado' })
    const tercero = await resumenDeVentas({
      periodo: '2020-10',
      ahora: AHORA,
      base,
    })
    expect(tercero.totalCentimos).toBe(130)
    expect(tercero.ventasSinResolver).toBe(0)
    expect(tercero.materializadoEn).toBe(AHORA.toISOString())

    await base
      .collection(COLECCIONES.comprobantes)
      .doc('resumen-oct-ok')
      .update({ total: 1 })
    const cuarto = await resumenDeVentas({
      periodo: '2020-10',
      ahora: AHORA,
      base,
    })
    expect(cuarto.totalCentimos).toBe(130)
  })

  it('la tool devuelve el total guardado y el documento del cliente', async () => {
    const creado = crearApp({
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1'],
      origenesPermitidos: ['127.0.0.1'],
    })
    const cliente = new Client(
      { name: 'prueba-resumen', version: '0' },
      { versionNegotiation: { mode: 'auto' } },
    )
    await cliente.connect(
      new StreamableHTTPClientTransport(new URL('http://127.0.0.1/mcp'), {
        fetch: async (url, init) => {
          const encabezados = new Headers(init?.headers)
          if (!encabezados.has('host')) {
            encabezados.set('host', new URL(url).host)
          }
          return creado.app.fetch(
            new Request(url, { ...init, headers: encabezados }),
          )
        },
      }),
    )
    try {
      const resultado = await cliente.callTool({
        name: 'resumen_ventas',
        arguments: { periodo: '2020-11' },
      })
      const texto = JSON.stringify(resultado)
      expect(resultado.structuredContent).toMatchObject({
        totalCentimos: 300,
        cantidad: 2,
      })
      expect(texto).toContain('20100000001')
      expect(texto).toContain('ACME')
      expect(texto).toContain('vend-b')
    } finally {
      await cliente.close()
      await creado.handler.close()
    }
  })

  it('no guarda el mes en curso', async () => {
    const resumen = await resumenDeVentas({
      periodo: '2026-11',
      ahora: AHORA,
      base,
    })
    expect(resumen.totalCentimos).toBe(777)
    expect(resumen.materializadoEn).toBeNull()
    const guardado = await base
      .collection(COLECCIONES.resumenesVentas)
      .doc('2026-11')
      .get()
    expect(guardado.exists).toBe(false)
  })
})

function venta(
  tipoDocumento: string,
  estado: string,
  total: number,
  vendedorId: string,
  emitidoEn: Date,
  cliente: { numeroDocumento: string; denominacion: string } | null,
  lineas: { codigo: string; descripcion: string; importe: number }[],
) {
  return {
    tipoDocumento,
    estado,
    total,
    vendedorId,
    emitidoEn,
    cliente,
    lineas,
    anulacion: estado === 'anulado' ? { motivo: 'error' } : null,
  }
}

function observarLecturas(
  firestore: Firestore,
  lecturas: { comprobantes: number },
): Firestore {
  return new Proxy(firestore, {
    get(objetivo, propiedad, receptor) {
      if (propiedad !== 'collection') {
        const valor = Reflect.get(objetivo, propiedad, receptor) as unknown
        return typeof valor === 'function' ? valor.bind(objetivo) : valor
      }
      return (nombre: string) => {
        const coleccion = objetivo.collection(nombre)
        if (nombre !== COLECCIONES.comprobantes) return coleccion
        return new Proxy(coleccion, {
          get(coleccionObjetivo, coleccionPropiedad, coleccionReceptor) {
            if (coleccionPropiedad === 'where') {
              return (...args: unknown[]) => {
                lecturas.comprobantes += 1
                return coleccionObjetivo.where(
                  ...(args as Parameters<typeof coleccionObjetivo.where>),
                )
              }
            }
            const valor = Reflect.get(
              coleccionObjetivo,
              coleccionPropiedad,
              coleccionReceptor,
            ) as unknown
            return typeof valor === 'function'
              ? valor.bind(coleccionObjetivo)
              : valor
          },
        })
      }
    },
  })
}

function poner(
  firestore: Firestore,
  id: string,
  datos: ReturnType<typeof venta>,
): Promise<unknown> {
  return firestore
    .collection(COLECCIONES.comprobantes)
    .doc(id)
    .set({
      ...datos,
      emitidoEn: Timestamp.fromDate(datos.emitidoEn),
    })
}
