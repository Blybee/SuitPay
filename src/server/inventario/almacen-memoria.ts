import type { Existencia } from '../../domain/inventario/tipos.ts'
import { aplicarParcheDeInventario } from '../../domain/inventario/parche.ts'
import type { ParcheDeInventario } from '../../domain/inventario/parche.ts'
import { deltasDeVenta } from '../../domain/inventario/reglas.ts'
import type { AlmacenDeEmision, Comprobante } from '../emision/almacen.ts'
import type { AlmacenDeInventario, FijarExistencia } from './almacen.ts'

export class AlmacenDeInventarioMemoria implements AlmacenDeInventario {
  private readonly existencias = new Map<string, Existencia>()

  constructor(private readonly emision?: AlmacenDeEmision) {}

  sembrar(existencia: Existencia): void {
    this.existencias.set(existencia.codigo, existencia)
  }

  async leer(codigo: string): Promise<Existencia | null> {
    return this.existencias.get(codigo) ?? null
  }

  async borrar(codigos: readonly string[]): Promise<void> {
    for (const codigo of codigos) this.existencias.delete(codigo)
  }

  async fijar(entrada: FijarExistencia): Promise<Existencia> {
    return this.parchear({
      codigo: entrada.codigo,
      cantidad: entrada.cantidad,
      umbral: entrada.umbral,
      autorId: entrada.autorId,
      momento: entrada.momento,
    })
  }

  async parchear(entrada: ParcheDeInventario): Promise<Existencia> {
    const previa = this.existencias.get(entrada.codigo) ?? null
    const siguiente = aplicarParcheDeInventario(previa, entrada)
    this.existencias.set(entrada.codigo, siguiente)
    return siguiente
  }

  async listarAlertas(): Promise<readonly Existencia[]> {
    return [...this.existencias.values()]
      .filter((cada) => cada.alerta)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))
  }

  async aplicarVenta(comprobante: Comprobante): Promise<void> {
    if (comprobante.inventarioAplicado === true) return
    this.aplicarDeltas(deltasDeVenta(comprobante.lineas), comprobante.vendedorId)
    await this.marcar(comprobante.id, {
      inventarioAplicado: true,
      inventarioAplicadoPor: comprobante.id,
    })
  }

  async reintegrar(comprobante: Comprobante): Promise<void> {
    if (comprobante.inventarioRestaurado === true) return
    if (comprobante.inventarioAplicado !== true) return
    const invertidos = new Map<string, number>()
    for (const [codigo, delta] of deltasDeVenta(comprobante.lineas)) {
      invertidos.set(codigo, -delta)
    }
    this.aplicarDeltas(invertidos, comprobante.vendedorId)
    await this.marcar(comprobante.id, { inventarioRestaurado: true })
  }

  async heredarTitularidad(
    origen: Comprobante,
    guia: Comprobante,
  ): Promise<void> {
    if (origen.inventarioAplicado !== true) return
    await this.marcar(origen.id, { inventarioAplicadoPor: guia.id })
    await this.marcar(guia.id, {
      inventarioAplicado: true,
      inventarioAplicadoPor: guia.id,
    })
  }

  private aplicarDeltas(
    deltas: ReadonlyMap<string, number>,
    autorId: string,
  ): void {
    const momento = new Date()
    for (const [codigo, delta] of deltas) {
      const actual = this.existencias.get(codigo)
      if (actual === undefined || typeof actual.cantidad !== 'number') continue
      const siguiente = aplicarParcheDeInventario(actual, {
        codigo,
        cantidad: actual.cantidad + delta,
        autorId,
        momento,
      })
      this.existencias.set(codigo, siguiente)
    }
  }

  private async marcar(
    comprobanteId: string,
    flags: {
      inventarioAplicado?: boolean
      inventarioAplicadoPor?: string | null
      inventarioRestaurado?: boolean
    },
  ): Promise<void> {
    if (this.emision === undefined) return
    await this.emision.actualizarComprobante(comprobanteId, flags)
  }
}
