/**
 * La salida impresa en A4 desde los puestos de escritorio (FR-053).
 *
 * ## SuitPay no compone el comprobante tributario
 *
 * El archivo que se imprime de una boleta o factura es **el que genera el
 * proveedor**. Componer uno propio parecería más flexible y sería un error
 * grave: abriría la posibilidad de que lo impreso y lo emitido difieran. Si el
 * documento que el cliente se lleva no es exactamente el que consta ante la
 * autoridad, la diferencia solo se descubre cuando ya importa. Y el proveedor
 * ya lo genera con el logotipo y los colores de la empresa, así que tampoco hay
 * nada que ganar.
 *
 * La nota de venta no pasa por el proveedor. Su PDF lo compone el cliente a
 * partir del comprobante interno (`pdf-nota-venta.ts`); no se sube a Storage.
 *
 * Esa decisión es la que explica la extensión de este archivo: el plan lo anotó
 * como `.tsx` suponiendo que habría una plantilla que maquetar, y al no componer
 * boletas ni facturas no hay JSX que escribir. Un `.tsx` sin marcado sería una
 * promesa falsa sobre lo que hay dentro.
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

  // Chrome trata `window.open('blob:…')` como texto del omnibox (búsqueda de
  // Google con la URL). Tampoco vale `rel=noopener`: el blob URL vive en el
  // browsing context que lo creó, y un tab sin opener no puede resolverlo.
  if (urlDelPdf.startsWith('blob:')) {
    const ventana = window.open('about:blank', '_blank')
    if (ventana !== null) {
      try {
        ventana.document.open()
        ventana.document.write(
          `<!DOCTYPE html><title>PDF</title><style>html,body,iframe{margin:0;height:100%;width:100%;border:0}</style><iframe src="${urlDelPdf}"></iframe>`,
        )
        ventana.document.close()
      } catch {
        ventana.location.href = urlDelPdf
      }
      return { ok: true }
    }
    const ancla = document.createElement('a')
    ancla.href = urlDelPdf
    ancla.target = '_blank'
    document.body.append(ancla)
    ancla.click()
    ancla.remove()
    return { ok: true }
  }

  // No pasar `noopener` en el tercer argumento: con esa feature `window.open`
  // **devuelve null aunque la pestaña abra** (el opener no recibe referencia).
  // Eso hacía saltar el toast de error con el PDF ya visible. Cortamos la
  // relación nosotros con `opener = null`.
  const ventana = window.open(urlDelPdf, '_blank')
  if (ventana === null) {
    // Bloqueador de ventanas emergentes. Se informa en lugar de fallar en
    // silencio, porque el vendedor está esperando ver salir un papel.
    return { ok: false, motivo: 'no_se_pudo_abrir' }
  }

  ventana.opener = null
  return { ok: true }
}
