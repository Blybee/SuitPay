import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { Coincidencia, ResultadoDeBusqueda } from './productos.ts'
import {
  LONGITUD_MINIMA_TERMINO,
  normalizar,
  terminosDeConsulta,
} from './productos.ts'

const DISTANCIA_MAXIMA_UTILIZABLE = 0.5
const DISTANCIA_EXACTA = 0.02
const DISTANCIA_FUERTE = 0.28

export interface CotizacionPorNombre {
  readonly id: string
  readonly cliente: { readonly denominacion: string } | null
}

interface CotizacionBuscable<T extends CotizacionPorNombre> {
  readonly cotizacion: T
  readonly nombreNormalizado: string
}

export function cotizacionTieneNombreDeCliente(
  cotizacion: CotizacionPorNombre,
): boolean {
  const nombre = cotizacion.cliente?.denominacion.trim() ?? ''
  if (nombre.length === 0) return false
  return normalizar(nombre) !== normalizar('Sin cliente')
}

function gradoDe(distancia: number): Coincidencia<unknown>['grado'] {
  if (distancia <= DISTANCIA_EXACTA) return 'exacta'
  if (distancia <= DISTANCIA_FUERTE) return 'fuerte'
  return 'aproximada'
}

function distanciasPorTermino<T extends CotizacionPorNombre>(
  fuse: Fuse<CotizacionBuscable<T>>,
  termino: string,
): Map<string, { item: CotizacionBuscable<T>; distancia: number }> {
  const encontrados = new Map<
    string,
    { item: CotizacionBuscable<T>; distancia: number }
  >()
  for (const resultado of fuse.search(termino)) {
    const distancia = resultado.score ?? 1
    if (distancia > DISTANCIA_MAXIMA_UTILIZABLE) continue
    const id = resultado.item.cotizacion.id
    const yaEstaba = encontrados.get(id)
    if (yaEstaba === undefined || distancia < yaEstaba.distancia) {
      encontrados.set(id, { item: resultado.item, distancia })
    }
  }
  return encontrados
}

/**
 * Coincidencia aproximada por nombre de cliente. Ignora cotizaciones sin
 * denominación y las etiquetadas «Sin cliente».
 */
export function buscarCotizacionesPorNombre<T extends CotizacionPorNombre>(
  cotizaciones: readonly T[],
  termino: string,
  limite = 12,
): ResultadoDeBusqueda<T> {
  const terminoLimpio = normalizar(termino)
  const conNombre = cotizaciones.filter(cotizacionTieneNombreDeCliente)

  if (terminoLimpio.length === 0) {
    return {
      coincidencias: [],
      sinCoincidencias: true,
      soloAproximadas: false,
      termino: terminoLimpio,
    }
  }

  const terminos = terminosDeConsulta(terminoLimpio)
  if (terminos.length === 0) {
    return {
      coincidencias: [],
      sinCoincidencias: true,
      soloAproximadas: false,
      termino: terminoLimpio,
    }
  }

  const items: CotizacionBuscable<T>[] = conNombre.map((cotizacion) => ({
    cotizacion,
    nombreNormalizado: normalizar(cotizacion.cliente?.denominacion ?? ''),
  }))
  const opciones: IFuseOptions<CotizacionBuscable<T>> = {
    keys: [{ name: 'nombreNormalizado', weight: 1 }],
    includeScore: true,
    ignoreLocation: true,
    ignoreDiacritics: true,
    threshold: DISTANCIA_MAXIMA_UTILIZABLE,
    minMatchCharLength: LONGITUD_MINIMA_TERMINO,
  }
  const fuse = new Fuse(items, opciones)

  let candidatos = distanciasPorTermino(fuse, terminos[0] ?? terminoLimpio)
  const distanciasAcumuladas = new Map<string, number[]>()
  for (const [id, encontrado] of candidatos) {
    distanciasAcumuladas.set(id, [encontrado.distancia])
  }

  for (const cadaTermino of terminos.slice(1)) {
    const delTermino = distanciasPorTermino(fuse, cadaTermino)
    const sobreviven = new Map<
      string,
      { item: CotizacionBuscable<T>; distancia: number }
    >()
    for (const [id, encontrado] of candidatos) {
      const enEste = delTermino.get(id)
      if (enEste === undefined) continue
      sobreviven.set(id, encontrado)
      distanciasAcumuladas.get(id)?.push(enEste.distancia)
    }
    candidatos = sobreviven
    if (candidatos.size === 0) break
  }

  const coincidencias = [...candidatos.values()]
    .map((encontrado) => {
      const distancias = distanciasAcumuladas.get(
        encontrado.item.cotizacion.id,
      ) ?? [encontrado.distancia]
      const media =
        distancias.reduce((suma, cada) => suma + cada, 0) / distancias.length
      return {
        elemento: encontrado.item.cotizacion,
        distancia: media,
        grado: gradoDe(media),
      }
    })
    .sort((uno, otro) => uno.distancia - otro.distancia)
    .slice(0, limite)

  return {
    coincidencias,
    sinCoincidencias: coincidencias.length === 0,
    soloAproximadas:
      coincidencias.length > 0 &&
      coincidencias.every((coincidencia) => coincidencia.grado === 'aproximada'),
    termino: terminoLimpio,
  }
}
