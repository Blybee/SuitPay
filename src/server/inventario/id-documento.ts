/**
 * Id de documento `inventario/{id}` a partir del SKU.
 *
 * Firestore interpreta `/` en `CollectionReference.doc()` como separador de
 * ruta, no como carácter del id. Un código como `TRIB-VACO3/4` deja de ser un
 * documento (`inventario/TRIB-VACO3/4` es una colección) y el Admin SDK lanza
 * «documentPath must point to a document». El campo `codigo` del documento
 * conserva el SKU original; aquí solo se sustituye `/` → `%2F`.
 */

export function idDeDocumentoDeInventario(codigo: string): string {
  return codigo.replace(/\//g, '%2F')
}

export function codigoDesdeIdDeInventario(id: string): string {
  return id.replace(/%2F/g, '/')
}
