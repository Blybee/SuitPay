import { describe, expect, it } from 'vitest'
import {
  codigoDesdeIdDeInventario,
  idDeDocumentoDeInventario,
} from '../../../src/server/inventario/id-documento.ts'

/**
 * Un SKU con fracción (`3/4`) no puede ir crudo a `CollectionReference.doc()`:
 * Firestore lo parte como ruta y el Admin SDK lanza documentPath.
 */

describe('id de documento de inventario', () => {
  it('un código sin barra queda igual, para no romper documentos ya publicados', () => {
    expect(idDeDocumentoDeInventario('ALEX-CRUC008')).toBe('ALEX-CRUC008')
  })

  it('escapa la barra de un SKU con fracción', () => {
    const id = idDeDocumentoDeInventario('TRIB-VACO3/4')
    expect(id.includes('/')).toBe(false)
    expect(id).toBe('TRIB-VACO3%2F4')
    expect(codigoDesdeIdDeInventario(id)).toBe('TRIB-VACO3/4')
  })

  it('escapa varias barras', () => {
    expect(idDeDocumentoDeInventario('X/1/2')).toBe('X%2F1%2F2')
    expect(codigoDesdeIdDeInventario('X%2F1%2F2')).toBe('X/1/2')
  })
})
