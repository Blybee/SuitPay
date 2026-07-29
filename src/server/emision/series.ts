import { consumeSerieRegulada, serieEsValida } from '../../domain/documentos/tipos.ts'
import type { TipoDeDocumento } from '../../domain/documentos/tipos.ts'
import { fallar } from '../errores.ts'
import { idDeSerie   } from './almacen.ts'
import type {Serie, TransaccionDeEmision} from './almacen.ts';

/**
 * El consumo del correlativo.
 *
 * ## Por qué un correlativo consumido nunca se devuelve
 *
 * Éste es el punto que más se malinterpreta, así que conviene decirlo sin rodeos:
 * cuando una emisión falla, **el número consumido no se recupera**. Queda un
 * hueco en la secuencia, y eso es lo correcto.
 *
 * La razón es que devolver el número exigiría saber con certeza que el proveedor
 * no lo usó, y precisamente lo que caracteriza al caso peligroso es que **no se
 * puede saber**. Si se devolviera el número y el proveedor sí lo había registrado,
 * la siguiente venta reclamaría un número ya emitido: dos documentos fiscales
 * distintos con la misma numeración. Un hueco se explica ante una fiscalización;
 * un número repetido no.
 *
 * De ahí FR-030: todo consumo se registra, incluidos los que acaban en fallo.
 *
 * ## Los dos contadores
 *
 * `ultimoNumero` es lo reclamado y `ultimoNumeroConfirmado` es lo que se sabe
 * emitido. La distancia entre ambos es exactamente el conjunto de números cuya
 * suerte está por determinar, y es de donde arranca el sondeo de la
 * reconciliación cuando el proveedor no acepta números explícitos.
 */

export interface CorrelativoReclamado {
  readonly serieId: string
  readonly serie: string
  readonly numero: number
}

/**
 * Reclama el siguiente correlativo dentro de la transacción.
 *
 * Falla con `serie_no_configurada` **antes de tocar nada**, que es lo que FR-031
 * exige: un vendedor sin serie asignada tiene que enterarse antes de que el
 * sistema haya modificado un contador o llamado al proveedor.
 */
export async function reclamarCorrelativo(
  transaccion: TransaccionDeEmision,
  vendedorId: string,
  tipo: TipoDeDocumento,
): Promise<CorrelativoReclamado> {
  const serieId = idDeSerie(vendedorId, tipo)
  const serie = await transaccion.leerSerie(serieId)

  if (serie === undefined || !serie.activa) {
    fallar('serie_no_configurada', { tipoDocumento: tipo })
  }

  comprobarCoherencia(serie, tipo, vendedorId)

  const numero = serie.ultimoNumero + 1
  transaccion.consumirCorrelativo(serieId, numero)

  return { serieId, serie: serie.serie, numero }
}

/**
 * Comprueba que la serie configurada encaje con lo que se le pide. Son fallos de
 * configuración, no del vendedor, y por eso se detectan aquí en lugar de
 * confiarse a la pantalla de administración: esa pantalla puede cambiar, y una
 * serie mal formada llegaría al proveedor y volvería como un rechazo con un
 * mensaje que nadie sabría interpretar.
 */
function comprobarCoherencia(
  serie: Serie,
  tipo: TipoDeDocumento,
  vendedorId: string,
): void {
  if (serie.tipoDocumento !== tipo || serie.vendedorId !== vendedorId) {
    fallar('serie_no_configurada', { tipoDocumento: tipo })
  }
  if (!serieEsValida(tipo, serie.serie)) {
    fallar('serie_no_configurada', { tipoDocumento: tipo, serie: serie.serie })
  }
}

/**
 * Los documentos sin valor tributario no consumen numeración regulada. Gastar un
 * número de la serie de boletas en un papel que no existe ante la autoridad
 * abriría un hueco que después habría que justificar sin tener con qué.
 */
export function necesitaCorrelativoRegulado(tipo: TipoDeDocumento): boolean {
  return consumeSerieRegulada(tipo)
}

/** Cuántos números están reclamados y sin confirmar. Acota el sondeo. */
export function correlativosEnDuda(serie: Serie): number {
  return Math.max(0, serie.ultimoNumero - serie.ultimoNumeroConfirmado)
}
