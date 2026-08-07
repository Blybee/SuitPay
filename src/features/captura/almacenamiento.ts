import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { obtenerAlmacenamiento } from '../../infra/firebase/cliente.ts'

/**
 * Sube el original de una captura a Cloud Storage.
 * Ruta: capturas/{uid}/{capturaId}.{ext}
 */

function extensionDe(mimeType: string, tipo: 'audio' | 'imagen'): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  return tipo === 'imagen' ? 'jpg' : 'webm'
}

export async function subirMedioDeCaptura(entrada: {
  readonly uid: string
  readonly capturaId: string
  readonly blob: Blob
  readonly tipo: 'audio' | 'imagen'
}): Promise<{ medioUrl: string; storagePath: string }> {
  const mimeType = entrada.blob.type || (entrada.tipo === 'imagen' ? 'image/jpeg' : 'audio/webm')
  const ext = extensionDe(mimeType, entrada.tipo)
  const storagePath = `capturas/${entrada.uid}/${entrada.capturaId}.${ext}`
  const referencia = ref(obtenerAlmacenamiento(), storagePath)
  await uploadBytes(referencia, entrada.blob, { contentType: mimeType })
  const medioUrl = await getDownloadURL(referencia)
  return { medioUrl, storagePath }
}
