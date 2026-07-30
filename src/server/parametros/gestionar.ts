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
}

function refParametros() {
  const [coleccion, documento] = DOCUMENTOS.parametros.split('/')
  return bd()
    .collection(coleccion ?? COLECCIONES.config)
    .doc(documento ?? 'parametros')
}

export async function leerParametros(): Promise<Parametros> {
  const instantanea = await refParametros().get()
  if (!instantanea.exists) return POR_DEFECTO
  const datos = instantanea.data() ?? {}
  const parseado = esquemaDeParametros.safeParse({
    umbralIdentificacionBoleta:
      datos['umbralIdentificacionBoleta'] ??
      POR_DEFECTO.umbralIdentificacionBoleta,
    ventanaAnulacion:
      datos['ventanaAnulacion'] ?? POR_DEFECTO.ventanaAnulacion,
    formatoImpresionPorDefecto:
      datos['formatoImpresionPorDefecto'] ??
      POR_DEFECTO.formatoImpresionPorDefecto,
  })
  return parseado.success ? parseado.data : POR_DEFECTO
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
