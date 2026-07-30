/**
 * Publica el catálogo en Firestore cloud con la misma lógica que T081.
 *
 *   $env:GOOGLE_CLOUD_PROJECT="blayblocklabs-antrax"
 *   npx tsx scripts/publicar-catalogo.ts tmp/productos.js
 *
 * En el día a día: UI `/administracion/catalogo` (T082) con admin + Bearer.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { AlmacenDeCatalogoFirestore } from '../src/server/catalogo/almacen-firestore.ts'
import { importarCatalogo } from '../src/server/catalogo/importar.ts'

const archivo = process.argv[2] ?? 'tmp/productos.js'
process.env['GOOGLE_CLOUD_PROJECT'] ??=
  process.env['GCLOUD_PROJECT'] ?? 'blayblocklabs-antrax'

const contenido = await readFile(resolve(archivo), 'utf8')
const resumen = await importarCatalogo(new AlmacenDeCatalogoFirestore(), {
  contenido,
  formato: 'json_tienda',
  modo: 'publicar',
  administradorId: 'bootstrap-script',
})

console.log(
  JSON.stringify(
    {
      reconocidos: resumen.reconocidos,
      version: resumen.version,
      publicado: resumen.publicado,
      conflictos: resumen.conflictos.length,
    },
    null,
    2,
  ),
)
