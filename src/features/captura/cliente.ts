import type { ClienteEnIndice } from '../../infra/local/catalogo.ts'

/**
 * Resuelve la identidad del cliente en el cliente (T126 / FR-045).
 * Nunca envía la base de clientes al modelo.
 */

const PATRON_MENCION =
  /\b(?:para|cliente|factura(?:r)?(?:\s+a)?|boleta(?:r)?(?:\s+a)?)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ0-9][\wÁÉÍÓÚáéíóúÑñ .,&-]{2,60})/i

export function extraerMencionDeCliente(
  textos: readonly string[],
): string | null {
  for (const texto of textos) {
    const m = PATRON_MENCION.exec(texto)
    if (m?.[1]) {
      const nombre = m[1].trim().replace(/[.,;]+$/, '')
      if (nombre.length >= 3) return nombre
    }
  }
  return null
}

export function resolverClienteLocal(
  mencion: string,
  indice: readonly ClienteEnIndice[],
): ClienteEnIndice | null {
  const normalizado = mencion.trim().toLowerCase()
  if (normalizado === '') return null

  const exacto = indice.find(
    (c) => c.denominacion.trim().toLowerCase() === normalizado,
  )
  if (exacto) return exacto

  const parciales = indice.filter((c) =>
    c.denominacion.toLowerCase().includes(normalizado),
  )
  if (parciales.length === 1) return parciales[0]!
  return null
}
