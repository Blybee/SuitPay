/**
 * La clave de idempotencia.
 *
 * ## Identifica la intención de venta, no la petición
 *
 * Ésta es la distinción de la que depende que el doble clic no produzca dos
 * comprobantes, y es fácil de perder de vista al escribir el botón de emitir.
 *
 * Si la clave se generase en cada petición, dos pulsaciones darían dos claves y el
 * servidor vería dos ventas distintas: emitiría dos documentos, exactamente lo que
 * la clave existe para evitar. La clave se reclama **una vez por intención de
 * venta** y se reutiliza en cada reintento de ese mismo gesto.
 *
 * ## Por qué no se deriva del contenido de la venta
 *
 * Sería tentador usar un resumen de cliente, productos y total: se obtendría la
 * misma clave sin guardar nada. Está descartado, y el motivo es del negocio y no
 * técnico: dos ventas legítimamente idénticas el mismo día —mismo cliente, mismos
 * productos, mismo total— colisionarían, y la segunda devolvería el comprobante de
 * la primera. En un mostrador mayorista eso no es un caso de laboratorio; es un
 * martes.
 *
 * ## Por qué se genera en el cliente
 *
 * Generarla en el servidor no protegería de nada: cada petición obtendría una
 * clave distinta y el doble clic volvería a producir dos comprobantes. Tiene que
 * nacer donde nace el gesto.
 *
 * ## Cuándo se invalida
 *
 * Cuando cambia el contenido de la venta. Si el vendedor pulsa emitir, corrige una
 * cantidad y vuelve a pulsar, esa segunda pulsación es **otra venta**: reutilizar
 * la clave haría que el servidor devolviese el comprobante anterior y el vendedor
 * cobraría un total que no coincide con lo emitido. Eso lo gestiona el almacén del
 * pedido; aquí solo se generan y se validan.
 */

/** Longitud mínima que el servidor exige. Un UUID la supera con holgura. */
export const LONGITUD_MINIMA = 8

export function generarClaveDeIdempotencia(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return respaldoAleatorio()
}

/**
 * Respaldo para contextos sin `crypto.randomUUID`. No hace falta que sea
 * criptográficamente fuerte —la clave no es un secreto, solo tiene que no
 * repetirse— pero sí que no colisione entre dos dispositivos del mismo mostrador,
 * y de eso se encarga el componente aleatorio junto al reloj.
 */
function respaldoAleatorio(): string {
  const tiempo = Date.now().toString(36)
  const azar = Math.random().toString(36).slice(2, 12)
  const masAzar = Math.random().toString(36).slice(2, 12)
  return `${tiempo}-${azar}-${masAzar}`
}

export function claveEsValida(clave: string | null): clave is string {
  return clave !== null && clave.length >= LONGITUD_MINIMA
}
