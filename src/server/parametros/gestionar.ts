import { esquemaDeParametros } from '../../domain/esquemas/comunes.ts'
import type { Parametros } from '../../domain/esquemas/comunes.ts'
import { bd, COLECCIONES, DOCUMENTOS } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'

/**
 * Lectura y edición de `config/parametros` (T085).
 */

const POR_DEFECTO: Parametros = {
  umbralIdentificacionBoleta: 70_000,
  ventanaAnulacion: 'mismo_dia',
  formatoImpresionPorDefecto: 'a4',
  iaTexto: 'openrouter',
  iaImagen: 'gemini',
}

function refParametros() {
  const [coleccion, documento] = DOCUMENTOS.parametros.split('/')
  return bd()
    .collection(coleccion ?? COLECCIONES.config)
    .doc(documento ?? 'parametros')
}

/** Rellena un documento viejo que todavía no tiene los interruptores. */
export function completarParametros(
  datos: Record<string, unknown>,
): Parametros {
  const parseado = esquemaDeParametros.safeParse({
    umbralIdentificacionBoleta:
      datos['umbralIdentificacionBoleta'] ??
      POR_DEFECTO.umbralIdentificacionBoleta,
    ventanaAnulacion:
      datos['ventanaAnulacion'] ?? POR_DEFECTO.ventanaAnulacion,
    formatoImpresionPorDefecto:
      datos['formatoImpresionPorDefecto'] ??
      POR_DEFECTO.formatoImpresionPorDefecto,
    iaTexto: datos['iaTexto'] ?? POR_DEFECTO.iaTexto,
    iaImagen: datos['iaImagen'] ?? POR_DEFECTO.iaImagen,
  })
  return parseado.success ? parseado.data : POR_DEFECTO
}

export async function leerParametros(): Promise<Parametros> {
  const instantanea = await refParametros().get()
  if (!instantanea.exists) return POR_DEFECTO
  return completarParametros(instantanea.data() ?? {})
}

export async function guardarParametros(
  entrada: Parametros,
): Promise<Parametros> {
  const parseado = esquemaDeParametros.safeParse(entrada)
  if (!parseado.success) {
    fallar('peticion_invalida', { campo: 'parametros' })
  }
  await refParametros().set(parseado.data, { merge: true })
  return parseado.data
}
