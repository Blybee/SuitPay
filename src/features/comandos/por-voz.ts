import { reconocer } from './reconocer.ts'
import type { ResultadoDeReconocer } from './reconocer.ts'

/**
 * Comandos hablados (T151). Misma frontera: consultas sí; escritura de
 * comprobantes no. Las plantillas `/audio:` no emiten.
 */
const FRASES: readonly { readonly patron: RegExp; readonly aComando: (m: RegExpExecArray) => string }[] =
  [
    {
      patron: /(?:ultimos|últimos)\s+comprobantes(?:\s+de)?\s+(\d{8,11})/i,
      aComando: (m) => `/cliente ${m[1]}`,
    },
    {
      patron: /cotizaci[oó]n\s+(\d+)/i,
      aComando: (m) => `/cotizacion ${m[1]}`,
    },
    {
      patron: /\bayuda\b/i,
      aComando: () => '/ayuda',
    },
  ]

export function comandoDesdeDictado(texto: string): string | null {
  const recortado = texto.trim()
  if (recortado.startsWith('/')) return recortado
  for (const frase of FRASES) {
    const coincidencia = frase.patron.exec(recortado)
    if (coincidencia !== null) return frase.aComando(coincidencia)
  }
  return null
}

export function reconocerDictado(texto: string): ResultadoDeReconocer | null {
  const comando = comandoDesdeDictado(texto)
  if (comando === null) return reconocer(texto)
  return reconocer(comando)
}
