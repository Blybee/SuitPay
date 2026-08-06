import {
  calcularLineas,
  calcularTotal,
  pedidoEsEmitible
  
} from '../../domain/totales/calculo.ts'
import type {Centimos} from '../../domain/totales/calculo.ts';
import { evaluarIdentificacionDelComprador } from '../../domain/documentos/umbral.ts'
import { REGLAS  } from '../../domain/documentos/tipos.ts'
import type {TipoDeDocumento} from '../../domain/documentos/tipos.ts';
import { fallar } from '../errores.ts'
import {
  obligaAReconciliar
  
} from '../proveedor/interfaz.ts'
import type {ProveedorDeEmision} from '../proveedor/interfaz.ts';
import type {
  AlmacenDeEmision,
  Comprobante,
  DatosDelProveedor,
  IntentoDeEmision,
  LineaDelComprobante,
} from './almacen.ts'
import { idDeSerie } from './almacen.ts'
import {
  estadoSegunFallo,
  estadoSegunProveedor,
  exigirTransicion,
  sePuedeInvocarEmision,
  ventaEstaCerrada,
} from './estados.ts'
import { necesitaCorrelativoRegulado, reclamarCorrelativo } from './series.ts'

/**
 * `emitirComprobante`: el único camino por el que nace un comprobante.
 *
 * ## El orden de los pasos ES la garantía
 *
 * Esto no es una lista de tareas intercambiables. El orden es lo que hace
 * imposible el comprobante duplicado, y cada paso está donde está por una razón:
 *
 * 1. **Validar y recalcular.** El total lo decide el servidor. Un cliente puede
 *    estar en una pestaña vieja, con un catálogo de la semana pasada o con el
 *    reloj mal.
 * 2. **Comprobar el umbral.** Antes de tocar la serie, porque es un rechazo que
 *    el vendedor puede resolver pidiendo el documento al cliente, y sería absurdo
 *    quemar un correlativo por ello.
 * 3. **Transacción**: buscar la clave; si el comprobante ya existe y no está
 *    `pendiente`, devolver su estado sin emitir; si está `pendiente`, permitir
 *    reintento manual; si no existe, consumir el correlativo y crear en
 *    `reclamado`.
 * 4. **Solo entonces**, invocar al proveedor.
 * 5. Actualizar el estado y anotar el intento en la traza.
 *
 * La pieza crítica es que **el documento existe antes de la llamada de red**. Si
 * se creara después, una llamada que se corta dejaría el sistema sin rastro de que
 * se intentó emitir, y el reintento inevitable produciría el duplicado. Creándolo
 * antes, cualquier reintento con la misma clave encuentra el documento y se
 * detiene.
 *
 * Y al proveedor se le llama **fuera** de la transacción. Mantenerla abierta
 * durante una llamada de red la haría durar segundos y bloquearía la serie del
 * vendedor mientras tanto.
 */

export interface LineaPedida {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly cantidad: number
  readonly precio: Centimos
}

export interface PeticionDeEmitir {
  readonly claveIdempotencia: string
  readonly tipoDocumento: TipoDeDocumento
  readonly cliente: {
    readonly tipoDocumento: string
    readonly numeroDocumento: string
    readonly denominacion: string
    readonly direccion?: string
  } | null
  readonly lineas: readonly LineaPedida[]
  readonly condicionPago: {
    readonly tipo: 'contado' | 'credito'
    readonly fechaVencimiento?: string
  }
  readonly medioPago: {
    readonly medio: string
    readonly montoRecibido: Centimos
  } | null
  readonly cotizacionId: string | null
  readonly capturaId: string | null
  /** El total que calculó el cliente. Solo para comparar; manda el servidor. */
  readonly totalDeclarado?: Centimos
}

export interface RespuestaDeEmitir {
  readonly comprobanteId: string
  readonly estado: Comprobante['estado']
  readonly serie: string
  readonly numero: number | null
  readonly total: Centimos
  readonly archivos: {
    readonly pdf: string | null
    readonly xml: string | null
    readonly cdr: string | null
  }
  /**
   * Verdadero cuando la llamada fue un reintento que no emitió nada nuevo. Es lo
   * que permite a la interfaz decir "ya estaba emitido" en lugar de "emitido",
   * que no es lo mismo para quien está cobrando.
   */
  readonly yaExistia: boolean
  /** El total recalculado difería del declarado por el cliente. */
  readonly totalCorregido: boolean
}

export interface ContextoDeEmision {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly vendedorId: string
  /** Umbral leído de `config/parametros`, nunca de una constante. */
  readonly umbralIdentificacion: Centimos
  readonly formatoImpresion: 'a4' | 'rollo'
  /** Inyectable para que las pruebas fijen el momento. */
  readonly ahora?: () => Date
}

export async function emitirComprobante(
  contexto: ContextoDeEmision,
  peticion: PeticionDeEmitir,
): Promise<RespuestaDeEmitir> {
  const ahora = contexto.ahora ?? (() => new Date())

  // --- Paso 1: validar y recalcular ---------------------------------------

  if (peticion.claveIdempotencia.length === 0) {
    fallar('peticion_invalida', { campo: 'claveIdempotencia' })
  }

  if (!pedidoEsEmitible(peticion.lineas)) {
    // Cubre el pedido vacío y la línea con importe no positivo (FR-013).
    fallar(
      peticion.lineas.length === 0 ? 'peticion_invalida' : 'importe_no_positivo',
    )
  }

  const lineasCalculadas = calcularLineas(peticion.lineas)
  const total = calcularTotal(peticion.lineas)
  const totalCorregido =
    peticion.totalDeclarado !== undefined && peticion.totalDeclarado !== total

  // --- Paso 2: umbral de identificación -----------------------------------

  const umbral = evaluarIdentificacionDelComprador(
    peticion.tipoDocumento,
    total,
    peticion.cliente,
    contexto.umbralIdentificacion,
  )
  if (umbral.requiereCliente) {
    fallar('cliente_requerido', {
      motivo: umbral.motivo,
      umbral: umbral.umbral,
      total: umbral.total,
    })
  }

  // --- Paso 3: la transacción ---------------------------------------------

  const reclamo = await reclamarEnTransaccion(contexto, peticion, {
    lineas: lineasCalculadas,
    total,
    momento: ahora(),
  })

  // Comprobante ya existente con la misma clave.
  //
  // Solo `pendiente` autoriza reinvocar al proveedor (decisión 10): consta que
  // no hay documento. `reclamado` NO: es el caso del doble clic / petición en
  // vuelo; reemitir duplicaría. Un `reclamado` huérfano se aclara con
  // `consultarEstadoEmision` (si no existe → `pendiente` → reintento seguro).
  if (reclamo.yaExistia) {
    if (reclamo.comprobante.estado === 'pendiente') {
      return invocarProveedorYRegistrar(contexto, reclamo.comprobante, {
        totalCorregido,
        momento: ahora(),
      })
    }
    return respuestaDe(reclamo.comprobante, { yaExistia: true, totalCorregido })
  }

  // --- Paso 4: el proveedor, fuera de la transacción ----------------------

  return invocarProveedorYRegistrar(contexto, reclamo.comprobante, {
    totalCorregido,
    momento: ahora(),
  })
}

interface Reclamo {
  readonly comprobante: Comprobante
  readonly yaExistia: boolean
}

async function reclamarEnTransaccion(
  contexto: ContextoDeEmision,
  peticion: PeticionDeEmitir,
  datos: {
    lineas: readonly LineaDelComprobante[]
    total: Centimos
    momento: Date
  },
): Promise<Reclamo> {
  return contexto.almacen.enTransaccion(async (transaccion) => {
    // Lo primero, siempre: ¿ya existe esta clave? Es la comprobación que
    // convierte un reintento en una consulta.
    const existente = await transaccion.leerComprobante(
      peticion.claveIdempotencia,
    )
    if (existente !== undefined) {
      return { comprobante: existente, yaExistia: true }
    }

    // La cotización se marca convertida **en este mismo acto**. Es lo que impide
    // que dos dispositivos con la misma cotización abierta produzcan dos
    // comprobantes: la clave de idempotencia no cubre ese caso, porque cada
    // dispositivo genera una clave distinta.
    if (peticion.cotizacionId !== null) {
      const cotizacion = await transaccion.leerCotizacion(peticion.cotizacionId)
      if (cotizacion === undefined) {
        fallar('cotizacion_no_pendiente', {
          cotizacionId: peticion.cotizacionId,
        })
      }
      if (cotizacion.estado === 'convertida') {
        fallar('cotizacion_ya_convertida', {
          comprobanteId: cotizacion.comprobanteId,
        })
      }
      if (cotizacion.estado !== 'pendiente') {
        fallar('cotizacion_no_pendiente', {
          cotizacionId: peticion.cotizacionId,
          estado: cotizacion.estado,
        })
      }
    }

    const regulado = necesitaCorrelativoRegulado(peticion.tipoDocumento)
    const correlativo = regulado
      ? await reclamarCorrelativo(
          transaccion,
          contexto.vendedorId,
          peticion.tipoDocumento,
        )
      : null

    const comprobante: Comprobante = {
      id: peticion.claveIdempotencia,
      estado: 'reclamado',
      tipoDocumento: peticion.tipoDocumento,
      serie: correlativo?.serie ?? '',
      numero: correlativo?.numero ?? null,
      cliente:
        peticion.cliente === null
          ? null
          : {
              tipoDocumento: peticion.cliente.tipoDocumento,
              numeroDocumento: peticion.cliente.numeroDocumento,
              denominacion: peticion.cliente.denominacion,
              direccion: peticion.cliente.direccion ?? null,
              eventual: false,
            },
      lineas: datos.lineas,
      total: datos.total,
      condicionPago: {
        tipo: peticion.condicionPago.tipo,
        fechaVencimiento: peticion.condicionPago.fechaVencimiento ?? null,
        estadoCobro:
          peticion.condicionPago.tipo === 'credito' ? 'pendiente' : 'no_aplica',
      },
      medioPago: peticion.medioPago,
      vendedorId: contexto.vendedorId,
      emitidoEn: datos.momento,
      proveedor: null,
      cotizacionId: peticion.cotizacionId,
      capturaId: peticion.capturaId,
      contacto: null,
      intentos: [],
      anulacion: null,
    }

    transaccion.crearComprobante(comprobante)

    if (peticion.cotizacionId !== null) {
      transaccion.marcarCotizacionConvertida(
        peticion.cotizacionId,
        comprobante.id,
      )
    }

    return { comprobante, yaExistia: false }
  })
}

async function invocarProveedorYRegistrar(
  contexto: ContextoDeEmision,
  comprobante: Comprobante,
  opciones: { totalCorregido: boolean; momento: Date },
): Promise<RespuestaDeEmitir> {
  if (!sePuedeInvocarEmision(comprobante.estado)) {
    // Defensa en profundidad. Si se llega aquí es un error de programación, no
    // una situación del negocio, y es justo el error que produce duplicados.
    fallar('emision_indeterminada')
  }

  // Un documento sin valor tributario no va al proveedor: no existe ante la
  // autoridad. Se cierra aquí mismo.
  if (!REGLAS[comprobante.tipoDocumento].valorTributario) {
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      estado: 'aceptado',
      nuevoIntento: {
        momento: opciones.momento,
        resultado: 'exito',
        razon: 'documento_sin_valor_tributario',
        rastro: null,
      },
    })
    return respuestaDe(
      { ...comprobante, estado: 'aceptado' },
      { yaExistia: false, totalCorregido: opciones.totalCorregido },
    )
  }

  const resultado = await contexto.proveedor.emitir({
    tipoDocumento: comprobante.tipoDocumento,
    serie: comprobante.serie,
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
    emitidoEn: comprobante.emitidoEn,
  })

  if (!resultado.ok) {
    const estado = estadoSegunFallo(resultado.fallo.clase)
    exigirTransicion(comprobante.estado, estado)

    const intento: IntentoDeEmision = {
      momento: opciones.momento,
      resultado: resultado.fallo.clase,
      razon: resultado.fallo.razon,
      rastro: resultado.fallo.rastro,
    }

    await contexto.almacen.actualizarComprobante(comprobante.id, {
      estado,
      nuevoIntento: intento,
    })

    // El correlativo consumido NO se devuelve, y por eso no hay ninguna llamada
    // aquí que lo libere. Ver la explicación en series.ts: devolverlo sin saber
    // si el proveedor lo usó es lo que produciría dos documentos con el mismo
    // número.

    if (obligaAReconciliar(resultado.fallo)) {
      // Se lanza con un código que el cliente entiende como "no reintentes".
      fallar('emision_indeterminada', { comprobanteId: comprobante.id })
    }

    if (estado === 'pendiente') {
      fallar('proveedor_no_disponible', { comprobanteId: comprobante.id })
    }

    fallar('emision_rechazada', {
      comprobanteId: comprobante.id,
      razon: resultado.fallo.razon,
    })
  }

  const emitido = resultado.valor
  const estado = estadoSegunProveedor(emitido.estado)
  exigirTransicion(comprobante.estado, estado)

  const datosProveedor: DatosDelProveedor = {
    nombre: contexto.proveedor.nombre,
    referenciaExterna: emitido.referenciaExterna ?? null,
    estadoInformado: emitido.estado,
    pdf: emitido.archivos.pdf ?? null,
    xml: emitido.archivos.xml ?? null,
    cdr: emitido.archivos.cdr ?? null,
  }

  await contexto.almacen.actualizarComprobante(comprobante.id, {
    estado,
    numero: emitido.numero,
    proveedor: datosProveedor,
    nuevoIntento: {
      momento: opciones.momento,
      resultado: 'exito',
      razon: null,
      rastro: resultado.valor.rastro,
    },
  })

  // El correlativo se confirma en cuanto consta que el proveedor tiene el
  // documento, sin esperar la constancia de la autoridad. Si se esperase a
  // `aceptado`, todos los números en tránsito quedarían marcados como dudosos.
  if (ventaEstaCerrada(estado) && comprobante.serie !== '') {
    await contexto.almacen.confirmarCorrelativo(
      idDeSerie(contexto.vendedorId, comprobante.tipoDocumento),
      emitido.numero,
    )
  }

  return respuestaDe(
    {
      ...comprobante,
      estado,
      numero: emitido.numero,
      proveedor: datosProveedor,
    },
    { yaExistia: false, totalCorregido: opciones.totalCorregido },
  )
}

function respuestaDe(
  comprobante: Comprobante,
  opciones: { yaExistia: boolean; totalCorregido: boolean },
): RespuestaDeEmitir {
  return {
    comprobanteId: comprobante.id,
    estado: comprobante.estado,
    serie: comprobante.serie,
    numero: comprobante.numero,
    total: comprobante.total,
    archivos: {
      pdf: comprobante.proveedor?.pdf ?? null,
      xml: comprobante.proveedor?.xml ?? null,
      cdr: comprobante.proveedor?.cdr ?? null,
    },
    yaExistia: opciones.yaExistia,
    totalCorregido: opciones.totalCorregido,
  }
}
