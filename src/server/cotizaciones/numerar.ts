import { FieldValue } from 'firebase-admin/firestore'
import { bd, DOCUMENTOS } from '../firebase/admin.ts'

/**
 * Reserva el siguiente número legible de cotización.
 *
 * Vive en el servidor porque el contador no puede escribirlo el cliente
 * (`config/*` es de solo lectura en las reglas). Un entero monótono basta:
 * se pide por voz o por comando (FR-016), no es correlativo tributario.
 */

export async function reservarNumeroCotizacion(): Promise<number> {
  const [coleccion, documento] = DOCUMENTOS.contadorCotizaciones.split('/')
  const referencia = bd()
    .collection(coleccion ?? 'config')
    .doc(documento ?? 'contadorCotizaciones')

  return bd().runTransaction(async (tx) => {
    const instantanea = await tx.get(referencia)
    const ultimo =
      typeof instantanea.data()?.['ultimoNumero'] === 'number'
        ? (instantanea.data()?.['ultimoNumero'] as number)
        : 0
    const siguiente = ultimo + 1

    if (instantanea.exists) {
      tx.update(referencia, { ultimoNumero: siguiente })
    } else {
      tx.set(referencia, {
        ultimoNumero: siguiente,
        actualizadoEn: FieldValue.serverTimestamp(),
      })
    }

    return siguiente
  })
}
