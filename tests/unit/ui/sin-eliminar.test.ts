import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * T100 — FR-039: la palabra "eliminar" no aparece referida a un comprobante
 * en etiquetas, mensajes ni textos de ayuda de la interfaz.
 *
 * Se recorren cadenas de UI (features de emisión, rutas de comprobantes y
 * componentes de marca/estado). Se permiten usos inocuos ajenos a comprobantes
 * (p. ej. "eliminarEstablecimiento" en el adaptador del proveedor, fuera de UI).
 */

const RAICES = [
  'src/features/emision',
  'src/routes/comprobantes',
  'src/ui/componentes/Sello.tsx',
  'src/server/errores.ts',
] as const

const PATRON = /elimin/i

async function listarArchivos(entrada: string): Promise<string[]> {
  const absoluto = path.join(process.cwd(), entrada)
  try {
    const estadistica = await import('node:fs/promises').then((fs) =>
      fs.stat(absoluto),
    )
    if (estadistica.isFile()) return [absoluto]
  } catch {
    return []
  }

  const encontrados: string[] = []
  async function recorrer(dir: string): Promise<void> {
    const entradas = await readdir(dir, { withFileTypes: true })
    for (const cada of entradas) {
      const completo = path.join(dir, cada.name)
      if (cada.isDirectory()) await recorrer(completo)
      else if (/\.(tsx?|jsx?)$/.test(cada.name)) encontrados.push(completo)
    }
  }
  await recorrer(absoluto)
  return encontrados
}

describe('vocabulario: sin «eliminar» referido a comprobantes', () => {
  it('no hay «elimin» en textos de UI/errores de emisión y anulación', async () => {
    const archivos = (
      await Promise.all(RAICES.map((raiz) => listarArchivos(raiz)))
    ).flat()

    expect(archivos.length).toBeGreaterThan(0)

    const infracciones: string[] = []
    for (const archivo of archivos) {
      const texto = await readFile(archivo, 'utf8')
      const lineas = texto.split('\n')
      lineas.forEach((linea, indice) => {
        // Comentarios que documentan la prohibición (FR-039) están permitidos.
        if (
          /^\s*(\/\/|\*|\/\*)/.test(linea) &&
          /elimin|FR-039|anula/i.test(linea)
        ) {
          return
        }
        if (PATRON.test(linea)) {
          infracciones.push(
            `${path.relative(process.cwd(), archivo)}:${indice + 1}: ${linea.trim()}`,
          )
        }
      })
    }

    expect(infracciones).toEqual([])
  })
})
