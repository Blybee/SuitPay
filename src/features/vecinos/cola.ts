/**
 * Una cola por clave: la siguiente mutación no arranca hasta que la anterior
 * termina (éxito o fallo). Evita que dos altas rápidas pisen líneas.
 */
const colas = new Map<string, Promise<unknown>>()

export function encolarPorClave<T>(
  clave: string,
  trabajo: () => Promise<T>,
): Promise<T> {
  const previa = colas.get(clave) ?? Promise.resolve()
  const actual = previa.then(trabajo, trabajo)
  colas.set(
    clave,
    actual.then(
      () => undefined,
      () => undefined,
    ),
  )
  return actual
}
