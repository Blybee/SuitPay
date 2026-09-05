import { randomUUID } from 'node:crypto'
import { bd, COLECCIONES } from '../firebase/admin.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import {
  borrarArchivoGemini,
  subirPdfAGemini,
} from './archivo-gemini.ts'
import {
  clavesDeAsistencia,
  invocarModeloConPartes,
} from './cliente-modelo.ts'
import type {
  DependenciasDelClienteModelo,
  ParteGemini,
} from './cliente-modelo.ts'
import { leerMedioDeStorage } from './medios.ts'
import { construirPayloadDePdf } from './payload-pdf.ts'
import type { ViaDePdf } from './payload-pdf.ts'
import { promptDeListaPdf, SCHEMA_RESPUESTA_PDF } from './prompts-pdf.ts'
import {
  asistenciaSimuladaActiva,
  extraerPdfSimulado,
} from './simulado.ts'
import type { CandidatoDeAsistencia } from './tipos.ts'

/** Gemini: PDF inline hasta 50 MB. Por encima, File API. */
export const TECHO_PDF_BYTES = 50 * 1024 * 1024
/** Por encima de esto el JSON con base64 hincha el request: File API. */
export const TECHO_INLINE_PDF_BYTES = 20 * 1024 * 1024
/** Techo de la UI / Storage rules. */
export const TECHO_UI_PDF_BYTES = 40 * 1024 * 1024

const TIMEOUT_PDF_MS = 120_000

export interface ItemDeListaPdf {
  readonly textoOriginal: string
  readonly cantidad: number
  readonly unidad: string
  readonly codigo?: string | null
  readonly confidence?: 'high' | 'low'
}

export interface ClienteDetectadoPdf {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly denominacion: string
}

export interface ResultadoDeListaPdf {
  readonly capturaId: string
  readonly medioUrl: string
  readonly items: readonly ItemDeListaPdf[]
  readonly cliente: ClienteDetectadoPdf | null
}

export interface PeticionDeExtraerPdf {
  readonly medioUrl: string
  readonly vendedorId: string
  readonly instrucciones?: readonly string[]
}

export interface DependenciasDeExtraerPdf {
  readonly leerMedio?: (medioUrl: string) => Promise<{
    mimeType: string
    dataBase64: string
    bytes?: Uint8Array
  }>
  readonly depsModelo?: DependenciasDelClienteModelo
  readonly forzarSimulado?: boolean
  readonly forzarVia?: ViaDePdf
  /** Catálogo compacto para el prompt; en pruebas evita tocar Firestore. */
  readonly leerCatalogo?: () => Promise<readonly CandidatoDeAsistencia[]>
  readonly ahora?: () => Date
  readonly idCaptura?: () => string
  readonly persistir?: (entrada: {
    readonly capturaId: string
    readonly medioUrl: string
    readonly items: readonly ItemDeListaPdf[]
    readonly cliente: ClienteDetectadoPdf | null
    readonly vendedorId: string
    readonly creadoEn: string
  }) => Promise<void>
}

function esPdf(mime: string): boolean {
  return mime === 'application/pdf' || mime.includes('pdf')
}

function bytesDesdeBase64(dataBase64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(dataBase64, 'base64'))
}

export function viaParaTamano(bytes: number): ViaDePdf {
  if (bytes > TECHO_INLINE_PDF_BYTES) return 'file_api'
  return 'inline'
}

export function normalizarClientePdf(
  valor: unknown,
): ClienteDetectadoPdf | null {
  if (!valor || typeof valor !== 'object') return null
  const r = valor as Record<string, unknown>
  const tipo =
    r.tipoDocumento === 'DNI' || r.tipoDocumento === 'RUC'
      ? r.tipoDocumento
      : null
  const numero =
    typeof r.numeroDocumento === 'string'
      ? r.numeroDocumento.replace(/\D/g, '')
      : ''
  const denominacion =
    typeof r.denominacion === 'string' ? r.denominacion.trim() : ''
  if (tipo === null || numero === '') return null
  if (tipo === 'RUC' && numero.length !== 11) return null
  if (tipo === 'DNI' && numero.length !== 8) return null
  return {
    tipoDocumento: tipo,
    numeroDocumento: numero,
    denominacion: denominacion === '' ? numero : denominacion,
  }
}

export function normalizarItemsPdf(valor: unknown): ItemDeListaPdf[] {
  if (!valor || typeof valor !== 'object') return []
  const r = valor as Record<string, unknown>
  const raw = Array.isArray(r.items) ? r.items : []
  const items: ItemDeListaPdf[] = []
  for (const cada of raw) {
    if (!cada || typeof cada !== 'object') continue
    const i = cada as Record<string, unknown>
    const texto =
      typeof i.textoOriginal === 'string' ? i.textoOriginal.trim() : ''
    if (texto === '') continue
    const cantidad =
      typeof i.cantidad === 'number' && Number.isFinite(i.cantidad) && i.cantidad > 0
        ? i.cantidad
        : 1
    const unidad =
      typeof i.unidad === 'string' && i.unidad.trim() !== ''
        ? i.unidad.trim()
        : 'NIU'
    const codigo =
      typeof i.codigo === 'string' && i.codigo.trim() !== ''
        ? i.codigo.trim()
        : null
    const confidence = i.confidence === 'high' ? 'high' : 'low'
    items.push({ textoOriginal: texto, cantidad, unidad, codigo, confidence })
  }
  return items
}

export async function extraerListaPdf(
  peticion: PeticionDeExtraerPdf,
  deps: DependenciasDeExtraerPdf = {},
): Promise<ResultadoDeListaPdf> {
  const leer =
    deps.leerMedio ??
    (async (url: string) => leerMedioDeStorage(url, 'pdf'))
  const medio = await leer(peticion.medioUrl)
  if (!esPdf(medio.mimeType)) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'no_es_pdf' })
  }

  const bytes =
    medio.bytes ?? bytesDesdeBase64(medio.dataBase64)
  if (bytes.byteLength > TECHO_PDF_BYTES) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'pdf_demasiado_grande' })
  }

  const via = deps.forzarVia ?? viaParaTamano(bytes.byteLength)
  const payload = construirPayloadDePdf({ via, dataBase64: medio.dataBase64 })
  console.info(
    `[SuitPay] extraerListaPdf via=${payload.via} mime=${payload.medio.mimeType} bytes=${bytes.byteLength}`,
  )

  const usarSimulado =
    deps.forzarSimulado === true ||
    (deps.forzarSimulado !== false && asistenciaSimuladaActiva())

  let catalogoJson = ''
  if (!usarSimulado) {
    try {
      const { textoDeCandidatosParaPrompt } = await import('./payload.ts')
      const candidatos = deps.leerCatalogo
        ? await deps.leerCatalogo()
        : await (
            await import('../aprendizaje/catalogo-compacto.ts')
          ).leerCatalogoCompactoComoCandidatos()
      if (candidatos.length > 0) {
        catalogoJson = textoDeCandidatosParaPrompt(candidatos)
      }
    } catch (error) {
      console.error('[SuitPay] extraerListaPdf: catálogo compacto no disponible', error)
    }
  }

  let json: unknown
  try {
    if (usarSimulado) {
      json = extraerPdfSimulado()
    } else {
      json = await invocarPdf({
        via,
        dataBase64: medio.dataBase64,
        bytes,
        catalogoJson,
        instrucciones: peticion.instrucciones,
        depsModelo: deps.depsModelo,
      })
    }
  } catch (error) {
    if (error instanceof ErrorDeSuitPay) throw error
    console.error('[SuitPay] extraerListaPdf: fallo inesperado', error)
    throw new ErrorDeSuitPay('asistencia_no_disponible')
  }

  if (
    json &&
    typeof json === 'object' &&
    (json as { ilegible?: unknown }).ilegible === true
  ) {
    throw new ErrorDeSuitPay('medio_ilegible')
  }

  const items = normalizarItemsPdf(json)
  const itemsFinales =
    items.length > 0
      ? items
      : [
          {
            textoOriginal: '(sin renglones interpretados)',
            cantidad: 1,
            unidad: 'NIU',
          },
        ]
  const cliente = normalizarClientePdf(
    json && typeof json === 'object'
      ? (json as { cliente?: unknown }).cliente
      : null,
  )

  const capturaId = deps.idCaptura?.() ?? randomUUID()
  const ahora = deps.ahora?.() ?? new Date()
  const creadoEn = ahora.toISOString()

  const persistir =
    deps.persistir ??
    (async (entrada) => {
      await bd()
        .collection(COLECCIONES.capturas)
        .doc(entrada.capturaId)
        .set({
          tipo: 'pdf',
          medioUrl: entrada.medioUrl,
          estado: 'propuesta',
          items: entrada.items,
          cliente: entrada.cliente,
          vendedorId: entrada.vendedorId,
          creadoEn: entrada.creadoEn,
        })
    })

  await persistir({
    capturaId,
    medioUrl: peticion.medioUrl,
    items: itemsFinales,
    cliente,
    vendedorId: peticion.vendedorId,
    creadoEn,
  })

  return {
    capturaId,
    medioUrl: peticion.medioUrl,
    items: itemsFinales,
    cliente,
  }
}

async function invocarPdf(entrada: {
  readonly via: ViaDePdf
  readonly dataBase64: string
  readonly bytes: Uint8Array
  readonly catalogoJson?: string
  readonly instrucciones?: readonly string[]
  readonly depsModelo?: DependenciasDelClienteModelo
}): Promise<unknown> {
  const prompt = promptDeListaPdf(entrada.catalogoJson, entrada.instrucciones)
  const deps = entrada.depsModelo ?? {}

  if (entrada.via === 'inline') {
    const partes: ParteGemini[] = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: entrada.dataBase64,
        },
      },
    ]
    return invocarModeloConPartes({
      partes,
      schema: SCHEMA_RESPUESTA_PDF,
      deps,
      timeoutMs: TIMEOUT_PDF_MS,
    })
  }

  const { primaria, secundaria } = clavesDeAsistencia(deps)
  const orden = [primaria, secundaria].filter(
    (c): c is string => typeof c === 'string' && c.length > 0,
  )
  if (orden.length === 0) {
    throw new ErrorDeSuitPay('asistencia_no_disponible')
  }

  let ultimoError: unknown
  for (const clave of orden) {
    const archivo = await subirPdfAGemini({
      bytes: entrada.bytes,
      clave,
      fetchFn: deps.fetchFn,
    })
    try {
      const partes: ParteGemini[] = [
        { text: prompt },
        {
          fileData: {
            mimeType: 'application/pdf',
            fileUri: archivo.uri,
          },
        },
      ]
      return await invocarModeloConPartes({
        partes,
        schema: SCHEMA_RESPUESTA_PDF,
        deps: { ...deps, clavePrimaria: clave, claveSecundaria: '' },
        timeoutMs: TIMEOUT_PDF_MS,
      })
    } catch (error) {
      ultimoError = error
    } finally {
      await borrarArchivoGemini({
        name: archivo.name,
        clave,
        fetchFn: deps.fetchFn,
      })
    }
  }
  if (ultimoError instanceof ErrorDeSuitPay) throw ultimoError
  throw new ErrorDeSuitPay('asistencia_no_disponible')
}
