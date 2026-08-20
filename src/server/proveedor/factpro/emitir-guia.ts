import {
  exito,
  fallo,
  propagarFallo,
} from '../interfaz.ts'
import type {
  DocumentoEmitido,
  PeticionDeGuiaRemision,
  Resultado,
} from '../interfaz.ts'
import { traducirEstado } from './estados.ts'
import { cuerpoDeGuia } from './mapeo-guia.ts'
import { pedirAlProveedor } from './transporte.ts'
import type { ConfiguracionDelProveedor } from './transporte.ts'

const RUTA_DE_GUIAS = '/api/v3/guias'
const COMODIN_DE_NUMERO = '#'

export async function emitirGuiaRemision(
  configuracion: ConfiguracionDelProveedor,
  peticion: PeticionDeGuiaRemision,
): Promise<Resultado<DocumentoEmitido>> {
  const destinatario =
    peticion.destinatario === null
      ? null
      : {
          cliente_tipo_documento:
            peticion.destinatario.tipoDocumento === 'RUC' ? '4' : '1',
          cliente_numero_documento: peticion.destinatario.numeroDocumento,
          cliente_denominacion: peticion.destinatario.denominacion,
          ...(peticion.destinatario.direccion
            ? { cliente_direccion: peticion.destinatario.direccion }
            : {}),
        }

  const respuesta = await pedirAlProveedor(configuracion, RUTA_DE_GUIAS, {
    tipo_documento: 11,
    serie: peticion.serie,
    numero:
      peticion.numero === null ? COMODIN_DE_NUMERO : String(peticion.numero),
    formato_pdf: peticion.formatoImpresion === 'rollo' ? 'ticket' : 'a4',
    fecha_de_traslado: peticion.emitidoEn.toISOString().slice(0, 10),
    ...destinatario,
    ...cuerpoDeGuia(peticion.traslado),
  })

  if (!respuesta.ok) return propagarFallo(respuesta.fallo)

  const datos = (
    respuesta.valor.json as {
      data?: {
        serie?: string
        numero?: string | number
        estado?: string
        external_id?: string
        enlace_pdf?: string
      }
    }
  ).data

  const traducido = traducirEstado(datos?.estado)
  if (traducido.estado === undefined || datos === undefined) {
    return fallo('indeterminado', 'guia_sin_estado', respuesta.valor.rastro)
  }

  const numero =
    typeof datos.numero === 'number'
      ? datos.numero
      : Number.parseInt(
          String(datos.numero ?? '').includes('-')
            ? String(datos.numero).slice(String(datos.numero).lastIndexOf('-') + 1)
            : String(datos.numero ?? ''),
          10,
        )

  if (!Number.isFinite(numero)) {
    return fallo('indeterminado', 'guia_sin_numero', respuesta.valor.rastro)
  }

  return exito({
    serie: datos.serie ?? peticion.serie,
    numero,
    estado: traducido.estado,
    archivos: { pdf: datos.enlace_pdf, xml: undefined, cdr: undefined },
    referenciaExterna: datos.external_id,
    rastro: respuesta.valor.rastro,
  })
}
