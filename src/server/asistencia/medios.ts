import {
  storage,
  storageBucketDelEntorno,
} from '../firebase/admin.ts'
import { ErrorDeSuitPay } from '../errores.ts'

export type TipoDeMedioAsistencia = 'audio' | 'imagen' | 'pdf'

export interface MedioLeido {
  readonly mimeType: string
  readonly dataBase64: string
  readonly bytes: Uint8Array
}

function mimeDesdeUrl(medioUrl: string, tipo: TipoDeMedioAsistencia): string {
  const bajo = medioUrl.toLowerCase()
  if (bajo.endsWith('.png')) return 'image/png'
  if (bajo.endsWith('.jpg') || bajo.endsWith('.jpeg')) return 'image/jpeg'
  if (bajo.endsWith('.webp')) return 'image/webp'
  if (bajo.endsWith('.webm')) return 'audio/webm'
  if (bajo.endsWith('.mp4') || bajo.endsWith('.m4a')) return 'audio/mp4'
  if (bajo.endsWith('.ogg')) return 'audio/ogg'
  if (bajo.endsWith('.pdf')) return 'application/pdf'
  if (tipo === 'imagen') return 'image/jpeg'
  if (tipo === 'pdf') return 'application/pdf'
  return 'audio/webm'
}

/**
 * Lee un objeto de Storage (gs://, download URL o path relativo).
 * Devuelve bytes crudos y base64: el PDF grande usa los bytes en File API.
 */
export async function leerMedioDeStorage(
  medioUrl: string,
  tipo: TipoDeMedioAsistencia,
): Promise<MedioLeido> {
  let bucketName: string | undefined
  let objectPath: string

  if (medioUrl.startsWith('gs://')) {
    const sinEsquema = medioUrl.slice('gs://'.length)
    const barra = sinEsquema.indexOf('/')
    if (barra < 0) throw new ErrorDeSuitPay('peticion_invalida')
    bucketName = sinEsquema.slice(0, barra)
    objectPath = sinEsquema.slice(barra + 1)
  } else if (medioUrl.startsWith('http://') || medioUrl.startsWith('https://')) {
    const marcador = '/o/'
    const idx = medioUrl.indexOf(marcador)
    if (idx >= 0) {
      const resto = medioUrl.slice(idx + marcador.length)
      objectPath = decodeURIComponent(resto.split('?')[0] ?? resto)
    } else {
      objectPath = medioUrl
    }
  } else {
    objectPath = medioUrl.replace(/^\//, '')
  }

  const bucketResuelto = bucketName ?? storageBucketDelEntorno()
  if (bucketResuelto === undefined || bucketResuelto === '') {
    throw new ErrorDeSuitPay('fallo_inesperado', {
      motivo: 'storage_bucket_no_configurado',
    })
  }
  const archivo = storage().bucket(bucketResuelto).file(objectPath)
  const [existe] = await archivo.exists()
  if (!existe) {
    throw new ErrorDeSuitPay('peticion_invalida', {
      motivo: 'medio_no_encontrado',
    })
  }
  const [buffer] = await archivo.download()
  const [metadata] = await archivo.getMetadata()
  const mimeType =
    typeof metadata.contentType === 'string' && metadata.contentType !== ''
      ? metadata.contentType
      : mimeDesdeUrl(medioUrl, tipo)

  return {
    mimeType,
    dataBase64: buffer.toString('base64'),
    bytes: buffer,
  }
}
