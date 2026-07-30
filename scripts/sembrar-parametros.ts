/**
 * Escribe config/parametros por defecto (umbral 700 soles).
 *
 *   $env:GOOGLE_CLOUD_PROJECT="blayblocklabs-antrax"
 *   npx tsx scripts/sembrar-parametros.ts
 */

import { guardarParametros } from '../src/server/parametros/gestionar.ts'

process.env['GOOGLE_CLOUD_PROJECT'] ??=
  process.env['GCLOUD_PROJECT'] ?? 'blayblocklabs-antrax'

const parametros = await guardarParametros({
  umbralIdentificacionBoleta: 70_000,
  ventanaAnulacion: 'mismo_dia',
  formatoImpresionPorDefecto: 'a4',
})

console.log(JSON.stringify(parametros, null, 2))
