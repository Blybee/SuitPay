import type { Firestore } from 'firebase-admin/firestore'
import type { Rol } from '../auth/verificar.ts'
import { bd, COLECCIONES } from '../firebase/admin.ts'

const ROLES_MCP = ['administrador', 'jefe'] as const satisfies readonly Rol[]

export interface FichaAdmitida {
  readonly uid: string
  readonly rol: (typeof ROLES_MCP)[number]
}

export type ResultadoDeFicha =
  | { readonly estado: 'admitida'; readonly ficha: FichaAdmitida }
  | { readonly estado: 'rechazada' }

export function crearCargadorDeUsuarios(opciones: {
  readonly cacheMs: number
  readonly base?: Firestore
  readonly ahora?: () => number
}): (uid: string) => Promise<ResultadoDeFicha> {
  const cache = new Map<string, { ficha: FichaAdmitida; vence: number }>()
  const ahora = opciones.ahora ?? Date.now
  const base = () => opciones.base ?? bd()

  return async (uid) => {
    const momento = ahora()
    const guardada = cache.get(uid)
    if (guardada !== undefined && guardada.vence > momento) {
      return { estado: 'admitida', ficha: guardada.ficha }
    }

    const instantanea = await base()
      .collection(COLECCIONES.usuarios)
      .doc(uid)
      .get()
    if (!instantanea.exists) {
      cache.delete(uid)
      return { estado: 'rechazada' }
    }

    const datos = instantanea.data() ?? {}
    const rol = datos['rol']
    if (!esRolMcp(rol) || datos['activo'] !== true) {
      cache.delete(uid)
      return { estado: 'rechazada' }
    }

    const ficha: FichaAdmitida = { uid, rol }
    cache.set(uid, { ficha, vence: momento + opciones.cacheMs })
    return { estado: 'admitida', ficha }
  }
}

function esRolMcp(valor: unknown): valor is FichaAdmitida['rol'] {
  return (
    typeof valor === 'string' &&
    (ROLES_MCP as readonly string[]).includes(valor)
  )
}
