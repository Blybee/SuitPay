import { ErrorDeSuitPay } from '../errores.ts'
import type { FetchComo } from './cliente-modelo.ts'

const FILES_UPLOAD =
  'https://generativelanguage.googleapis.com/upload/v1beta/files'
const FILES_API = 'https://generativelanguage.googleapis.com/v1beta'

export interface ArchivoGemini {
  readonly name: string
  readonly uri: string
}

function estadoDe(valor: unknown): string {
  if (!valor || typeof valor !== 'object') return ''
  const r = valor as { file?: { state?: string }; state?: string }
  return String(r.file?.state ?? r.state ?? '')
}

function uriDe(valor: unknown): ArchivoGemini | null {
  if (!valor || typeof valor !== 'object') return null
  const r = valor as {
    file?: { name?: string; uri?: string }
    name?: string
    uri?: string
  }
  const file = r.file ?? r
  const name = typeof file.name === 'string' ? file.name : ''
  const uri = typeof file.uri === 'string' ? file.uri : ''
  if (name === '' || uri === '') return null
  return { name, uri }
}

/**
 * Sube un PDF a la File API de Gemini y espera estado ACTIVE.
 * Los archivos caducan ~48 h; se intenta borrar después de generateContent.
 */
export async function subirPdfAGemini(entrada: {
  readonly bytes: Uint8Array
  readonly clave: string
  readonly fetchFn?: FetchComo
  readonly nombre?: string
  readonly timeoutMs?: number
}): Promise<ArchivoGemini> {
  const fetchFn = entrada.fetchFn ?? fetch
  const timeoutMs = entrada.timeoutMs ?? 60_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const boundary = `suitpay_${Date.now()}`
  const metadata = JSON.stringify({
    file: { display_name: entrada.nombre ?? 'requerimiento.pdf' },
  })
  const encabezadoMeta = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
  )
  const encabezadoFile = Buffer.from(
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  )
  const cierre = Buffer.from(`\r\n--${boundary}--\r\n`)
  const cuerpo = Buffer.concat([
    encabezadoMeta,
    encabezadoFile,
    Buffer.from(entrada.bytes),
    cierre,
  ])

  try {
    const respuesta = await fetchFn(`${FILES_UPLOAD}?key=${entrada.clave}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-Goog-Upload-Protocol': 'multipart',
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: cuerpo,
    })
    const texto = await respuesta.text()
    if (!respuesta.ok) {
      console.error(
        `[SuitPay] File API upload HTTP ${respuesta.status}: ${texto.slice(0, 240)}`,
      )
      throw new ErrorDeSuitPay('asistencia_no_disponible')
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(texto) as unknown
    } catch {
      throw new ErrorDeSuitPay('asistencia_no_disponible')
    }
    const inicial = uriDe(parsed)
    if (inicial === null) throw new ErrorDeSuitPay('asistencia_no_disponible')
    return await esperarActivo({
      archivo: inicial,
      clave: entrada.clave,
      fetchFn,
    })
  } catch (error) {
    if (error instanceof ErrorDeSuitPay) throw error
    console.error('[SuitPay] File API upload: red/timeout', error)
    throw new ErrorDeSuitPay('asistencia_no_disponible')
  } finally {
    clearTimeout(timer)
  }
}

async function esperarActivo(entrada: {
  readonly archivo: ArchivoGemini
  readonly clave: string
  readonly fetchFn: FetchComo
}): Promise<ArchivoGemini> {
  let actual = entrada.archivo
  for (let i = 0; i < 15; i += 1) {
    const url = `${FILES_API}/${actual.name}?key=${entrada.clave}`
    const respuesta = await entrada.fetchFn(url, { method: 'GET' })
    const texto = await respuesta.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(texto) as unknown
    } catch {
      throw new ErrorDeSuitPay('asistencia_no_disponible')
    }
    const estado = estadoDe(parsed)
    const siguiente = uriDe(parsed) ?? actual
    if (estado === 'ACTIVE' || estado === '') return siguiente
    if (estado === 'FAILED') throw new ErrorDeSuitPay('asistencia_no_disponible')
    actual = siguiente
    await new Promise((r) => setTimeout(r, 2_000))
  }
  throw new ErrorDeSuitPay('asistencia_no_disponible')
}

export async function borrarArchivoGemini(entrada: {
  readonly name: string
  readonly clave: string
  readonly fetchFn?: FetchComo
}): Promise<void> {
  const fetchFn = entrada.fetchFn ?? fetch
  try {
    await fetchFn(`${FILES_API}/${entrada.name}?key=${entrada.clave}`, {
      method: 'DELETE',
    })
  } catch {
    /* caduca solo; no bloquear la propuesta */
  }
}
