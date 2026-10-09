import type { EntradaDeIndice } from './tipos.ts'

/** Bajo el límite de 1 MiB de un documento Firestore. */
export const TECHO_INDICE_BYTES = 1_000_000

export function bytesDeIndice(
  campo: 'clientes' | 'transportistas',
  lista: readonly EntradaDeIndice[],
): number {
  return new TextEncoder().encode(
    JSON.stringify({ version: 1, [campo]: lista }),
  ).byteLength
}
