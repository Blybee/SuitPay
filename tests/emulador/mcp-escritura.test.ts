import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { idDeSerie } from '../../src/domain/documentos/tipos.ts'
import { bd, COLECCIONES, DOCUMENTOS } from '../../src/server/firebase/admin.ts'
import {
  consultarEstadoSunat,
  crearCotizacion,
  proveedorQueSoloConsulta,
  registrarCliente,
} from '../../src/server/mcp/escritura.ts'
import { exito } from '../../src/server/proveedor/interfaz.ts'
import type { ProveedorDeEmision } from '../../src/server/proveedor/interfaz.ts'

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
const describeConEmulador = describe.skipIf(!hayEmulador)

describeConEmulador.sequential('escritura MCP contra Firestore', () => {
  let base: Firestore

  beforeAll(async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = `${EMULADOR.host}:${EMULADOR.puerto}`
    process.env['GOOGLE_CLOUD_PROJECT'] = 'demo-suitpay'
    base = bd()
    await base.collection(COLECCIONES.catalogo).doc('actual').set({
      version: 1,
      productos: [
        {
          codigo: 'C1',
          descripcion: 'CODO FG 1/2',
          unidad: 'NIU',
          precio: 1500,
          activo: true,
          marca: 'FG',
        },
      ],
    })
    await base.collection(COLECCIONES.series).doc(idDeSerie('admin-1', 'boleta')).set({
      serie: 'B001',
      tipoDocumento: 'boleta',
      vendedorId: 'admin-1',
      numeroInicial: 1,
      ultimoNumero: 8,
      ultimoNumeroConfirmado: 0,
      activa: true,
    })
    await base.collection(COLECCIONES.comprobantes).doc('cmp-indet').set({
      estado: 'indeterminado',
      tipoDocumento: 'boleta',
      serie: 'B001',
      numero: 8,
      cliente: null,
      lineas: [],
      total: 1500,
      vendedorId: 'admin-1',
      emitidoEn: Timestamp.fromDate(new Date('2020-11-18T15:00:00.000Z')),
      intentos: [],
      anulacion: null,
    })
    await base.collection(COLECCIONES.comprobantes).doc('cmp-ok').set({
      estado: 'aceptado',
      tipoDocumento: 'boleta',
      serie: 'B001',
      numero: 3,
      cliente: null,
      lineas: [],
      total: 1500,
      vendedorId: 'admin-1',
      emitidoEn: Timestamp.fromDate(new Date('2020-11-18T15:00:00.000Z')),
      intentos: [],
      anulacion: null,
    })
  })

  afterAll(async () => {
    if (!hayEmulador) return
    const [coleccion, documento] = DOCUMENTOS.contadorCotizaciones.split('/')
    await Promise.all([
      base.collection(COLECCIONES.catalogo).doc('actual').delete(),
      base.collection(COLECCIONES.series).doc(idDeSerie('admin-1', 'boleta')).delete(),
      base.collection(COLECCIONES.comprobantes).doc('cmp-indet').delete(),
      base.collection(COLECCIONES.comprobantes).doc('cmp-ok').delete(),
      base.collection(COLECCIONES.cotizaciones).doc('clave-abc123').delete(),
      base.collection(COLECCIONES.clientes).doc('20100000001').delete(),
      base.collection(coleccion ?? 'config').doc(documento ?? 'contadorCotizaciones').delete(),
      base.collection(COLECCIONES.indices).doc('clientes').delete(),
    ])
  })

  it('guarda el precio del catálogo y no crea otra con la misma clave', async () => {
    const primera = await crearCotizacion({
      clave: 'clave-abc123',
      lineas: [{ codigo: 'C1', cantidad: 2, precio: 1 }],
      cliente: null,
      uid: 'admin-1',
      base,
    })
    const segunda = await crearCotizacion({
      clave: 'clave-abc123',
      lineas: [{ codigo: 'C1', cantidad: 9, precio: 1 }],
      cliente: null,
      uid: 'admin-1',
      base,
    })
    expect(primera.total).toBe(3000)
    expect(primera.yaExistia).toBe(false)
    expect(segunda).toEqual({ ...primera, yaExistia: true })
    const guardada = await base.collection(COLECCIONES.cotizaciones).doc('clave-abc123').get()
    expect(guardada.data()?.['estado']).toBe('pendiente')
    expect(guardada.data()?.['lineas']?.[0]?.precio).toBe(1500)
    const [coleccion, documento] = DOCUMENTOS.contadorCotizaciones.split('/')
    const contador = await base
      .collection(coleccion ?? 'config')
      .doc(documento ?? 'contadorCotizaciones')
      .get()
    expect(contador.data()?.['ultimoNumero']).toBe(1)
  })

  it('consulta el estado y no emite ni toca un aceptado', async () => {
    const emisiones = { n: 0 }
    let consultas = 0
    const interno = {
      consultarDocumento: async () => {
        consultas += 1
        return exito({
          existe: true,
          serie: 'B001',
          numero: 8,
          estado: 'aceptado' as const,
          total: 1500,
          numeroDocumentoCliente: undefined,
          emitidoEn: undefined,
          archivos: {},
          rastro: {
            codigoOriginal: undefined,
            mensajeOriginal: undefined,
            cuerpoOriginal: undefined,
            estadoHttp: undefined,
          },
        })
      },
    } as ProveedorDeEmision
    const proveedor = proveedorQueSoloConsulta(interno, emisiones)
    const resuelto = await consultarEstadoSunat({ id: 'cmp-indet', proveedor, base })
    expect(resuelto.desenlace).toBe('resuelto')
    expect(resuelto.comprobante.estado).toBe('aceptado')
    expect(emisiones.n).toBe(0)
    expect(consultas).toBe(1)

    const rechaza = proveedorQueSoloConsulta({
      ...interno,
      consultarDocumento: async () => {
        consultas += 1
        return exito({
          existe: true,
          serie: 'B001',
          numero: 3,
          estado: 'rechazado' as const,
          total: 1500,
          numeroDocumentoCliente: undefined,
          emitidoEn: undefined,
          archivos: {},
          rastro: {
            codigoOriginal: undefined,
            mensajeOriginal: undefined,
            cuerpoOriginal: undefined,
            estadoHttp: undefined,
          },
        })
      },
    } as ProveedorDeEmision)
    const cerrado = await consultarEstadoSunat({ id: 'cmp-ok', proveedor: rechaza, base })
    expect(cerrado.desenlace).toBe('ya_cerrado')
    expect(cerrado.comprobante.estado).toBe('aceptado')
    expect(consultas).toBe(1)
  })

  it('no duplica un cliente que ya está', async () => {
    const datos = {
      tipoDocumento: 'RUC' as const,
      numeroDocumento: '20100000001',
      denominacion: 'ACME SAC',
    }
    const alta = await registrarCliente(datos, 'admin-1')
    const repetida = await registrarCliente(
      { ...datos, denominacion: 'OTRO NOMBRE' },
      'admin-1',
    )
    expect(alta.yaExistia).toBe(false)
    expect(repetida.yaExistia).toBe(true)
    expect(repetida.denominacion).toBe('ACME SAC')
  })
})
