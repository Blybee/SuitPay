import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { correrImportacion } from '../../src/domain/padron/correr.ts'
import { extraerPaginas } from '../../src/domain/padron/extraer-pdf.ts'
import {
  parsearClientes,
  parsearTransportistas,
} from '../../src/domain/padron/parsear.ts'
import type { ConteoDeLote } from '../../src/domain/padron/tipos.ts'
import { bd, COLECCIONES } from '../../src/server/firebase/admin.ts'
import {
  persistirLoteDeClientes,
  persistirLoteDeTransportistas,
} from '../../src/server/padron/persistir.ts'
import { pdfDeClientesSinteticos } from '../ayudas/pdf-padron.ts'

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

const clientesPdf = new Uint8Array(
  readFileSync(resolve('tests/fixtures/padron/clientes.pdf')),
)
const transportistasPdf = new Uint8Array(
  readFileSync(resolve('tests/fixtures/padron/transportistas.pdf')),
)

async function contar(coleccion: string): Promise<number> {
  const snap = await bd().collection(coleccion).count().get()
  return snap.data().count
}

async function borrarDocumentos(
  coleccion: string,
  ids: readonly string[],
): Promise<void> {
  for (let inicio = 0; inicio < ids.length; inicio += 400) {
    const grupo = bd().batch()
    for (const id of ids.slice(inicio, inicio + 400)) {
      grupo.delete(bd().collection(coleccion).doc(id))
    }
    await grupo.commit()
  }
}

async function quitarDelIndice(
  documento: 'clientes' | 'transportistas',
  ids: ReadonlySet<string>,
): Promise<void> {
  const ref = bd().collection('indices').doc(documento)
  const snap = await ref.get()
  const datos = snap.data()
  if (datos === undefined) return
  const lista = datos[documento]
  if (!Array.isArray(lista)) return
  const filtrada = lista.filter((fila) => {
    if (typeof fila !== 'object' || fila === null) return true
    const numero = (fila as { numeroDocumento?: unknown }).numeroDocumento
    return typeof numero !== 'string' || !ids.has(numero)
  })
  if (filtrada.length === lista.length) return
  await ref.set({ ...datos, [documento]: filtrada })
}

function idsSinteticos(cantidad: number): string[] {
  const ids: string[] = []
  for (let n = 1; n <= cantidad; n += 1) {
    ids.push(n % 7 === 0 ? String(10_000_000 + n) : String(10_000_000_000 + n))
  }
  return ids
}

describeConEmulador('importar padrón en el emulador', () => {
  beforeAll(() => {
    process.env['FIRESTORE_EMULATOR_HOST'] =
      `${EMULADOR.host}:${EMULADOR.puerto}`
    process.env['GOOGLE_CLOUD_PROJECT'] = 'demo-suitpay'
  })

  it('guarda las muestras, no pisa lo existente y la reimportación no cambia el conteo', async () => {
    const lecturaClientes = parsearClientes(await extraerPaginas(clientesPdf))
    const lecturaTransportistas = parsearTransportistas(
      await extraerPaginas(transportistasPdf),
    )
    const idsClientes = lecturaClientes.filas.map(
      (fila) => fila.numeroDocumento,
    )
    const idsTransportistas = lecturaTransportistas.filas.map(
      (fila) => fila.numeroDocumento,
    )
    await borrarDocumentos(COLECCIONES.clientes, idsClientes)
    await borrarDocumentos(COLECCIONES.transportistas, idsTransportistas)
    await quitarDelIndice('clientes', new Set(idsClientes))
    await quitarDelIndice('transportistas', new Set(idsTransportistas))

    await bd().collection(COLECCIONES.clientes).doc('45111392').set({
      tipoDocumento: 'DNI',
      numeroDocumento: '45111392',
      denominacion: 'NOMBRE MANUAL',
      creadoPor: 'previo',
    })

    const clientesAntes = await contar(COLECCIONES.clientes)
    const transportistasAntes = await contar(COLECCIONES.transportistas)

    const clientes = await correrImportacion({
      bytes: clientesPdf,
      tipo: 'clientes',
      persistirLote: (lote) =>
        persistirLoteDeClientes(
          lote.filter(
            (fila): fila is typeof fila & { tipoDocumento: 'DNI' | 'RUC' } =>
              'tipoDocumento' in fila,
          ),
          'admin-prueba',
        ),
    })
    const transportistas = await correrImportacion({
      bytes: transportistasPdf,
      tipo: 'transportistas',
      persistirLote: (lote) =>
        persistirLoteDeTransportistas(
          lote.filter(
            (fila): fila is typeof fila & { numeroDocumento: string } =>
              !('tipoDocumento' in fila),
          ),
          'admin-prueba',
        ),
    })

    expect(clientes.descartados).toBe(1)
    expect(clientes.nuevos).toBe(40)
    expect(clientes.yaExistian).toBe(1)
    expect(transportistas.nuevos + transportistas.yaExistian).toBe(123)

    const guardado = await bd()
      .collection(COLECCIONES.clientes)
      .doc('45111392')
      .get()
    expect(guardado.data()).toMatchObject({
      denominacion: 'NOMBRE MANUAL',
      creadoPor: 'previo',
      tipoDocumento: 'DNI',
    })
    expect(String(guardado.data()?.['direccion'])).toContain('NUEVA FLORIDA')

    const nuevo = await bd()
      .collection(COLECCIONES.clientes)
      .doc('20561321800')
      .get()
    expect(nuevo.data()).toMatchObject({
      tipoDocumento: 'RUC',
      numeroDocumento: '20561321800',
      denominacion: 'GRUPO VILRA E.I.R.L.',
    })

    const indice = await bd().collection('indices').doc('transportistas').get()
    const lista = (indice.data()?.['transportistas'] ?? []) as {
      numeroDocumento: string
      denominacion: string
    }[]
    expect(
      lista.filter((fila) => fila.numeroDocumento.includes('20609006928')),
    ).toEqual([
      {
        numeroDocumento: '20609006928',
        denominacion: 'JAKCARGA S.A.C.',
      },
    ])

    const clientesMedio = await contar(COLECCIONES.clientes)
    const transportistasMedio = await contar(COLECCIONES.transportistas)
    expect(clientesMedio - clientesAntes).toBe(40)
    expect(transportistasMedio - transportistasAntes).toBe(
      transportistas.nuevos,
    )

    const otraVez = await correrImportacion({
      bytes: clientesPdf,
      tipo: 'clientes',
      persistirLote: (lote) =>
        persistirLoteDeClientes(
          lote.filter(
            (fila): fila is typeof fila & { tipoDocumento: 'DNI' | 'RUC' } =>
              'tipoDocumento' in fila,
          ),
          'admin-prueba',
        ),
    })
    expect(otraVez).toEqual({
      nuevos: 0,
      yaExistian: 41,
      descartados: 1,
    })
    expect(await contar(COLECCIONES.clientes)).toBe(clientesMedio)

    const relleno = await bd()
      .collection(COLECCIONES.clientes)
      .doc('45111392')
      .get()
    expect(relleno.data()?.['denominacion']).toBe('NOMBRE MANUAL')
    expect(relleno.data()?.['direccion']).toBe(guardado.data()?.['direccion'])
  }, 60_000)

  it('escribe el PDF de 600 páginas por lotes sin pasar el techo del índice', async () => {
    const bytes = pdfDeClientesSinteticos(600)
    const sinteticos = idsSinteticos(8400)
    const ids = new Set(sinteticos)
    await borrarDocumentos(COLECCIONES.clientes, sinteticos)
    await quitarDelIndice('clientes', ids)

    try {
      const resumen = await correrImportacion({
        bytes,
        tipo: 'clientes',
        persistirLote: (lote) =>
          persistirLoteDeClientes(
            lote.filter(
              (fila): fila is typeof fila & { tipoDocumento: 'DNI' | 'RUC' } =>
                'tipoDocumento' in fila,
            ),
            'admin-prueba',
          ),
      })

      expect(resumen).toEqual({ nuevos: 8400, yaExistian: 0, descartados: 0 })

      const muestra = await bd()
        .collection(COLECCIONES.clientes)
        .doc('10000000001')
        .get()
      expect(muestra.exists).toBe(true)
      expect(muestra.data()?.['denominacion']).toBe(
        'CLIENTE SINTETICO 1 DISTRIBUIDORA',
      )

      const indice = await bd().collection('indices').doc('clientes').get()
      const lista = (indice.data()?.['clientes'] ?? []) as {
        numeroDocumento: string
      }[]
      expect(lista.some((fila) => fila.numeroDocumento === '10000000001')).toBe(
        true,
      )
      const bytesIndice = Buffer.byteLength(JSON.stringify(indice.data() ?? {}))
      expect(bytesIndice).toBeLessThan(1_048_576)

      const segunda: ConteoDeLote & { descartados: number } =
        await correrImportacion({
          bytes,
          tipo: 'clientes',
          persistirLote: (lote) =>
            persistirLoteDeClientes(
              lote.filter(
                (
                  fila,
                ): fila is typeof fila & {
                  tipoDocumento: 'DNI' | 'RUC'
                } => 'tipoDocumento' in fila,
              ),
              'admin-prueba',
            ),
        })
      expect(segunda.nuevos).toBe(0)
      expect(segunda.yaExistian).toBe(8400)
    } finally {
      await borrarDocumentos(COLECCIONES.clientes, sinteticos)
      await quitarDelIndice('clientes', ids)
    }
  }, 240_000)
})
