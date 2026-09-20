import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData, Firestore } from 'firebase-admin/firestore'
import type { Existencia } from '../../domain/inventario/tipos.ts'
import { aplicarParcheDeInventario } from '../../domain/inventario/parche.ts'
import type { ParcheDeInventario } from '../../domain/inventario/parche.ts'
import { deltasDeVenta, estaEnAlerta } from '../../domain/inventario/reglas.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'
import type { Comprobante } from '../emision/almacen.ts'
import type { AlmacenDeInventario, FijarExistencia } from './almacen.ts'
import {
  codigoDesdeIdDeInventario,
  idDeDocumentoDeInventario,
} from './id-documento.ts'

function aExistencia(id: string, datos: DocumentData): Existencia {
  const delCampo =
    typeof datos['codigo'] === 'string' ? datos['codigo'].trim() : ''
  const codigo =
    delCampo.length > 0 ? delCampo : codigoDesdeIdDeInventario(id)
  const actualizadoEn = datos['actualizadoEn']
  const cantidad =
    typeof datos['cantidad'] === 'number' ? datos['cantidad'] : undefined
  const precioCompraCentimos =
    typeof datos['precioCompraCentimos'] === 'number'
      ? datos['precioCompraCentimos']
      : undefined
  const precioCompraEn =
    typeof datos['precioCompraEn'] === 'string' &&
    datos['precioCompraEn'].trim() !== ''
      ? datos['precioCompraEn'].trim()
      : undefined
  return {
    codigo,
    ...(cantidad !== undefined ? { cantidad } : {}),
    maximo: typeof datos['maximo'] === 'number' ? datos['maximo'] : 0,
    ...(typeof datos['umbral'] === 'number' ? { umbral: datos['umbral'] } : {}),
    alerta: datos['alerta'] === true,
    ...(precioCompraCentimos !== undefined ? { precioCompraCentimos } : {}),
    ...(precioCompraEn !== undefined ? { precioCompraEn } : {}),
    actualizadoPor:
      typeof datos['actualizadoPor'] === 'string'
        ? datos['actualizadoPor']
        : '',
    actualizadoEn:
      actualizadoEn instanceof Timestamp
        ? actualizadoEn.toDate()
        : new Date(0),
  }
}

function payloadDeExistencia(
  previa: Existencia | null,
  siguiente: Existencia,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    codigo: siguiente.codigo,
    maximo: siguiente.maximo,
    alerta: siguiente.alerta,
    actualizadoPor: siguiente.actualizadoPor,
    actualizadoEn: Timestamp.fromDate(siguiente.actualizadoEn),
  }
  if (typeof siguiente.cantidad === 'number') {
    payload['cantidad'] = siguiente.cantidad
  } else if (previa !== null && typeof previa.cantidad === 'number') {
    payload['cantidad'] = FieldValue.delete()
  }
  if (siguiente.umbral !== undefined) {
    payload['umbral'] = siguiente.umbral
  }
  if (siguiente.precioCompraCentimos !== undefined) {
    payload['precioCompraCentimos'] = siguiente.precioCompraCentimos
  } else if (previa?.precioCompraCentimos !== undefined) {
    payload['precioCompraCentimos'] = FieldValue.delete()
  }
  if (siguiente.precioCompraEn !== undefined) {
    payload['precioCompraEn'] = siguiente.precioCompraEn
  } else if (previa?.precioCompraEn !== undefined) {
    payload['precioCompraEn'] = FieldValue.delete()
  }
  return payload
}

export class AlmacenDeInventarioFirestore implements AlmacenDeInventario {
  constructor(private readonly base: Firestore = bd()) {}

  private ref(codigo: string) {
    return this.base
      .collection(COLECCIONES.inventario)
      .doc(idDeDocumentoDeInventario(codigo))
  }

  async leer(codigo: string): Promise<Existencia | null> {
    const snap = await this.ref(codigo).get()
    if (!snap.exists) return null
    return aExistencia(codigo, snap.data() ?? {})
  }

  async borrar(codigos: readonly string[]): Promise<void> {
    const unicos = [...new Set(codigos.filter((codigo) => codigo.length > 0))]
    const TAMANO = 400
    for (let i = 0; i < unicos.length; i += TAMANO) {
      const lote = unicos.slice(i, i + TAMANO)
      const batch = this.base.batch()
      for (const codigo of lote) {
        batch.delete(this.ref(codigo))
      }
      await batch.commit()
    }
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
    const ref = this.ref(entrada.codigo)
    const previa = await this.leer(entrada.codigo)
    const siguiente = aplicarParcheDeInventario(previa, entrada)
    await ref.set(payloadDeExistencia(previa, siguiente), { merge: true })
    return siguiente
  }

  async listarAlertas(): Promise<readonly Existencia[]> {
    const snap = await this.base
      .collection(COLECCIONES.inventario)
      .where('alerta', '==', true)
      .get()
    return snap.docs.map((doc) => aExistencia(doc.id, doc.data()))
  }

  async aplicarVenta(comprobante: Comprobante): Promise<void> {
    await this.mover(comprobante, 'venta')
  }

  async reintegrar(comprobante: Comprobante): Promise<void> {
    await this.mover(comprobante, 'reintegro')
  }

  async heredarTitularidad(
    origen: Comprobante,
    guia: Comprobante,
  ): Promise<void> {
    const origenRef = this.base
      .collection(COLECCIONES.comprobantes)
      .doc(origen.id)
    const guiaRef = this.base.collection(COLECCIONES.comprobantes).doc(guia.id)
    await this.base.runTransaction(async (tx) => {
      const origenSnap = await tx.get(origenRef)
      if (!origenSnap.exists) return
      if (origenSnap.data()?.['inventarioAplicado'] !== true) return
      tx.update(origenRef, { inventarioAplicadoPor: guia.id })
      tx.update(guiaRef, {
        inventarioAplicado: true,
        inventarioAplicadoPor: guia.id,
      })
    })
  }

  private async mover(
    comprobante: Comprobante,
    sentido: 'venta' | 'reintegro',
  ): Promise<void> {
    const compRef = this.base
      .collection(COLECCIONES.comprobantes)
      .doc(comprobante.id)
    const deltas = deltasDeVenta(comprobante.lineas)
    const refs = [...deltas.keys()].map((codigo) => this.ref(codigo))

    await this.base.runTransaction(async (tx) => {
      const compSnap = await tx.get(compRef)
      if (!compSnap.exists) return
      const datos = compSnap.data() ?? {}
      if (sentido === 'venta' && datos['inventarioAplicado'] === true) return
      if (sentido === 'reintegro') {
        if (datos['inventarioRestaurado'] === true) return
        if (datos['inventarioAplicado'] !== true) return
      }

      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)))
      const momento = FieldValue.serverTimestamp()
      for (const snap of snaps) {
        if (!snap.exists) continue
        const bruto = snap.data() ?? {}
        if (typeof bruto['cantidad'] !== 'number') continue
        const codigo = aExistencia(snap.id, bruto).codigo
        const delta = deltas.get(codigo) ?? 0
        const aplicado = sentido === 'venta' ? delta : -delta
        const cantidad = bruto['cantidad'] + aplicado
        const maximo =
          typeof bruto['maximo'] === 'number' ? bruto['maximo'] : cantidad
        const umbral =
          typeof bruto['umbral'] === 'number' ? bruto['umbral'] : undefined
        tx.update(snap.ref, {
          cantidad,
          alerta: estaEnAlerta(cantidad, maximo, umbral),
          actualizadoPor: comprobante.vendedorId,
          actualizadoEn: momento,
        })
      }

      if (sentido === 'venta') {
        tx.update(compRef, {
          inventarioAplicado: true,
          inventarioAplicadoPor: comprobante.id,
        })
      } else {
        tx.update(compRef, { inventarioRestaurado: true })
      }
    })
  }
}
