/**
 * Compara 4 pedidos sintéticos, sin datos de cliente, en OpenRouter y en Gemini.
 * Manual. No entra en CI. No imprime secretos.
 *
 *   node --experimental-strip-types scripts/comparar-ia.ts
 */

import { SCHEMA_RESPUESTA_ASISTENCIA } from '../src/server/asistencia/prompts.ts'
import { llamarGeminiConPartes } from '../src/server/asistencia/cliente-modelo.ts'
import { llamarOpenRouter } from '../src/server/ia/openrouter.ts'
import { modelosVisibles } from '../src/server/ia/modelos.ts'

const CATALOGO = [
  { id: 'COD-90-12', n: 'CODO PVC 90 GRADOS 1/2', m: 'Pavco' },
  { id: 'TUB-PVC-12', n: 'TUBO PVC 1/2 PULGADA X 3M', m: 'Pavco' },
  { id: 'PEG-250', n: 'PEGAMENTO PVC 250 ML', m: '' },
]

const CASOS = [
  { id: 'codo', texto: '12 codo pvc de 1/2' },
  { id: 'tubo', texto: '3 tubos pvc de 3 metros' },
  { id: 'pega', texto: '1 pegamento pvc de 250 ml' },
  { id: 'mixto', texto: '6 codo de 90 de media y 2 tubos de 3 m' },
]

function promptDe(texto: string): string {
  return [
    'Eres el mostrador de una ferretería. Elige códigos solo de este catálogo.',
    JSON.stringify(CATALOGO),
    `Pedido: ${texto}`,
    'Devuelve JSON con ilegible y items (textoOriginal, codigo, cantidad, unidad, confidence).',
  ].join('\n')
}

function resumen(json: unknown): string {
  if (json === null || typeof json !== 'object') return 'sin json'
  const items = (json as { items?: unknown }).items
  if (!Array.isArray(items) || items.length === 0) return 'sin ítems'
  return items
    .map((item) => {
      if (item === null || typeof item !== 'object') return '?'
      const fila = item as { codigo?: unknown; cantidad?: unknown }
      const codigo = typeof fila.codigo === 'string' ? fila.codigo : '?'
      const cantidad = typeof fila.cantidad === 'number' ? fila.cantidad : '?'
      return `${codigo} x${cantidad}`
    })
    .join(', ')
}

async function main(): Promise<void> {
  const modelos = modelosVisibles()
  const claveOpen = process.env.OPENROUTER_API_KEY?.trim()
  const claveGemini = process.env.ASISTENCIA_CLAVE_PRIMARIA?.trim()
  const filas: string[] = ['| caso | OpenRouter | Gemini |', '| --- | --- | --- |']

  for (const caso of CASOS) {
    const partes = [{ text: promptDe(caso.texto) }]
    let abierto = 'sin OPENROUTER_API_KEY'
    if (claveOpen) {
      const resultado = await llamarOpenRouter({
        modelo: modelos.openrouterTexto,
        partes,
        schema: SCHEMA_RESPUESTA_ASISTENCIA,
        nombres: [],
        clave: claveOpen,
        fetchFn: fetch,
        timeoutMs: 45_000,
      })
      abierto = resultado.ok ? resumen(resultado.json) : `falló ${resultado.motivo}`
    }
    let gemini = 'sin ASISTENCIA_CLAVE_PRIMARIA'
    if (claveGemini) {
      try {
        const json = await llamarGeminiConPartes({
          partes,
          schema: SCHEMA_RESPUESTA_ASISTENCIA,
          deps: {
            clavePrimaria: claveGemini,
            modelo: modelos.geminiPrincipal,
            modeloRespaldo: null,
            timeoutMs: 45_000,
          },
        })
        gemini = resumen(json)
      } catch {
        gemini = 'falló'
      }
    }
    filas.push(`| ${caso.id} | ${abierto} | ${gemini} |`)
  }

  console.log(filas.join('\n'))
}

await main()
