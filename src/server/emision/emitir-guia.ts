import { REGLAS } from '../../domain/documentos/tipos.ts'
import { guiaEstaVigente } from '../../domain/guia/tipos.ts'
import type { TrasladoDeGuia } from '../../domain/guia/tipos.ts'
import { trasladoEsEmitible } from '../../domain/guia/validar.ts'
import { fallar } from '../errores.ts'
import { obligaAReconciliar } from '../proveedor/interfaz.ts'
import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'
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
import { reclamarCorrelativo } from './series.ts'
import type { AlmacenDeInventario } from '../inventario/almacen.ts'
import { intentarTrasVenta } from '../inventario/aplicar.ts'

/**
 * `emitirGuia`: único camino por el que nace una guía de remisión.
 * Mismo orden que `emitirComprobante`: validar → transacción (idempotencia
 * + correlativo) → proveedor fuera de la transacción.
 */

export interface PeticionDeEmitirGuia {
  readonly claveIdempotencia: string
  readonly destinatario: {
    readonly tipoDocumento: string
    readonly numeroDocumento: string
    readonly denominacion: string
    readonly direccion?: string
  } | null
  readonly traslado: TrasladoDeGuia
  /** Boleta/factura desde la que se reutilizó el pedido. Ausente = guía sola. */
  readonly comprobanteOrigenId: string | null
}

export interface RespuestaDeEmitirGuia {
  readonly comprobanteId: string
  readonly estado: Comprobante['estado']
  readonly serie: string
  readonly numero: number | null
  readonly total: number
  readonly archivos: {
    readonly pdf: string | null
    readonly xml: string | null
    readonly cdr: string | null
  }
  readonly yaExistia: boolean
  readonly totalCorregido: boolean
}

export interface ContextoDeGuia {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly vendedorId: string
  readonly formatoImpresion: 'a4' | 'rollo'
  readonly inventario?: AlmacenDeInventario
  readonly ahora?: () => Date
}

export async function emitirGuia(
  contexto: ContextoDeGuia,
  peticion: PeticionDeEmitirGuia,
): Promise<RespuestaDeEmitirGuia> {
  const ahora = contexto.ahora ?? (() => new Date())

  if (peticion.claveIdempotencia.length === 0) {
    fallar('peticion_invalida', { campo: 'claveIdempotencia' })
  }

  if (!trasladoEsEmitible(peticion.traslado)) {
    fallar('peticion_invalida', { campo: 'traslado' })
  }

  if (
    peticion.traslado.motivoTraslado !== 'entre_almacenes' &&
    peticion.destinatario === null
  ) {
    fallar('cliente_requerido', { motivo: 'guia_publica_exige_destinatario' })
  }

  const reclamo = await reclamarGuia(contexto, peticion, ahora())

  if (reclamo.yaExistia) {
    if (reclamo.comprobante.estado === 'pendiente') {
      return invocarYRegistrar(contexto, reclamo.comprobante, ahora())
    }
    return respuestaDe(reclamo.comprobante, true)
  }

  return invocarYRegistrar(contexto, reclamo.comprobante, ahora())
}

interface Reclamo {
  readonly comprobante: Comprobante
  readonly yaExistia: boolean
}

async function reclamarGuia(
  contexto: ContextoDeGuia,
  peticion: PeticionDeEmitirGuia,
  momento: Date,
): Promise<Reclamo> {
  return contexto.almacen.enTransaccion(async (transaccion) => {
    const existente = await transaccion.leerComprobante(
      peticion.claveIdempotencia,
    )
    if (existente !== undefined) {
      return { comprobante: existente, yaExistia: true }
    }

    const correlativo = await reclamarCorrelativo(
      transaccion,
      contexto.vendedorId,
      'guia',
    )

    let comprobanteOrigenId: string | null = null
    let origenParaVincular: Comprobante | undefined

    if (peticion.comprobanteOrigenId !== null) {
      const origen = await transaccion.leerComprobante(
        peticion.comprobanteOrigenId,
      )
      if (origen === undefined) {
        fallar('comprobante_no_encontrado')
      }
      if (origen.tipoDocumento === 'boleta' || origen.tipoDocumento === 'factura') {
        if (origen.guiaAsociadaId) {
          const asociada = await transaccion.leerComprobante(origen.guiaAsociadaId)
          if (asociada !== undefined && guiaEstaVigente(asociada.estado)) {
            fallar('guia_asociada_existente')
          }
        }
        comprobanteOrigenId = origen.id
        origenParaVincular = origen
      }
      // Nota de venta y otros: se emite la guía sin escribir el par.
    }

    const lineas: readonly LineaDelComprobante[] = peticion.traslado.items.map(
      (item) => ({
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidad: item.unidad,
        cantidad: item.cantidad,
        precio: 0,
        importe: 0,
      }),
    )

    const comprobante: Comprobante = {
      id: peticion.claveIdempotencia,
      estado: 'reclamado',
      tipoDocumento: 'guia',
      serie: correlativo.serie,
      numero: correlativo.numero,
      cliente:
        peticion.destinatario === null
          ? null
          : {
              tipoDocumento: peticion.destinatario.tipoDocumento,
              numeroDocumento: peticion.destinatario.numeroDocumento,
              denominacion: peticion.destinatario.denominacion,
              direccion: peticion.destinatario.direccion ?? null,
              eventual: false,
            },
      lineas,
      total: 0,
      condicionPago: {
        tipo: 'contado',
        fechaVencimiento: null,
        estadoCobro: 'no_aplica',
      },
      medioPago: null,
      vendedorId: contexto.vendedorId,
      emitidoEn: momento,
      proveedor: null,
      cotizacionId: null,
      capturaId: null,
      contacto: null,
      intentos: [],
      anulacion: null,
      traslado: peticion.traslado,
      comprobanteOrigenId,
      guiaAsociadaId: null,
    }

    transaccion.crearComprobante(comprobante)

    if (origenParaVincular !== undefined) {
      transaccion.actualizarComprobanteEnTransaccion({
        ...origenParaVincular,
        guiaAsociadaId: comprobante.id,
      })
    }

    return { comprobante, yaExistia: false }
  })
}

async function invocarYRegistrar(
  contexto: ContextoDeGuia,
  comprobante: Comprobante,
  momento: Date,
): Promise<RespuestaDeEmitirGuia> {
  if (!sePuedeInvocarEmision(comprobante.estado)) {
    fallar('emision_indeterminada')
  }

  if (!REGLAS[comprobante.tipoDocumento].valorTributario) {
    fallar('peticion_invalida', { campo: 'tipoDocumento' })
  }

  const traslado = comprobante.traslado
  if (traslado === undefined || traslado === null) {
    fallar('peticion_invalida', { campo: 'traslado' })
  }

  const resultado = await contexto.proveedor.emitirGuiaRemision({
    serie: comprobante.serie,
    numero: comprobante.numero,
    destinatario:
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
    traslado,
    formatoImpresion: contexto.formatoImpresion,
    emitidoEn: comprobante.emitidoEn,
  })

  if (!resultado.ok) {
    const estado = estadoSegunFallo(resultado.fallo.clase)
    exigirTransicion(comprobante.estado, estado)
    const intento: IntentoDeEmision = {
      momento,
      resultado: resultado.fallo.clase,
      razon: resultado.fallo.razon,
      rastro: resultado.fallo.rastro,
    }
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      estado,
      nuevoIntento: intento,
    })
    if (obligaAReconciliar(resultado.fallo)) {
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
      momento,
      resultado: 'exito',
      razon: null,
      rastro: resultado.valor.rastro,
    },
  })

  if (ventaEstaCerrada(estado) && comprobante.serie !== '') {
    await contexto.almacen.confirmarCorrelativo(
      idDeSerie(contexto.vendedorId, 'guia'),
      emitido.numero,
    )
  }

  await intentarTrasVenta(contexto.inventario, contexto.almacen, comprobante.id)

  return respuestaDe(
    {
      ...comprobante,
      estado,
      numero: emitido.numero,
      proveedor: datosProveedor,
    },
    false,
  )
}

function respuestaDe(
  comprobante: Comprobante,
  yaExistia: boolean,
): RespuestaDeEmitirGuia {
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
    yaExistia,
    totalCorregido: false,
  }
}
