import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { correrImportacion } from '#/domain/padron/correr.ts'
import { extraerPaginas } from '#/domain/padron/extraer-pdf.ts'
import { bytesDeIndice } from '#/domain/padron/indice.ts'
import {
  parsearClientes,
  parsearTransportistas,
} from '#/domain/padron/parsear.ts'
import type { EntradaDeIndice } from '#/domain/padron/tipos.ts'
import { pdfDeClientesSinteticos } from '../../ayudas/pdf-padron.ts'

const clientesPdf = new Uint8Array(
  readFileSync(resolve('tests/fixtures/padron/clientes.pdf')),
)
const transportistasPdf = new Uint8Array(
  readFileSync(resolve('tests/fixtures/padron/transportistas.pdf')),
)

describe('parsear padrón desde las muestras', () => {
  it('lee 41 clientes únicos y descarta el RUC repetido', async () => {
    const lectura = parsearClientes(await extraerPaginas(clientesPdf))

    expect(lectura.filas).toHaveLength(41)
    expect(lectura.descartados).toBe(1)
    expect(lectura.filas[0]).toEqual({
      tipoDocumento: 'RUC',
      numeroDocumento: '20561321800',
      denominacion: 'GRUPO VILRA E.I.R.L.',
      direccion:
        'AV. LIBERTAD NRO. 580 BARRIO YANCE (LIBERTAD 578-580 FRENTE EMAVISA) AMAZONAS - CH',
    })
    expect(
      lectura.filas.find((fila) => fila.numeroDocumento === '45111392'),
    ).toEqual({
      tipoDocumento: 'DNI',
      numeroDocumento: '45111392',
      denominacion: 'DIONICIO CADILLO NEHEMIAS ABEL',
      direccion: 'NUEVA FLORIDA JR. AMAZONAS N°150 - ANCASH HUARAZ HUARAZ',
    })
    expect(
      lectura.filas.filter((fila) => fila.numeroDocumento === '20601825245'),
    ).toHaveLength(1)
    expect(
      lectura.filas.every(
        (fila) =>
          !fila.direccion?.includes('VENDEDOR') &&
          !fila.denominacion.includes('VENDEDOR'),
      ),
    ).toBe(true)
  })

  it('toma el teléfono de la fila de identidad y no la línea del vendedor', () => {
    const lectura = parsearClientes([
      {
        items: [
          { str: '1', x: 56, y: 700 },
          { str: '20123456789', x: 76, y: 700 },
          { str: 'ACME S.A.C.', x: 141, y: 700 },
          { str: '999888777', x: 420, y: 700 },
          { str: 'AV LIMA 1', x: 141, y: 680 },
          { str: 'VENDEDOR: NADIE', x: 141, y: 660 },
          { str: '2', x: 56, y: 620 },
          { str: '20123456789', x: 76, y: 620 },
          { str: 'OTRO NOMBRE', x: 141, y: 620 },
        ],
      },
    ])

    expect(lectura).toEqual({
      descartados: 1,
      filas: [
        {
          tipoDocumento: 'RUC',
          numeroDocumento: '20123456789',
          denominacion: 'ACME S.A.C.',
          telefono: '999888777',
          direccion: 'AV LIMA 1',
        },
      ],
    })
  })

  it('deja 123 transportistas con RUC válido y tira la basura', async () => {
    const lectura = parsearTransportistas(
      await extraerPaginas(transportistasPdf),
    )
    const documentos = lectura.filas.map((fila) => fila.numeroDocumento)

    expect(lectura.filas).toHaveLength(123)
    expect(new Set(documentos).size).toBe(123)
    expect(
      lectura.filas.find((fila) => fila.numeroDocumento === '20609006928'),
    ).toEqual({
      numeroDocumento: '20609006928',
      denominacion: 'JAKCARGA S.A.C.',
      direccion: 'JR. MONTEVIDEO N° 529 LIMA',
    })
    expect(documentos).not.toContain('0')
    expect(
      lectura.filas.some((fila) => fila.denominacion === 'MISMO CLIENTE'),
    ).toBe(false)
    expect(lectura.filas.some((fila) => fila.denominacion === 'T')).toBe(false)
    expect(lectura.filas.some((fila) => fila.denominacion === 'G')).toBe(false)
    expect(
      lectura.filas.filter((fila) => fila.numeroDocumento === '20531983255'),
    ).toHaveLength(1)
    expect(lectura.descartados).toBeGreaterThan(0)
  })

  it('descarta código sin RUC y no le pega esa dirección al anterior', () => {
    const lectura = parsearTransportistas([
      {
        items: [
          { str: '000', x: 37, y: 700 },
          { str: 'MISMO CLIENTE', x: 61, y: 700 },
          { str: '030', x: 37, y: 660 },
          { str: 'T', x: 61, y: 660 },
          { str: '0', x: 491, y: 660 },
          { str: '049', x: 37, y: 640 },
          { str: 'G', x: 61, y: 640 },
          { str: '106', x: 37, y: 620 },
          { str: 'TRANSPORTES', x: 61, y: 620 },
          { str: 'JR GARCIA NARANJO 1072', x: 61, y: 606 },
          { str: '108', x: 37, y: 580 },
          { str: 'A', x: 61, y: 580 },
          { str: '001', x: 37, y: 540 },
          { str: 'JAKCARGA S.A.C.', x: 61, y: 540 },
          { str: '20609006928', x: 491, y: 540 },
          { str: 'JR. MONTEVIDEO', x: 61, y: 526 },
        ],
      },
    ])

    expect(lectura.descartados).toBe(5)
    expect(lectura.filas).toEqual([
      {
        numeroDocumento: '20609006928',
        denominacion: 'JAKCARGA S.A.C.',
        direccion: 'JR. MONTEVIDEO',
      },
    ])
  })
})

describe('volumen del padrón', () => {
  it('lee 600 páginas sin trabar el evento y el índice cabe', async () => {
    const bytes = pdfDeClientesSinteticos(600)
    const entradas: EntradaDeIndice[] = []
    let ticks = 0
    const reloj = setInterval(() => {
      ticks += 1
    }, 20)

    const resumen = await correrImportacion({
      bytes,
      tipo: 'clientes',
      tamanoLote: 400,
      ceder: () =>
        new Promise((resolver) => {
          setTimeout(resolver, 0)
        }),
      persistirLote: (lote) => {
        for (const fila of lote) {
          entradas.push({
            numeroDocumento: fila.numeroDocumento,
            denominacion: fila.denominacion,
          })
        }
        return Promise.resolve({ nuevos: lote.length, yaExistian: 0 })
      },
    })

    clearInterval(reloj)
    const tamano = bytesDeIndice('clientes', entradas)

    expect(resumen).toEqual({ nuevos: 8400, yaExistian: 0, descartados: 0 })
    expect(entradas).toHaveLength(8400)
    expect(
      entradas.some((fila) => fila.denominacion.includes('VENDEDOR')),
    ).toBe(false)
    expect(ticks).toBeGreaterThan(0)
    expect(tamano).toBeGreaterThan(400_000)
    expect(tamano).toBeLessThan(1_048_576)
    console.info(`[padron] indice sintetico de 8400 clientes: ${tamano} bytes`)
  }, 120_000)
})
