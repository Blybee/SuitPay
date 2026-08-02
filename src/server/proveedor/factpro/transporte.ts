import {
  fallo
  
  
  
} from '../interfaz.ts'
import type {ClaseDeFallo, RastroDelProveedor, Resultado} from '../interfaz.ts';

/**
 * El transporte hacia el proveedor: autenticación, tiempos de espera y —lo más
 * importante— la clasificación de lo que sale mal.
 *
 * ## La clasificación es la pieza que impide el comprobante duplicado
 *
 * De las tres clases de fallo depende la garantía del principio II, y la
 * distinción no es cosmética:
 *
 * - `rechazo_definitivo`: se sabe con certeza que **no** se emitió.
 * - `indisponible`: se sabe con certeza que **no llegó a procesar**.
 * - `indeterminado`: no se puede saber. **Prohibido reintentar.**
 *
 * ## Hallazgos T027 (2026-07-29, entorno de demostración)
 *
 * Observado en vivo:
 * - Número explícito **respetado** (`data.numero` = `F001-900001` al enviar `900001`).
 * - Errores llegan como HTTP **404** con
 *   `{"exito":false,"errors":[{"message":"…"}]}` — **sin código numérico**.
 * - Mensajes vistos: `"Documento no encontrado."` (consulta) y
 *   `"El documento ya está registrado."` (reemisión del mismo número).
 *
 * Clasificación: 404 → `rechazo_definitivo` (no se emitió de más / no reintentar
 * como si fuera indisponible). El matiz entre "no existe" y "ya registrado" vive
 * en `errors[].message` y lo consume quien llama (p. ej. consulta → `existe: false`).
 * Ante `exito: false` en un 200 sin mensaje reconocible, se mantiene
 * `indeterminado` (conservador).
 */

/**
 * Tiempo de espera explícito y corto. Una espera indefinida en el mostrador es
 * peor que un estado indeterminado bien gestionado, porque bloquea al vendedor
 * con el cliente delante.
 */
const ESPERA_POR_OMISION_MS = 12_000

export interface ConfiguracionDelProveedor {
  readonly urlBase: string
  readonly token: string
  readonly esperaMs?: number
}

export function leerConfiguracion(): ConfiguracionDelProveedor {
  const urlBase = process.env.PROVEEDOR_URL_BASE
  const token = process.env.PROVEEDOR_TOKEN

  if (urlBase === undefined || urlBase === '') {
    throw new Error('Falta PROVEEDOR_URL_BASE')
  }
  if (token === undefined || token === '') {
    throw new Error('Falta PROVEEDOR_TOKEN')
  }

  return { urlBase: urlBase.replace(/\/$/, ''), token }
}

interface RespuestaCruda {
  readonly estadoHttp: number
  readonly cuerpo: string
  readonly json: unknown
}

/**
 * Recorta el cuerpo antes de guardarlo en la traza. Un HTML de error de 200 KB
 * en cada intento fallido engordaría el documento del comprobante sin aportar
 * nada que no diga el primer párrafo.
 */
function recortar(texto: string, maximo = 2_000): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}…[recortado]`
}

function mensajeDeErrors(objeto: Record<string, unknown> | undefined): string | undefined {
  const errors = objeto?.['errors']
  if (!Array.isArray(errors) || errors.length === 0) return undefined
  const primero = errors[0]
  if (typeof primero === 'object' && primero !== null) {
    const message = (primero as Record<string, unknown>)['message']
    if (typeof message === 'string') return message
  }
  return undefined
}

function rastroDe(respuesta: RespuestaCruda): RastroDelProveedor {
  const json = respuesta.json
  const objeto =
    typeof json === 'object' && json !== null
      ? (json as Record<string, unknown>)
      : undefined

  const codigo = objeto?.['codigo'] ?? objeto?.['code'] ?? objeto?.['sunat_code']
  const mensaje =
    mensajeDeErrors(objeto) ??
    objeto?.['mensaje'] ??
    objeto?.['message'] ??
    objeto?.['error'] ??
    // Host de consultas RUC/DNI: `{ "detail": "Token incorrecto" }`
    objeto?.['detail']

  return {
    codigoOriginal: typeof codigo === 'string' ? codigo : undefined,
    mensajeOriginal: typeof mensaje === 'string' ? mensaje : undefined,
    cuerpoOriginal: recortar(respuesta.cuerpo),
    estadoHttp: respuesta.estadoHttp,
  }
}

/**
 * Clasifica una respuesta que **sí llegó** pero que no indica éxito.
 *
 * T027: los rechazos de negocio observados usan HTTP 404 + `errors[].message`,
 * sin código propio. 404 se trata como rechazo definitivo.
 */
function clasificarRespuestaFallida(respuesta: RespuestaCruda): {
  clase: ClaseDeFallo
  razon: string
} {
  const codigo = respuesta.estadoHttp
  const mensaje = rastroDe(respuesta).mensajeOriginal?.toLowerCase() ?? ''

  // Autenticación o autorización: es un fallo nuestro de configuración y desde
  // luego no se emitió nada. No se reintenta, se arregla.
  if (codigo === 401 || codigo === 403) {
    return { clase: 'rechazo_definitivo', razon: `credenciales_rechazadas_${codigo}` }
  }

  // Número ya usado (T027): rechazo definitivo — no reintentar con el mismo número.
  if (mensaje.includes('ya está registrado')) {
    return { clase: 'rechazo_definitivo', razon: 'numero_ya_registrado' }
  }

  // El proveedor entendió la petición y la considera inválida. No se emitió.
  if (codigo === 400 || codigo === 404 || codigo === 409 || codigo === 422) {
    return { clase: 'rechazo_definitivo', razon: `peticion_rechazada_${codigo}` }
  }

  // Límite de peticiones o mantenimiento declarado: no llegó a procesar.
  if (codigo === 429 || codigo === 503) {
    return { clase: 'indisponible', razon: `no_puede_atender_${codigo}` }
  }

  // 500, 502, 504 y todo lo demás: contestó con un error de su lado y **no se
  // puede saber si alcanzó a registrar el documento antes de fallar**. Es
  // exactamente el caso en que reintentar produce el duplicado.
  return { clase: 'indeterminado', razon: `respuesta_no_concluyente_${codigo}` }
}

/**
 * Clasifica un fallo de red, en el que no hubo respuesta.
 *
 * La distinción crítica está aquí: si la petición **nunca salió**, no se emitió
 * nada y la venta puede quedar en espera; si salió y se cortó, el documento
 * puede existir. Como desde el cliente HTTP no siempre se puede distinguir una
 * cosa de la otra, se opta por la conservadora salvo en los casos en que el
 * error es inequívocamente de conexión no establecida.
 */
function clasificarFalloDeRed(error: unknown): {
  clase: ClaseDeFallo
  razon: string
  mensaje: string
} {
  const mensaje = error instanceof Error ? error.message : String(error)
  const nombre = error instanceof Error ? error.name : ''

  // Nombre de dominio que no resuelve o conexión rechazada: la petición no
  // llegó a salir, así que no hay nada registrado del otro lado.
  const causa = (error as { cause?: { code?: string } }).cause
  const codigoDeSistema = causa?.code ?? ''
  if (
    codigoDeSistema === 'ENOTFOUND' ||
    codigoDeSistema === 'ECONNREFUSED' ||
    codigoDeSistema === 'EAI_AGAIN'
  ) {
    return {
      clase: 'indisponible',
      razon: `conexion_no_establecida_${codigoDeSistema}`,
      mensaje,
    }
  }

  // Espera agotada o conexión cortada: la petición pudo llegar y ser procesada.
  if (nombre === 'AbortError' || nombre === 'TimeoutError') {
    return { clase: 'indeterminado', razon: 'tiempo_de_espera_agotado', mensaje }
  }

  return { clase: 'indeterminado', razon: 'fallo_de_red_no_concluyente', mensaje }
}

export interface RespuestaDelProveedor {
  readonly json: unknown
  readonly rastro: RastroDelProveedor
}

export interface OpcionesDePeticion {
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Si es `undefined` y el método no es GET, se envía `{}`. GET no lleva cuerpo. */
  readonly cuerpo?: unknown
}

/**
 * Hace una petición al proveedor. **No reintenta.** Reintentar es una decisión de
 * la lógica de emisión, que es la única que conoce el estado del comprobante.
 */
export async function pedirAlProveedor(
  configuracion: ConfiguracionDelProveedor,
  ruta: string,
  cuerpoOOpciones: unknown = {},
): Promise<Resultado<RespuestaDelProveedor>> {
  const espera = configuracion.esperaMs ?? ESPERA_POR_OMISION_MS
  const opciones = esOpcionesDePeticion(cuerpoOOpciones)
    ? cuerpoOOpciones
    : { metodo: 'POST' as const, cuerpo: cuerpoOOpciones }
  const metodo = opciones.metodo ?? 'POST'
  const cuerpo = opciones.cuerpo

  let respuesta: Response
  try {
    respuesta = await fetch(`${configuracion.urlBase}${ruta}`, {
      method: metodo,
      headers: {
        // El token no aparece en ningún rastro ni en ningún resultado.
        Authorization: `Bearer ${configuracion.token}`,
        ...(metodo === 'GET'
          ? { Accept: 'application/json' }
          : {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            }),
      },
      ...(metodo === 'GET' || metodo === 'DELETE'
        ? {}
        : { body: JSON.stringify(cuerpo ?? {}) }),
      signal: AbortSignal.timeout(espera),
    })
  } catch (error) {
    const clasificado = clasificarFalloDeRed(error)
    return fallo(clasificado.clase, clasificado.razon, {
      codigoOriginal: undefined,
      mensajeOriginal: clasificado.mensaje,
      cuerpoOriginal: undefined,
      estadoHttp: undefined,
    })
  }

  const cuerpoTexto = await respuesta.text()
  let json: unknown
  try {
    json = JSON.parse(cuerpoTexto)
  } catch {
    json = undefined
  }

  const cruda: RespuestaCruda = {
    estadoHttp: respuesta.status,
    cuerpo: cuerpoTexto,
    json,
  }
  const rastro = rastroDe(cruda)

  if (!respuesta.ok) {
    const clasificado = clasificarRespuestaFallida(cruda)
    return fallo(clasificado.clase, clasificado.razon, rastro)
  }

  // Un 200 con cuerpo que no es JSON es un intermediario contestando por él, no
  // el proveedor. No se puede saber qué pasó con la petición.
  if (json === undefined) {
    return fallo('indeterminado', 'respuesta_no_es_json', rastro)
  }

  // `exito: false` dentro de un 200 (poco visto en T027; los rechazos fueron 404).
  const objeto =
    typeof json === 'object' && json !== null
      ? (json as Record<string, unknown>)
      : undefined
  if (objeto?.['exito'] === false) {
    const mensaje = (rastro.mensajeOriginal ?? '').toLowerCase()
    if (
      mensaje.includes('ya está registrado') ||
      mensaje.includes('no encontrado')
    ) {
      return fallo('rechazo_definitivo', 'exito_falso_con_mensaje', rastro)
    }
    return fallo('indeterminado', 'exito_falso_sin_codigo', rastro)
  }

  return { ok: true, valor: { json, rastro } }
}

function esOpcionesDePeticion(valor: unknown): valor is OpcionesDePeticion {
  if (valor === null || typeof valor !== 'object') return false
  const metodo = (valor as Record<string, unknown>)['metodo']
  return (
    metodo === 'GET' ||
    metodo === 'POST' ||
    metodo === 'PUT' ||
    metodo === 'DELETE'
  )
}
