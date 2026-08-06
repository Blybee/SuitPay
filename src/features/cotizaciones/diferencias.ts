import type { ProductoBuscable } from '../../domain/busqueda/productos.ts'
import type { LineaDeCotizacion } from './tipos.ts'

/**
 * Compara las líneas de una cotización contra el catálogo en caché (FR-018).
 * Cero lecturas adicionales: el catálogo ya está en el dispositivo.
 */

export type ClaseDeDiferencia = 'precio_cambiado' | 'producto_desaparecido'

export interface DiferenciaDeCotizacion {
  readonly indice: number
  readonly codigo: string
  readonly descripcion: string
  readonly clase: ClaseDeDiferencia
  readonly precioGuardado: number
  readonly precioActual: number | null
}

export function diferenciasContraCatalogo(
  lineas: readonly LineaDeCotizacion[],
  productoPorCodigo: (codigo: string) => ProductoBuscable | undefined,
): readonly DiferenciaDeCotizacion[] {
  const resultado: DiferenciaDeCotizacion[] = []

  for (const [indice, linea] of lineas.entries()) {
    const producto = productoPorCodigo(linea.codigo)
    if (producto === undefined || !producto.activo) {
      resultado.push({
        indice,
        codigo: linea.codigo,
        descripcion: linea.descripcion,
        clase: 'producto_desaparecido',
        precioGuardado: linea.precio,
        precioActual: null,
      })
      continue
    }
    if (producto.precio !== linea.precio) {
      resultado.push({
        indice,
        codigo: linea.codigo,
        descripcion: linea.descripcion,
        clase: 'precio_cambiado',
        precioGuardado: linea.precio,
        precioActual: producto.precio,
      })
    }
  }

  return resultado
}
