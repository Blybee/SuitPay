import {
  exito,
  fallo,
  propagarFallo,
} from '../interfaz.ts'
import type {
  DocumentoAnulado,
  PeticionDeAnulacion,
  Resultado,
} from '../interfaz.ts'
import { traducirEstado } from './estados.ts'
import { pedirAlProveedor } from './transporte.ts'
import type { ConfiguracionDelProveedor } from './transporte.ts'

const RUTA_DE_BAJA = '/api/v3/anulaciones'

/**
 * Solicitud de baja ante el proveedor (T102). Vive aislada: el resto del
 * sistema solo ve `DocumentoAnulado` / fallos clasificados.
 */
export async function anularDocumento(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeAnulacion,
): Promise<Resultado<DocumentoAnulado>> {
  const respuesta = await pedirAlProveedor(configuracion, RUTA_DE_BAJA, {
    serie: peticion.serie,
    numero: String(peticion.numero),
    motivo: peticion.motivo,
    fecha_emision: peticion.emitidoEn.toISOString(),
  })

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)

  const datos = (
    respuesta.valor.json as { data?: { estado?: string; external_id?: string } }
  ).data

  const traducido = traducirEstado(datos?.estado)

  if (traducido.anulacionEnCurso) {
    return exito({
      estado: 'aceptado',
      referenciaExterna: datos?.external_id,
      rastro: respuesta.valor.rastro,
    })
  }

  if (traducido.estado === undefined) {
    return fallo(
      'indeterminado',
      `estado_de_baja_desconocido_${datos?.estado ?? 'ausente'}`,
      respuesta.valor.rastro,
    )
  }

  return exito({
    estado: traducido.estado,
    referenciaExterna: datos?.external_id,
    rastro: respuesta.valor.rastro,
  })
}
