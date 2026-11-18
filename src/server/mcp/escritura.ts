import { FieldValue } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { calcularTotal } from '../../domain/totales/calculo.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { crearCliente } from '../clientes/crear.ts'
import type { PeticionDeCrearCliente } from '../clientes/crear.ts'
import { AlmacenFirestore } from '../emision/almacen-firestore.ts'
import { consultarEstadoEmision } from '../emision/consultar-estado.ts'
import type { ResultadoDeConsultaDeEstado } from '../emision/consultar-estado.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'
import { proveedorActual } from '../proveedor/actual.ts'
import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'

export interface LineaPedida {
  readonly codigo: string
  readonly cantidad: number
  readonly precio?: number
}

export interface CotizacionCreada {
  readonly id: string
  readonly numero: number
  readonly total: number
  readonly yaExistia: boolean
}

export async function crearCotizacion(opciones: {
  readonly clave: string
  readonly lineas: readonly LineaPedida[]
  readonly cliente: PeticionDeCrearCliente | null
  readonly uid: string
  readonly base?: Firestore
}): Promise<CotizacionCreada> {
  const base = opciones.base ?? bd()
  const referencia = base.collection(COLECCIONES.cotizaciones).doc(opciones.clave)
  const [coleccionContador, idContador] = DOCUMENTOS.contadorCotizaciones.split('/')
  const contador = base
    .collection(coleccionContador ?? 'config')
    .doc(idContador ?? 'contadorCotizaciones')

  return base.runTransaction(async (tx) => {
    const previa = await tx.get(referencia)
    if (previa.exists) {
      const datos = previa.data() ?? {}
      return {
        id: opciones.clave,
        numero: numero(datos['numero']),
        total: numero(datos['total']),
        yaExistia: true,
      }
    }

    const catalogo = await tx.get(base.collection(COLECCIONES.catalogo).doc('actual'))
    const lineas = lineasDesdeCatalogo(opciones.lineas, catalogo.data()?.['productos'])
    const total = calcularTotal(lineas)
    const marca = await tx.get(contador)
    const ultimo = numero(marca.data()?.['ultimoNumero'])
    const siguiente = ultimo + 1
    tx.set(
      contador,
      { ultimoNumero: siguiente, actualizadoEn: FieldValue.serverTimestamp() },
      { merge: true },
    )
    tx.set(referencia, {
      numero: siguiente,
      estado: 'pendiente',
      canal: 'general',
      cliente: opciones.cliente,
      lineas,
      total,
      generacionPedido: 0,
      creadoPor: opciones.uid,
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    return { id: opciones.clave, numero: siguiente, total, yaExistia: false }
  })
}

export async function registrarCliente(
  peticion: PeticionDeCrearCliente,
  uid: string,
) {
  return crearCliente(peticion, uid)
}

export async function consultarEstadoSunat(opciones: {
  readonly id: string
  readonly proveedor?: ProveedorDeEmision
  readonly base?: Firestore
}): Promise<ResultadoDeConsultaDeEstado> {
  const almacen = new AlmacenFirestore(opciones.base ?? bd())
  return consultarEstadoEmision(
    { almacen, proveedor: proveedorQueSoloConsulta(opciones.proveedor ?? proveedorActual()) },
    opciones.id,
  )
}

export function proveedorQueSoloConsulta(
  interno: ProveedorDeEmision,
  emisiones: { n: number } = { n: 0 },
): ProveedorDeEmision {
  const prohibido = async () => {
    emisiones.n += 1
    throw new Error('el MCP no emite')
  }
  return {
    nombre: 'consulta',
    emitir: prohibido,
    emitirGuiaRemision: prohibido,
    anular: prohibido,
    emitirNotaCredito: prohibido,
    crearEstablecimiento: prohibido,
    listarEstablecimientos: prohibido,
    eliminarEstablecimiento: prohibido,
    crearSerie: prohibido,
    eliminarSerie: prohibido,
    consultarContribuyente: prohibido,
    consultarDocumento: (peticion) => interno.consultarDocumento(peticion),
  }
}

function lineasDesdeCatalogo(
  pedidas: readonly LineaPedida[],
  bruto: unknown,
): LineaDePedido[] {
  const porCodigo = new Map<string, { descripcion: string; unidad: string; precio: number }>()
  if (Array.isArray(bruto)) {
    for (const entrada of bruto) {
      if (typeof entrada !== 'object' || entrada === null) continue
      const fila = entrada as Record<string, unknown>
      if (
        typeof fila['codigo'] !== 'string' ||
        typeof fila['descripcion'] !== 'string' ||
        typeof fila['unidad'] !== 'string' ||
        typeof fila['precio'] !== 'number' ||
        fila['activo'] === false
      ) {
        continue
      }
      porCodigo.set(fila['codigo'], {
        descripcion: fila['descripcion'],
        unidad: fila['unidad'],
        precio: fila['precio'],
      })
    }
  }
  return pedidas.map((pedida) => {
    const producto = porCodigo.get(pedida.codigo)
    if (producto === undefined) {
      throw new Error(`Producto ausente en el catálogo: ${pedida.codigo}`)
    }
    return {
      codigo: pedida.codigo,
      descripcion: producto.descripcion,
      unidad: producto.unidad,
      cantidad: pedida.cantidad,
      precio: producto.precio,
    }
  })
}

function numero(valor: unknown): number {
  return typeof valor === 'number' ? valor : 0
}
