import { doc, getDoc } from 'firebase/firestore'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'
import type { Cliente } from '../../domain/esquemas/comunes.ts'

/**
 * Comprobación de existencia por identificador directo (data-model).
 * Una lectura `clientes/{numeroDocumento}`; sin consulta ni índice.
 */

export type ClienteExistente = Pick<
  Cliente,
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'denominacion'
  | 'direccion'
  | 'ubigeo'
  | 'condicion'
> & {
  readonly instruccionesCotizacion?: readonly string[]
}

export async function leerClientePorDocumento(
  numeroDocumento: string,
): Promise<ClienteExistente | null> {
  const instantanea = await getDoc(
    doc(obtenerBaseDeDatos(), 'clientes', numeroDocumento.trim()),
  )
  if (!instantanea.exists()) return null

  const datos = instantanea.data()
  return {
    tipoDocumento: String(datos['tipoDocumento'] ?? 'RUC') as Cliente['tipoDocumento'],
    numeroDocumento: String(datos['numeroDocumento'] ?? numeroDocumento),
    denominacion: String(datos['denominacion'] ?? ''),
    direccion:
      typeof datos['direccion'] === 'string' ? datos['direccion'] : undefined,
    ubigeo: typeof datos['ubigeo'] === 'string' ? datos['ubigeo'] : undefined,
    condicion:
      typeof datos['condicion'] === 'string' ? datos['condicion'] : undefined,
    instruccionesCotizacion: Array.isArray(datos['instruccionesCotizacion'])
      ? datos['instruccionesCotizacion'].filter(
          (n): n is string => typeof n === 'string' && n.trim() !== '',
        )
      : undefined,
  }
}
