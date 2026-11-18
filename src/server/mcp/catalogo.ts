import type { Firestore } from 'firebase-admin/firestore'
import { buscarProductos, crearIndice } from '../../domain/busqueda/productos.ts'
import type { GradoDeCoincidencia } from '../../domain/busqueda/productos.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'
import { idDeDocumentoDeInventario } from '../inventario/id-documento.ts'

export interface ProductoHallado {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly precioCentimos: number
  readonly marca: string
  readonly grado: GradoDeCoincidencia
}

export interface ExistenciaConsultada {
  readonly codigo: string
  readonly cantidad: number | null
  readonly precioCompraCentimos: number | null
}

export async function buscarProductosPublicados(opciones: {
  readonly termino: string
  readonly limite: number
  readonly base?: Firestore
}): Promise<{ productos: ProductoHallado[]; lecturas: number }> {
  const base = opciones.base ?? bd()
  const instantanea = await base.collection(COLECCIONES.catalogo).doc('actual').get()
  const productos = instantanea.exists
    ? productosDe(instantanea.data()?.['productos'])
    : []
  const hallados = buscarProductos(crearIndice(productos), opciones.termino, opciones.limite)
  return {
    lecturas: 1,
    productos: hallados.coincidencias.map((coincidencia) => ({
      codigo: coincidencia.elemento.codigo,
      descripcion: coincidencia.elemento.descripcion,
      unidad: coincidencia.elemento.unidad,
      precioCentimos: coincidencia.elemento.precio,
      marca: coincidencia.elemento.marca ?? '',
      grado: coincidencia.grado,
    })),
  }
}

export async function consultarExistencias(opciones: {
  readonly codigos: readonly string[]
  readonly base?: Firestore
}): Promise<{ existencias: ExistenciaConsultada[]; lecturas: number }> {
  const base = opciones.base ?? bd()
  const existencias: ExistenciaConsultada[] = []
  for (const codigo of opciones.codigos) {
    const instantanea = await base
      .collection(COLECCIONES.inventario)
      .doc(idDeDocumentoDeInventario(codigo))
      .get()
    const datos = instantanea.data()
    existencias.push({
      codigo,
      cantidad: numeroONulo(datos?.['cantidad']),
      precioCompraCentimos: numeroONulo(datos?.['precioCompraCentimos']),
    })
  }
  return { existencias, lecturas: opciones.codigos.length }
}

function productosDe(bruto: unknown) {
  if (!Array.isArray(bruto)) return []
  return bruto.flatMap((entrada) => {
    if (typeof entrada !== 'object' || entrada === null) return []
    const fila = entrada as Record<string, unknown>
    if (
      typeof fila['codigo'] !== 'string' ||
      typeof fila['descripcion'] !== 'string' ||
      typeof fila['unidad'] !== 'string' ||
      typeof fila['precio'] !== 'number' ||
      typeof fila['activo'] !== 'boolean'
    ) {
      return []
    }
    return [
      {
        codigo: fila['codigo'],
        descripcion: fila['descripcion'],
        unidad: fila['unidad'],
        precio: fila['precio'],
        activo: fila['activo'],
        ...(typeof fila['marca'] === 'string' ? { marca: fila['marca'] } : {}),
      },
    ]
  })
}

function numeroONulo(valor: unknown): number | null {
  return typeof valor === 'number' ? valor : null
}
