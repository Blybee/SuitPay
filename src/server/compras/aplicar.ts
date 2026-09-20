import type { CoincidenciaDeCompra } from '../../domain/compras/tipos.ts'
import type { AlmacenDeInventario } from '../inventario/almacen.ts'
import type { Existencia } from '../../domain/inventario/tipos.ts'

export async function aplicarPreciosCompra(entrada: {
  readonly coincidencias: readonly CoincidenciaDeCompra[]
  readonly autorId: string
  readonly momento: Date
  readonly inventario: AlmacenDeInventario
}): Promise<readonly Existencia[]> {
  const escritas: Existencia[] = []
  for (const fila of entrada.coincidencias) {
    const existencia = await entrada.inventario.parchear({
      codigo: fila.codigo,
      precioCompraCentimos: fila.precioCompraCentimos,
      precioCompraEn: fila.precioCompraEn ?? null,
      autorId: entrada.autorId,
      momento: entrada.momento,
    })
    escritas.push(existencia)
  }
  return escritas
}
