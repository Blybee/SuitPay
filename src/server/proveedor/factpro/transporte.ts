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
 * ## La incógnita que T027 tiene que cerrar
 *
 * La respuesta de error documentada del proveedor es `{"exito": false, "mensaje":
 * null}`, **sin código de error**. Sin un código estable, distinguir un rechazo
 * definitivo de una indisponibilidad tiene que apoyarse en el código de estado
 * HTTP y en la diferencia entre "se agotó la espera" y "contestó", que es más
 * frágil. Ésa es hoy la incógnita más valiosa del proyecto y se resuelve
 * provocando fallos en su entorno de demostración y observando qué llega.
 *
 * Mientras no esté resuelta, la clasificación de aquí es **deliberadamente
 * conservadora**, y eso no es una suposición temporal: es lo que el contrato de
 * frontera manda. Ante la duda, `indeterminado`. Cuesta una consulta de
 * reconciliación, mientras que equivocarse al contrario cuesta un documento
 * fiscal de más y su anulación.
 *
 * Los bloques marcados con `PENDIENTE DE T027` son los que hay que revisar
 * cuando haya observaciones reales, no reescribir de cero.
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

function rastroDe(respuesta: RespuestaCruda): RastroDelProveedor {
  const json = respuesta.json
  const objeto =
    typeof json === 'object' && json !== null
      ? (json as Record<string, unknown>)
      : undefined

  const codigo = objeto?.['codigo'] ?? objeto?.['code'] ?? objeto?.['sunat_code']
  const mensaje = objeto?.['mensaje'] ?? objeto?.['message'] ?? objeto?.['error']

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
 * PENDIENTE DE T027: la separación se apoya hoy en el código de estado HTTP
 * porque no hay código de error propio del proveedor en el que apoyarse.
 */
function clasificarRespuestaFallida(respuesta: RespuestaCruda): {
  clase: ClaseDeFallo
  razon: string
} {
  const codigo = respuesta.estadoHttp

  // Autenticación o autorización: es un fallo nuestro de configuración y desde
  // luego no se emitió nada. No se reintenta, se arregla.
  if (codigo === 401 || codigo === 403) {
    return { clase: 'rechazo_definitivo', razon: `credenciales_rechazadas_${codigo}` }
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

/**
 * Hace una petición al proveedor. **No reintenta.** Reintentar es una decisión de
 * la lógica de emisión, que es la única que conoce el estado del comprobante.
 */
export async function pedirAlProveedor(
  configuracion: ConfiguracionDelProveedor,
  ruta: string,
  cuerpo: unknown,
): Promise<Resultado<RespuestaDelProveedor>> {
  const espera = configuracion.esperaMs ?? ESPERA_POR_OMISION_MS

  let respuesta: Response
  try {
    respuesta = await fetch(`${configuracion.urlBase}${ruta}`, {
      method: 'POST',
      headers: {
        // El token no aparece en ningún rastro ni en ningún resultado.
        Authorization: `Bearer ${configuracion.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(cuerpo),
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

  // Su convenio: `exito: false` dentro de un 200. Sin código de error, así que
  // no hay forma de distinguir un rechazo de una indisponibilidad.
  //
  // PENDIENTE DE T027: aquí es donde más se nota la falta del código. Se
  // clasifica como indeterminado por ser la opción conservadora, aunque en la
  // práctica la mayoría de estos casos serán rechazos. Cuando T027 aporte
  // observaciones reales, esta rama se podrá afinar y muchos de estos fallos
  // pasarán a `rechazo_definitivo`, que es más útil porque permite corregir y
  // volver a emitir en el momento.
  const objeto =
    typeof json === 'object' && json !== null
      ? (json as Record<string, unknown>)
      : undefined
  if (objeto?.['exito'] === false) {
    return fallo('indeterminado', 'exito_falso_sin_codigo', rastro)
  }

  return { ok: true, valor: { json, rastro } }
}
