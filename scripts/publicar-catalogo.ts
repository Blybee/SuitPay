/**
 * Publica un export JSON de la tienda virtual en Firestore cloud
 * (misma lógica que T081, formato `json_tienda`).
 *
 *   $env:GOOGLE_CLOUD_PROJECT="blayblocklabs-antrax"
 *   npx tsx scripts/publicar-catalogo.ts ruta/al/export.json
 *
 * El catálogo vivo se carga en `/administracion/catalogo` desde el PDF de
 * lista de precios. Este CLI no tiene archivo por omisión: hay que pasar
 * la ruta. No sustituye la importación oficial.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { AlmacenDeCatalogoFirestore } from '../src/server/catalogo/almacen-firestore.ts'
import { importarCatalogo } from '../src/server/catalogo/importar.ts'

const archivo = process.argv[2]
if (archivo === undefined || archivo.trim().length === 0) {
  console.error(
    'Uso: npx tsx scripts/publicar-catalogo.ts <ruta-json-tienda>\n' +
      'El catálogo vivo se publica en /administracion/catalogo (PDF).',
  )
  process.exit(1)
}

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
