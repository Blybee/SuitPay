/**
 * La salida impresa en A4 desde los puestos de escritorio (FR-053).
 *
 * ## SuitPay no compone el comprobante
 *
 * El archivo que se imprime es **el que genera el proveedor**. Componer uno propio
 * parecería más flexible y sería un error grave: abriría la posibilidad de que lo
 * impreso y lo emitido difieran. Si el documento que el cliente se lleva no es
 * exactamente el que consta ante la autoridad, la diferencia solo se descubre
 * cuando ya importa. Y el proveedor ya lo genera con el logotipo y los colores de
 * la empresa, así que tampoco hay nada que ganar.
 *
 * Esa decisión es la que explica la extensión de este archivo: el plan lo anotó
 * como `.tsx` suponiendo que habría una plantilla que maquetar, y al no componer
 * nada no hay JSX que escribir. Un `.tsx` sin marcado sería una promesa falsa
 * sobre lo que hay dentro.
 *
 * ## Un fallo de impresión no toca la emisión
 *
 * FR-055, y es la razón por la que reimprimir es una operación aparte y no un
 * reintento de emitir. El papel se atasca, la impresora está sin tóner, alguien
 * cancela el diálogo: todo eso es normal y nada de eso puede invalidar ni repetir
 * un documento que ya existe ante la autoridad. Aquí no hay ni una línea que
 * escriba en el comprobante.
 */

export type ResultadoDeImpresion =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: 'sin_archivo' | 'no_se_pudo_abrir' }

/**
 * Abre el documento para imprimir.
 *
 * Se abre en una pestaña y se deja que el navegador y el sistema hagan el resto,
 * en lugar de intentar `window.print()` sobre un iframe. La razón es práctica: el
 * vendedor a veces necesita elegir bandeja o impresora, y un diálogo propio que
 * "simplifica" el proceso acaba siendo el que no deja hacer lo que hace falta.
 */
export function imprimirDocumento(urlDelPdf: string | null): ResultadoDeImpresion {
  if (urlDelPdf === null || urlDelPdf === '') {
    return { ok: false, motivo: 'sin_archivo' }
  }

  const ventana = window.open(urlDelPdf, '_blank', 'noopener,noreferrer')
  if (ventana === null) {
    // Bloqueador de ventanas emergentes. Se informa en lugar de fallar en
    // silencio, porque el vendedor está esperando ver salir un papel.
    return { ok: false, motivo: 'no_se_pudo_abrir' }
  }

  return { ok: true }
}
