import { usarCatalogo } from '../catalogo/almacen.ts'
import { leerClientePorDocumento } from '../clientes/existencia.ts'
import { subirMedioDeCaptura } from '../captura/almacenamiento.ts'
import { usarDegradacion } from '../degradacion/estado.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'
import { usarSesion } from '../sesion/almacen.ts'
import { emparejarItemsPdf } from './emparejar-pdf.ts'
import { extraerListaPdfFn } from './pdf.funciones.ts'
import { usarPropuestasPdf } from './propuestas.ts'
import { resolverEtiquetaClientePdf } from './resolver-cliente-pdf.ts'

/** Alineado con storage.rules (40 MiB). */
export const TECHO_UI_PDF_BYTES = 40 * 1024 * 1024

export function pdfDentroDelTecho(bytes: number): boolean {
  return bytes > 0 && bytes <= TECHO_UI_PDF_BYTES
}

/**
 * Arranca el job en segundo plano. No abre la revisión.
 */
export async function procesarPdfDeRequerimiento(
  archivo: File,
): Promise<void> {
  const uid = usarSesion.getState().uid
  const indice = usarCatalogo.getState().indice
  if (uid === null || indice === null) {
    usarNotificaciones.getState().mostrar({
      tono: 'error',
      mensaje: 'No hay sesión o catálogo para leer el PDF.',
    })
    return
  }
  if (!pdfDentroDelTecho(archivo.size)) {
    usarNotificaciones.getState().mostrar({
      tono: 'error',
      mensaje: 'El PDF pesa más de 40 MB. Usa un archivo más liviano.',
    })
    return
  }

  const id = crypto.randomUUID()
  usarPropuestasPdf.getState().encolar({
    id,
    nombreArchivo: archivo.name,
    fase: 'procesando',
  })

  try {
    const { storagePath } = await subirMedioDeCaptura({
      uid,
      capturaId: id,
      blob: archivo,
      tipo: 'pdf',
    })

    const respuesta = await extraerListaPdfFn({
      data: { medioUrl: storagePath },
    })

    if (!respuesta.ok || respuesta.resultado === undefined) {
      const codigo = respuesta.error?.codigo
      if (codigo === 'asistencia_no_disponible') {
        usarDegradacion.getState().declarar('asistencia')
      }
      usarPropuestasPdf.getState().actualizar(id, {
        fase: 'error',
        mensajeError:
          respuesta.error?.mensaje ?? 'No se pudo leer el PDF.',
      })
      usarNotificaciones.getState().mostrar({
        tono: 'error',
        mensaje:
          codigo === 'medio_ilegible'
            ? 'No se pudo leer el PDF. Prueba fotografiar la lista.'
            : (respuesta.error?.mensaje ?? 'No se pudo leer el PDF.'),
      })
      return
    }

    usarDegradacion.getState().resolver('asistencia')
    const lineas = emparejarItemsPdf(indice, respuesta.resultado.items)
    const detectado = respuesta.resultado.cliente
    let registrado = null
    if (detectado !== null) {
      try {
        registrado = await leerClientePorDocumento(detectado.numeroDocumento)
      } catch {
        registrado = null
      }
    }
    const resuelto = resolverEtiquetaClientePdf(
      detectado,
      usarCatalogo.getState().clientes,
      registrado,
    )

    usarPropuestasPdf.getState().actualizar(id, {
      fase: 'lista',
      lineas,
      etiquetaCliente: resuelto.etiqueta,
      cliente: resuelto.cliente,
      capturaId: respuesta.resultado.capturaId,
      medioUrl: storagePath,
    })
    usarNotificaciones.getState().mostrar({
      tono: 'exito',
      titulo: 'PDF procesado',
      mensaje: `${resuelto.etiqueta} · ${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'}. Revisa cuando quieras.`,
    })
  } catch (error) {
    console.error('[SuitPay] PDF requerimiento', error)
    const codigo =
      error !== null && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : ''
    const falloDeStorage = codigo.startsWith('storage/')
    if (!falloDeStorage) {
      usarDegradacion.getState().declarar('asistencia')
    }
    usarPropuestasPdf.getState().actualizar(id, {
      fase: 'error',
      mensajeError: falloDeStorage
        ? 'No se pudo guardar el PDF.'
        : 'No se pudo leer el PDF.',
    })
    usarNotificaciones.getState().mostrar({
      tono: 'error',
      mensaje: falloDeStorage
        ? 'No se pudo guardar el PDF. El tab sigue usable: escribe el pedido.'
        : 'No se pudo leer el PDF. Puedes escribir el pedido.',
    })
  }
}
