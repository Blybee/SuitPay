import { estaDentroDeLaVentanaDeAnulacion } from '../../domain/anulacion/ventana.ts'
import {
  estadoEsAnulable,
  REGLAS,
} from '../../domain/documentos/tipos.ts'
import { fallar } from '../errores.ts'
import type { ProveedorDeEmision } from '../proveedor/interfaz.ts'
import type { AlmacenDeEmision, Comprobante } from './almacen.ts'
import { exigirTransicion } from './estados.ts'

/**
 * `anularComprobante`: baja de un comprobante aceptado el mismo día (Lima).
 *
 * Orden: validar existencia → estado anulable → ventana → (si tiene valor
 * tributario) proveedor → solo entonces persistir `anulado` + `anulacion`.
 * **Nunca borra el documento.** Si el proveedor no confirma, el local no cambia.
 */

export interface PeticionDeAnular {
  readonly comprobanteId: string
  readonly motivo: string
  /** Identidad del token; nunca del cuerpo de la petición del navegador. */
  readonly autorId: string
}

export interface RespuestaDeAnular {
  readonly estado: 'anulado'
  readonly anulacion: NonNullable<Comprobante['anulacion']>
  /** Verdadero si ya estaba anulado: no se volvió a llamar al proveedor. */
  readonly yaEstabaAnulado: boolean
}

export interface ContextoDeAnulacion {
  readonly almacen: AlmacenDeEmision
  readonly proveedor: ProveedorDeEmision
  readonly ahora?: () => Date
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

  if (comprobante.estado === 'anulado' && comprobante.anulacion !== null) {
    return {
      estado: 'anulado',
      anulacion: comprobante.anulacion,
      yaEstabaAnulado: true,
    }
  }

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

  if (comprobante.numero === null) {
    fallar('estado_no_anulable')
  }

  // Documento interno / nota de venta: no existe ante la autoridad; la baja es local.
  if (REGLAS[comprobante.tipoDocumento].valorTributario) {
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

    // Solo persistimos anulado cuando el proveedor confirma la baja.
    // Un "por anular" / estado no anulado no cierra la venta localmente.
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

  exigirTransicion(comprobante.estado, 'anulado')

  const anulacion: NonNullable<Comprobante['anulacion']> = {
    motivo,
    autor: peticion.autorId,
    momento: ahora,
    estado: 'anulado',
  }

  await contexto.almacen.actualizarComprobante(comprobante.id, {
    estado: 'anulado',
    anulacion,
    nuevoIntento: {
      momento: ahora,
      resultado: 'exito',
      razon: 'anulacion_confirmada',
      rastro: null,
    },
  })

  return { estado: 'anulado', anulacion, yaEstabaAnulado: false }
}
