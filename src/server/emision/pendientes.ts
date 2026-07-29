import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'
import { obligaAReconciliar } from '../proveedor/interfaz.ts'
import type { AlmacenDeEmision, Comprobante } from './almacen.ts'
import { idDeSerie } from './almacen.ts'
import {
  estadoSegunFallo,
  estadoSegunProveedor,
  sePuedeInvocarEmision,
  transicionPermitida,
  ventaEstaCerrada,
} from './estados.ts'

/**
 * `procesarPendientes`.
 *
 * Recorre las ventas que quedaron esperando porque el proveedor no respondía y
 * completa su emisión. Es seguro reintentar aquí, y conviene tener claro por qué:
 * `pendiente` significa que **consta que no se emitió nada**. No es el caso
 * indeterminado; es el caso en que la petición no llegó a salir.
 *
 * ## El detalle que cambia el tono de esta tarea
 *
 * Si al completar la emisión resulta un rechazo, el comprobante **no se queda en
 * `rechazado`**: pasa a `requiere_intervencion`. La diferencia importa porque el
 * cliente **ya se fue con la mercadería y con un documento interno en la mano**.
 * Un rechazo en el momento de la venta lo resuelve el vendedor corrigiendo y
 * volviendo a emitir con el cliente delante; un rechazo tres horas después, sin
 * nadie a quien preguntar, es un problema que necesita una persona. Dejarlo como
 * un rechazo más lo enterraría en una lista que nadie mira (FR-050b).
 *
 * El correlativo ya estaba consumido desde la venta, así que se reutiliza el mismo
 * número. No se pide otro: el que había quedó reservado precisamente para esto.
 */

export interface ResumenDePendientes {
  readonly revisados: number
  readonly emitidos: number
  readonly siguenPendientes: number
  readonly requierenIntervencion: number
  readonly indeterminados: number
}

export interface ContextoDePendientes {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly formatoImpresion: 'a4' | 'rollo'
  readonly limite?: number
  readonly ahora?: () => Date
}

const LIMITE_POR_OMISION = 50

export async function procesarPendientes(
  contexto: ContextoDePendientes,
): Promise<ResumenDePendientes> {
  const pendientes = await contexto.almacen.comprobantesEnEstado(
    'pendiente',
    contexto.limite ?? LIMITE_POR_OMISION,
  )

  let emitidos = 0
  let siguenPendientes = 0
  let requierenIntervencion = 0
  let indeterminados = 0

  for (const comprobante of pendientes) {
    const desenlace = await completarUno(contexto, comprobante)
    if (desenlace === 'emitido') emitidos++
    else if (desenlace === 'sigue_pendiente') siguenPendientes++
    else if (desenlace === 'intervencion') requierenIntervencion++
    else indeterminados++
  }

  return {
    revisados: pendientes.length,
    emitidos,
    siguenPendientes,
    requierenIntervencion,
    indeterminados,
  }
}

type Desenlace =
  | 'emitido'
  | 'sigue_pendiente'
  | 'intervencion'
  | 'indeterminado'

async function completarUno(
  contexto: ContextoDePendientes,
  comprobante: Comprobante,
): Promise<Desenlace> {
  const ahora = (contexto.ahora ?? (() => new Date()))()

  if (!sePuedeInvocarEmision(comprobante.estado)) {
    return 'sigue_pendiente'
  }

  const resultado = await contexto.proveedor.emitir({
    tipoDocumento: comprobante.tipoDocumento,
    serie: comprobante.serie,
    // El mismo número que se reservó en la venta. Pedir otro dejaría el primero
    // huérfano y abriría un hueco que no hace falta.
    numero: comprobante.numero,
    cliente:
      comprobante.cliente === null
        ? null
        : {
            tipoDocumento: comprobante.cliente.tipoDocumento,
            numeroDocumento: comprobante.cliente.numeroDocumento,
            denominacion: comprobante.cliente.denominacion,
            direccion: comprobante.cliente.direccion ?? undefined,
            ubigeo: undefined,
            correo: undefined,
          },
    lineas: comprobante.lineas,
    total: comprobante.total,
    condicionPago: {
      tipo: comprobante.condicionPago.tipo,
      fechaVencimiento: comprobante.condicionPago.fechaVencimiento ?? undefined,
    },
    formatoImpresion: contexto.formatoImpresion,
    // La fecha original de la venta, no la de ahora. El documento tiene que
    // llevar la fecha en que se cobró, que es la que el cliente tiene en su
    // documento interno.
    emitidoEn: comprobante.emitidoEn,
  })

  if (!resultado.ok) {
    const estado = estadoSegunFallo(resultado.fallo.clase)

    await contexto.almacen.actualizarComprobante(comprobante.id, {
      ...(transicionPermitida(comprobante.estado, estado)
        ? { estado }
        : {}),
      nuevoIntento: {
        momento: ahora,
        resultado: resultado.fallo.clase,
        razon: resultado.fallo.razon,
        rastro: resultado.fallo.rastro,
      },
    })

    if (obligaAReconciliar(resultado.fallo)) return 'indeterminado'
    if (estado === 'pendiente') return 'sigue_pendiente'

    // Rechazado con el cliente ya ido: a intervención, no a una lista de
    // rechazos que nadie mira.
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      estado: 'requiere_intervencion',
      nuevoIntento: {
        momento: ahora,
        resultado: 'rechazo_definitivo',
        razon: 'rechazado_con_mercaderia_entregada',
        rastro: null,
      },
    })
    return 'intervencion'
  }

  const emitido = resultado.valor
  const estado = estadoSegunProveedor(emitido.estado)

  if (!transicionPermitida(comprobante.estado, estado)) {
    return 'sigue_pendiente'
  }

  await contexto.almacen.actualizarComprobante(comprobante.id, {
    estado,
    numero: emitido.numero,
    proveedor: {
      nombre: contexto.proveedor.nombre,
      referenciaExterna: emitido.referenciaExterna ?? null,
      estadoInformado: emitido.estado,
      pdf: emitido.archivos.pdf ?? null,
      xml: emitido.archivos.xml ?? null,
      cdr: emitido.archivos.cdr ?? null,
    },
    nuevoIntento: {
      momento: ahora,
      resultado: 'exito',
      razon: 'completado_tras_espera',
      rastro: emitido.rastro,
    },
  })

  if (ventaEstaCerrada(estado) && comprobante.serie !== '') {
    await contexto.almacen.confirmarCorrelativo(
      idDeSerie(comprobante.vendedorId, comprobante.tipoDocumento),
      emitido.numero,
    )
  }

  // Si el rechazo llega aquí, el estado ya es `rechazado` y hay que escalarlo.
  if (estado === 'rechazado') {
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      estado: 'requiere_intervencion',
      nuevoIntento: {
        momento: ahora,
        resultado: 'rechazo_definitivo',
        razon: 'rechazado_con_mercaderia_entregada',
        rastro: null,
      },
    })
    return 'intervencion'
  }

  return 'emitido'
}
