import { bd, DOCUMENTOS } from '../firebase/admin.ts'

const TTL_MS = 10 * 60 * 1000

let cache: { readonly en: number; readonly nombres: readonly string[] } | undefined

/** Una lectura de `indices/clientes`. Las siguientes, dentro del TTL, no vuelven a Firestore. */
export async function leerNombresDeClientes(): Promise<readonly string[]> {
  if (cache !== undefined && Date.now() - cache.en < TTL_MS) return cache.nombres
  const [coleccion, id] = DOCUMENTOS.indiceDeClientes.split('/')
  const instantanea = await bd()
    .collection(coleccion ?? 'indices')
    .doc(id ?? 'clientes')
    .get()
  const lista = instantanea.data()?.['clientes']
  const nombres: string[] = []
  if (Array.isArray(lista)) {
    for (const entrada of lista) {
      if (entrada === null || typeof entrada !== 'object') continue
      const denominacion = (entrada as { denominacion?: unknown }).denominacion
      if (typeof denominacion !== 'string') continue
      const nombre = denominacion.trim()
      if (nombre.length >= 4) nombres.push(nombre)
    }
  }
  cache = { en: Date.now(), nombres }
  return nombres
}

export function olvidarCacheDeNombres(): void {
  cache = undefined
}
