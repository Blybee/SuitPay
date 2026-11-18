import type { Firestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bd, COLECCIONES } from '../../src/server/firebase/admin.ts'
import {
  buscarProductosPublicados,
  consultarExistencias,
} from '../../src/server/mcp/catalogo.ts'
import { idDeDocumentoDeInventario } from '../../src/server/inventario/id-documento.ts'

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

describeConEmulador.sequential('catálogo MCP contra Firestore', () => {
  let base: Firestore

  beforeAll(async () => {
    process.env['FIRESTORE_EMULATOR_HOST'] = `${EMULADOR.host}:${EMULADOR.puerto}`
    process.env['GOOGLE_CLOUD_PROJECT'] = 'demo-suitpay'
    base = bd()
    await base.collection(COLECCIONES.catalogo).doc('actual').set({
      version: 1,
      productos: [
        {
          codigo: 'VM1',
          descripcion: 'VALMAX CODO 1/2',
          unidad: 'NIU',
          precio: 1500,
          activo: true,
          marca: 'VALMAX',
        },
        {
          codigo: 'C1',
          descripcion: 'CODO FG 1/2',
          unidad: 'NIU',
          precio: 900,
          activo: true,
          marca: 'FG',
        },
        {
          codigo: 'VIEJO',
          descripcion: 'CODO VIEJO',
          unidad: 'NIU',
          precio: 100,
          activo: false,
          marca: 'FG',
        },
      ],
    })
    await base
      .collection(COLECCIONES.inventario)
      .doc(idDeDocumentoDeInventario('C1'))
      .set({ codigo: 'C1', cantidad: 4, precioCompraCentimos: 4242, maximo: 10, alerta: false })
  })

  afterAll(async () => {
    if (!hayEmulador) return
    await base.collection(COLECCIONES.catalogo).doc('actual').delete()
    await base
      .collection(COLECCIONES.inventario)
      .doc(idDeDocumentoDeInventario('C1'))
      .delete()
  })

  it('encuentra el codo con una errata y no el inactivo', async () => {
    const lecturas = { n: 0 }
    const hallados = await buscarProductosPublicados({
      termino: 'vlamax',
      limite: 10,
      base: observarGets(base, lecturas),
    })
    expect(hallados.productos.map((producto) => producto.codigo)).toEqual(['VM1'])
    expect(hallados.productos[0]?.precioCentimos).toBe(1500)
    expect(hallados.lecturas).toBe(1)
    expect(lecturas.n).toBe(1)

    const inactivo = await buscarProductosPublicados({
      termino: 'viejo',
      limite: 10,
      base,
    })
    expect(inactivo.productos).toEqual([])
  })

  it('devuelve el costo y cuenta una lectura por código', async () => {
    const lecturas = { n: 0 }
    const stock = await consultarExistencias({
      codigos: ['C1', 'NO-ESTA'],
      base: observarGets(base, lecturas),
    })
    expect(stock.existencias).toEqual([
      { codigo: 'C1', cantidad: 4, precioCompraCentimos: 4242 },
      { codigo: 'NO-ESTA', cantidad: null, precioCompraCentimos: null },
    ])
    expect(stock.lecturas).toBe(2)
    expect(lecturas.n).toBe(2)
  })
})

function observarGets(
  firestore: Firestore,
  lecturas: { n: number },
): Firestore {
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
