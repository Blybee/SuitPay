import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import type { DocumentData } from 'firebase-admin/firestore'
import type { Existencia } from '../../domain/inventario/tipos.ts'
import {
  deltasDeVenta,
  estaEnAlerta,
  maximoAlFijar,
} from '../../domain/inventario/reglas.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'
import type { Comprobante } from '../emision/almacen.ts'
import type { AlmacenDeInventario, FijarExistencia } from './almacen.ts'

function aExistencia(codigo: string, datos: DocumentData): Existencia {
  const actualizadoEn = datos['actualizadoEn']
  return {
    codigo,
    cantidad: typeof datos['cantidad'] === 'number' ? datos['cantidad'] : 0,
    maximo: typeof datos['maximo'] === 'number' ? datos['maximo'] : 0,
    ...(typeof datos['umbral'] === 'number' ? { umbral: datos['umbral'] } : {}),
    alerta: datos['alerta'] === true,
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

export class AlmacenDeInventarioFirestore implements AlmacenDeInventario {
  constructor(private readonly base: Firestore = bd()) {}

  async leer(codigo: string): Promise<Existencia | null> {
    const snap = await this.base
      .collection(COLECCIONES.inventario)
      .doc(codigo)
      .get()
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
        batch.delete(this.base.collection(COLECCIONES.inventario).doc(codigo))
      }
      await batch.commit()
    }
  }

  async fijar(entrada: FijarExistencia): Promise<Existencia> {
    const ref = this.base.collection(COLECCIONES.inventario).doc(entrada.codigo)
    const previa = await this.leer(entrada.codigo)
    const maximo = maximoAlFijar(entrada.cantidad, previa?.maximo)
    const umbral = entrada.umbral ?? previa?.umbral
    const alerta = estaEnAlerta(entrada.cantidad, maximo, umbral)
    await ref.set({
      codigo: entrada.codigo,
      cantidad: entrada.cantidad,
      maximo,
      ...(umbral !== undefined ? { umbral } : {}),
      alerta,
      actualizadoPor: entrada.autorId,
      actualizadoEn: Timestamp.fromDate(entrada.momento),
    })
    return {
      codigo: entrada.codigo,
      cantidad: entrada.cantidad,
      maximo,
      ...(umbral !== undefined ? { umbral } : {}),
      alerta,
      actualizadoPor: entrada.autorId,
      actualizadoEn: entrada.momento,
    }
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
    const refs = [...deltas.keys()].map((codigo) =>
      this.base.collection(COLECCIONES.inventario).doc(codigo),
    )

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
        const codigo = snap.id
        const bruto = snap.data() ?? {}
        const delta = deltas.get(codigo) ?? 0
        const aplicado = sentido === 'venta' ? delta : -delta
        const cantidad =
          (typeof bruto['cantidad'] === 'number' ? bruto['cantidad'] : 0) +
          aplicado
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
