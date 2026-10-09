import { doc, getDoc } from 'firebase/firestore'
import type {
  FichaDeCliente,
  FichaDeTransportista,
} from '../../domain/padron/edicion.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

/**
 * Una lectura del documento al abrir la ficha. La grilla no la pide.
 */

export async function leerFichaDeCliente(
  numeroDocumento: string,
): Promise<FichaDeCliente | null> {
  const instantanea = await getDoc(
    doc(obtenerBaseDeDatos(), 'clientes', numeroDocumento.trim()),
  )
  if (!instantanea.exists()) return null
  const datos = instantanea.data()
  return {
    direccion: texto(datos, 'direccion'),
    telefono: texto(datos, 'telefono'),
    correo: texto(datos, 'correo'),
    ubigeo: texto(datos, 'ubigeo'),
    condicion: texto(datos, 'condicion'),
  }
}

export async function leerFichaDeTransportista(
  numeroDocumento: string,
): Promise<FichaDeTransportista | null> {
  const instantanea = await getDoc(
    doc(obtenerBaseDeDatos(), 'transportistas', numeroDocumento.trim()),
  )
  if (!instantanea.exists()) return null
  const datos = instantanea.data()
  return {
    direccion: texto(datos, 'direccion'),
    numeroRegistroMtc: texto(datos, 'numeroRegistroMtc'),
  }
}

function texto(datos: Record<string, unknown>, campo: string): string {
  const valor = datos[campo]
  return typeof valor === 'string' ? valor : ''
}
