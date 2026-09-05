import { estaDentroDeLaVentanaDeAnulacion } from '../../domain/anulacion/ventana.ts'
import {
  estadoEsAnulable,
  REGLAS,
} from '../../domain/documentos/tipos.ts'
import { fallar } from '../errores.ts'
import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'
import type { AlmacenDeEmision, Comprobante } from './almacen.ts'
import { exigirTransicion } from './estados.ts'
import type { AlmacenDeInventario } from '../inventario/almacen.ts'
import { intentarTrasAnulacion } from '../inventario/aplicar.ts'

/**
 * `anularComprobante`: baja de un comprobante emitido (`enviado` o `aceptado`)
 * el mismo día (Lima). Si hay par boleta/factura ↔ guía, anula ambos (FR-013)
 * con el mismo motivo y autor. **Nunca borra el documento.**
 */

export interface PeticionDeAnular {
  readonly comprobanteId: string
  readonly motivo: string
  readonly autorId: string
}

export interface RespuestaDeAnular {
  readonly estado: 'anulado'
  readonly anulacion: NonNullable<Comprobante['anulacion']>
  readonly yaEstabaAnulado: boolean
  /** Id del documento asociado anulado en el mismo acto; null si no había par. */
  readonly parAnuladoId: string | null
}

export interface ContextoDeAnulacion {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly inventario?: AlmacenDeInventario
  readonly ahora?: () => Date
}

export function idDelParAsociado(comprobante: Comprobante): string | null {
  if (comprobante.tipoDocumento === 'guia') {
    return comprobante.comprobanteOrigenId ?? null
  }
  if (
    comprobante.tipoDocumento === 'boleta' ||
    comprobante.tipoDocumento === 'factura'
  ) {
    return comprobante.guiaAsociadaId ?? null
  }
  return null
}

function yaCerrado(comprobante: Comprobante): boolean {
  return comprobante.estado === 'anulado' && comprobante.anulacion !== null
}

export async function anularComprobante(
  contexto: ContextoDeAnulacion,
  peticion: PeticionDeAnular,
): Promise<RespuestaDeAnular> {
  const ahora = (contexto.ahora ?? (() => new Date()))()
  const motivo = peticion.motivo.trim()
  if (motivo.length < 4) {
    fallar('peticion_invalida', { campo: 'motivo' })
  }

  const comprobante = await contexto.almacen.leerComprobante(
    peticion.comprobanteId,
  )
  if (comprobante === undefined) {
    fallar('comprobante_no_encontrado')
  }

  const parId = idDelParAsociado(comprobante)
  const par =
    parId === null
      ? undefined
      : await contexto.almacen.leerComprobante(parId)

  if (yaCerrado(comprobante) && (par === undefined || yaCerrado(par))) {
    return {
      estado: 'anulado',
      anulacion: comprobante.anulacion!,
      yaEstabaAnulado: true,
      parAnuladoId: par?.id ?? null,
    }
  }

  const pendientes: Comprobante[] = []
  if (!yaCerrado(comprobante)) pendientes.push(comprobante)
  if (par !== undefined && !yaCerrado(par)) pendientes.push(par)

  for (const cada of pendientes) {
    await confirmarBajaEnProveedor(contexto, cada, motivo, ahora)
  }

  const anulacion: NonNullable<Comprobante['anulacion']> = {
    motivo,
    autor: peticion.autorId,
    momento: ahora,
    estado: 'anulado',
  }

  for (const cada of pendientes) {
    exigirTransicion(cada.estado, 'anulado')
    await contexto.almacen.actualizarComprobante(cada.id, {
      estado: 'anulado',
      anulacion,
      nuevoIntento: {
        momento: ahora,
        resultado: 'exito',
        razon: 'anulacion_confirmada',
        rastro: null,
      },
    })
  }

  await intentarTrasAnulacion(
    contexto.inventario,
    contexto.almacen,
    peticion.comprobanteId,
  )

  return {
    estado: 'anulado',
    anulacion,
    yaEstabaAnulado: pendientes.length === 0,
    parAnuladoId: par?.id ?? null,
  }
}

async function confirmarBajaEnProveedor(
  contexto: ContextoDeAnulacion,
  comprobante: Comprobante,
  motivo: string,
  ahora: Date,
): Promise<void> {
  if (!estadoEsAnulable(comprobante.estado)) {
    fallar('estado_no_anulable')
  }

  const ventana = estaDentroDeLaVentanaDeAnulacion(comprobante.emitidoEn, ahora)
  if (!ventana.dentroDeVentana) {
    fallar('fuera_de_ventana_anulacion', {
      diaDeEmision: ventana.diaDeEmision,
      diaActual: ventana.diaActual,
    })
  }

  if (!REGLAS[comprobante.tipoDocumento].valorTributario) {
    return
  }

  if (comprobante.numero === null) {
    fallar('estado_no_anulable')
  }

  const resultado = await contexto.proveedor.anular({
    tipoDocumento: comprobante.tipoDocumento,
    serie: comprobante.serie,
    numero: comprobante.numero,
    motivo,
    emitidoEn: comprobante.emitidoEn,
  })

  if (!resultado.ok) {
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      nuevoIntento: {
        momento: ahora,
        resultado: resultado.fallo.clase,
        razon: resultado.fallo.razon,
        rastro: resultado.fallo.rastro,
      },
    })

    if (resultado.fallo.clase === 'indisponible') {
      fallar('proveedor_no_disponible')
    }
    if (resultado.fallo.clase === 'indeterminado') {
      fallar('emision_indeterminada')
    }
    fallar('emision_rechazada')
  }

  if (resultado.valor.estado !== 'anulado') {
    await contexto.almacen.actualizarComprobante(comprobante.id, {
      nuevoIntento: {
        momento: ahora,
        resultado: 'exito',
        razon: `baja_en_curso_${resultado.valor.estado}`,
        rastro: resultado.valor.rastro,
      },
    })
    fallar('emision_indeterminada')
  }
}
