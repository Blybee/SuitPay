import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client'
import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearApp } from '../../src/mcp/app.ts'
import { bd, COLECCIONES } from '../../src/server/firebase/admin.ts'
import {
  buscarClientes,
  comprobantesPorResolver,
  cotizacionesPendientes,
  listarComprobantes,
} from '../../src/server/mcp/consultas.ts'

const EMULADOR = { host: '127.0.0.1', puerto: 8080 }
const TELEFONO = '999111222'

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

describeConEmulador.sequential('consultas MCP contra Firestore', () => {
  let base: Firestore
  const ids = Array.from({ length: 45 }, (_, indice) =>
    `pag-${String(indice).padStart(2, '0')}`,
  )

  beforeAll(async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = `${EMULADOR.host}:${EMULADOR.puerto}`
    process.env['GOOGLE_CLOUD_PROJECT'] = 'demo-suitpay'
    base = bd()
    await Promise.all(
      ids.map((id, indice) =>
        base
          .collection(COLECCIONES.comprobantes)
          .doc(id)
          .set({
            tipoDocumento: 'boleta',
            estado: 'aceptado',
            total: 100 + indice,
            emitidoEn: Timestamp.fromDate(new Date(Date.UTC(2020, 0, 1, 0, 0, indice))),
            cliente: {
              numeroDocumento: '20100000001',
              denominacion: 'ACME',
              telefono: TELEFONO,
            },
          }),
      ),
    )
    await base.collection(COLECCIONES.comprobantes).doc('por-resolver').set({
      tipoDocumento: 'factura',
      estado: 'indeterminado',
      total: 50,
      emitidoEn: Timestamp.fromDate(new Date('2020-06-01T12:00:00.000Z')),
      cliente: null,
    })
    await base.collection(COLECCIONES.comprobantes).doc('ya-aceptado').set({
      tipoDocumento: 'factura',
      estado: 'aceptado',
      total: 70,
      emitidoEn: Timestamp.fromDate(new Date('2020-06-02T12:00:00.000Z')),
      cliente: null,
    })
    await base.collection(COLECCIONES.indices).doc('clientes').set({
      clientes: [{ numeroDocumento: '20100000001', denominacion: 'ACME SAC' }],
    })
    await base.collection(COLECCIONES.clientes).doc('20100000001').set({
      numeroDocumento: '20100000001',
      denominacion: 'ACME SAC',
      telefono: TELEFONO,
    })
    await base.collection(COLECCIONES.cotizaciones).doc('cot-abierta').set({
      numero: 4,
      estado: 'pendiente',
      total: 800,
      telefonoVecino: TELEFONO,
      cliente: {
        numeroDocumento: '20100000001',
        denominacion: 'ACME SAC',
        telefono: TELEFONO,
      },
    })
    await base.collection(COLECCIONES.cotizaciones).doc('cot-cerrada').set({
      numero: 5,
      estado: 'convertida',
      total: 900,
      cliente: null,
    })
  })

  afterAll(async () => {
    if (!hayEmulador) return
    await Promise.all([
      ...ids.map((id) => base.collection(COLECCIONES.comprobantes).doc(id).delete()),
      base.collection(COLECCIONES.comprobantes).doc('por-resolver').delete(),
      base.collection(COLECCIONES.comprobantes).doc('ya-aceptado').delete(),
      base.collection(COLECCIONES.indices).doc('clientes').delete(),
      base.collection(COLECCIONES.clientes).doc('20100000001').delete(),
      base.collection(COLECCIONES.cotizaciones).doc('cot-abierta').delete(),
      base.collection(COLECCIONES.cotizaciones).doc('cot-cerrada').delete(),
    ])
  })

  it('recorre 45 comprobantes sin repetir ni saltar', async () => {
    const vistos: string[] = []
    let cursor: string | undefined
    const primera = await listarComprobantes({ base })
    expect(primera.filas).toHaveLength(20)
    expect(primera.siguiente).toBe(ids[19])
    vistos.push(...primera.filas.map((fila) => fila.id))
    cursor = primera.siguiente ?? undefined
    let guardas = 0
    while (cursor !== undefined && guardas < 5) {
      const pagina = await listarComprobantes({ cursor, base })
      vistos.push(...pagina.filas.map((fila) => fila.id))
      cursor = pagina.siguiente ?? undefined
      guardas += 1
    }
    expect(vistos).toEqual([...ids, 'por-resolver', 'ya-aceptado'])
    expect(new Set(vistos).size).toBe(vistos.length)
  })

  it('deja fuera del pendiente lo que ya está aceptado', async () => {
    const pendientes = await comprobantesPorResolver({ base })
    expect(pendientes.filas.map((fila) => fila.id)).toEqual(['por-resolver'])
    const cotizaciones = await cotizacionesPendientes({ base })
    expect(cotizaciones.cotizaciones.map((cotizacion) => cotizacion.id)).toEqual([
      'cot-abierta',
    ])
    expect(JSON.stringify(cotizaciones)).not.toContain(TELEFONO)
  })

  it('busca al cliente sin leer el teléfono', async () => {
    const lecturas = { n: 0 }
    const hallados = await buscarClientes({
      termino: 'acme',
      limite: 10,
      base: observarGets(base, lecturas),
    })
    expect(hallados.clientes).toEqual([
      { numeroDocumento: '20100000001', denominacion: 'ACME SAC' },
    ])
    expect(hallados.lecturas).toBe(1)
    expect(lecturas.n).toBe(1)
    expect(JSON.stringify(hallados)).not.toContain(TELEFONO)
  })

  it('el resource del comprobante no devuelve el teléfono', async () => {
    const creado = crearApp({
      host: '127.0.0.1',
      hostsPermitidos: ['127.0.0.1'],
      origenesPermitidos: ['127.0.0.1'],
    })
    const cliente = new Client(
      { name: 'prueba-consultas', version: '0' },
      { versionNegotiation: { mode: 'auto' } },
    )
    await cliente.connect(
      new StreamableHTTPClientTransport(new URL('http://127.0.0.1/mcp'), {
        fetch: async (url, init) => {
          const encabezados = new Headers(init?.headers)
          if (!encabezados.has('host')) encabezados.set('host', new URL(url).host)
          return creado.app.fetch(new Request(url, { ...init, headers: encabezados }))
        },
      }),
    )
    try {
      const leido = await cliente.readResource({ uri: 'suitpay://comprobantes/pag-00' })
      const texto = JSON.stringify(leido)
      expect(texto).toContain('20100000001')
      expect(texto).toContain('ACME')
      expect(texto).not.toContain(TELEFONO)
      expect(texto).toContain('100')
    } finally {
      await cliente.close()
      await creado.handler.close()
    }
  })
})

function observarGets(firestore: Firestore, lecturas: { n: number }): Firestore {
  return new Proxy(firestore, {
    get(objetivo, propiedad, receptor) {
      if (propiedad !== 'collection') {
        const valor = Reflect.get(objetivo, propiedad, receptor) as unknown
        return typeof valor === 'function' ? valor.bind(objetivo) : valor
      }
      return (nombre: string) => {
        const coleccion = objetivo.collection(nombre)
        return new Proxy(coleccion, {
          get(coleccionObjetivo, coleccionPropiedad, coleccionReceptor) {
            if (coleccionPropiedad !== 'doc') {
              const valor = Reflect.get(
                coleccionObjetivo,
                coleccionPropiedad,
                coleccionReceptor,
              ) as unknown
              return typeof valor === 'function' ? valor.bind(coleccionObjetivo) : valor
            }
            return (id: string) => {
              const documento = coleccionObjetivo.doc(id)
              return new Proxy(documento, {
                get(documentoObjetivo, documentoPropiedad, documentoReceptor) {
                  if (documentoPropiedad === 'get') {
                    return async () => {
                      lecturas.n += 1
                      return documentoObjetivo.get()
                    }
                  }
                  const valor = Reflect.get(
                    documentoObjetivo,
                    documentoPropiedad,
                    documentoReceptor,
                  ) as unknown
                  return typeof valor === 'function'
                    ? valor.bind(documentoObjetivo)
                    : valor
                },
              })
            }
          },
        })
      }
    },
  })
}
