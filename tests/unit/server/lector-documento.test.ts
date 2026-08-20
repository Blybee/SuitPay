import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importarCatalogo } from '../../../src/server/catalogo/importar.ts'
import { AlmacenDeCatalogoEnMemoria } from '../../../src/server/catalogo/almacen-memoria.ts'
import {
  bytesDesdeBase64,
  interpretarDocumentoDeCatalogo,
  mapearUnidadDeLista,
  precioListaACentimos,
} from '../../../src/server/catalogo/lector-documento.ts'

const pdf = readFileSync(resolve('docs/LISTAS.pdf'))

describe('mapearUnidadDeLista y precio', () => {
  it('UND → NIU, PAQUT → BX; desconocidas se conservan', () => {
    expect(mapearUnidadDeLista('UND')).toBe('NIU')
    expect(mapearUnidadDeLista('PAQUT')).toBe('BX')
    expect(mapearUnidadDeLista('JUEGO')).toBe('JUEGO')
    expect(mapearUnidadDeLista('KIT')).toBe('KIT')
    expect(mapearUnidadDeLista('MIL')).toBe('MIL')
  })

  it('convierte 12.5000 soles a 1250 céntimos', () => {
    expect(precioListaACentimos('12.5000')).toBe(1250)
    expect(precioListaACentimos('3.8000')).toBe(380)
    expect(precioListaACentimos('no-es-precio')).toBe(0)
  })

  it('interpreta el mismo PDF desde base64', async () => {
    const deNuevo = await interpretarDocumentoDeCatalogo(
      bytesDesdeBase64(pdf.toString('base64')),
    )
    expect(deNuevo.filas.some((p) => p.codigo === 'ALLEN01')).toBe(true)
  }, 30_000)
})

describe('interpretarDocumentoDeCatalogo', () => {
  it(
    'reconoce filas CODIGO/PRODUCTO/U.M./PRECIO y omite cabeceras LINEA/TIPO',
    async () => {
      const resultado = await interpretarDocumentoDeCatalogo(new Uint8Array(pdf))
      expect(resultado.filas.length).toBeGreaterThan(1000)
      expect(resultado.omitidos).toBeGreaterThan(0)

      const allen = resultado.filas.find((p) => p.codigo === 'ALLEN01')
      expect(allen).toMatchObject({
        descripcion: 'LLAVE ALLEN',
        unidad: 'NIU',
        precio: 1250,
        activo: true,
        marca: 'AB',
      })

      expect(
        resultado.filas.some(
          (p) =>
            p.codigo.startsWith('LINEA') ||
            p.codigo.startsWith('TIPO') ||
            p.descripcion.startsWith('LINEA:') ||
            p.descripcion.startsWith('TIPO:'),
        ),
      ).toBe(false)
    },
    30_000,
  )

  it(
    'mapea PAQUT a BX y deja JUEGO para corrección inline',
    async () => {
      const resultado = await interpretarDocumentoDeCatalogo(new Uint8Array(pdf))
      const paquete = resultado.filas.find((p) => p.codigo === 'ALEX-CRUC006')
      expect(paquete?.unidad).toBe('BX')
      const juego = resultado.filas.find((p) => p.codigo === 'AMER-JUAC001')
      expect(juego?.unidad).toBe('JUEGO')
    },
    30_000,
  )
})

describe('T200 marca desde LINEA al publicar', () => {
  it(
    'productos_revisados persiste la marca extraída de LINEA',
    async () => {
      const { filas } = await interpretarDocumentoDeCatalogo(new Uint8Array(pdf))
      const allen = filas.find((p) => p.codigo === 'ALLEN01')
      expect(allen?.marca).toBe('AB')

      const almacen = new AlmacenDeCatalogoEnMemoria()
      await importarCatalogo(almacen, {
        contenido: JSON.stringify({
          productos: [allen],
          categorias: [],
        }),
        formato: 'productos_revisados',
        modo: 'publicar',
        administradorId: 'admin-1',
      })

      const publicado = await almacen.leerPublicado()
      expect(publicado?.productos[0]).toMatchObject({
        codigo: 'ALLEN01',
        marca: 'AB',
        precio: 1250,
      })
    },
    30_000,
  )
})
