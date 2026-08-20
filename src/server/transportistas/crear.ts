import { FieldValue } from 'firebase-admin/firestore'
import { COLECCIONES, DOCUMENTOS, bd } from '../firebase/admin.ts'
import { fallar } from '../errores.ts'

export interface PeticionDeCrearTransportista {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly numeroRegistroMtc?: string
  readonly direccion?: string
  readonly consultadoEn?: string
}

export interface TransportistaCreado {
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly yaExistia: boolean
}

export async function crearTransportista(
  peticion: PeticionDeCrearTransportista,
  creadoPor: string,
): Promise<TransportistaCreado> {
  const ruc = peticion.numeroDocumento.trim()
  const denominacion = peticion.denominacion.trim()
  if (!/^\d{11}$/.test(ruc) || denominacion.length === 0) {
    fallar('peticion_invalida', { campo: 'numeroDocumento' })
  }

  const referencia = bd().collection(COLECCIONES.transportistas).doc(ruc)
  const [coleccionIndice, idIndice] = DOCUMENTOS.indiceDeTransportistas.split('/')
  const referenciaIndice = bd()
    .collection(coleccionIndice ?? COLECCIONES.indices)
    .doc(idIndice ?? 'transportistas')

  return bd().runTransaction(async (tx) => {
    const existente = await tx.get(referencia)
    if (existente.exists) {
      const datos = existente.data() ?? {}
      return {
        numeroDocumento: ruc,
        denominacion: String(datos['denominacion'] ?? denominacion),
        yaExistia: true,
      }
    }

    const indiceSnap = await tx.get(referenciaIndice)
    const listaActual: Array<{ numeroDocumento: string; denominacion: string }> =
      indiceSnap.exists
        ? ((indiceSnap.data()?.['transportistas'] as
            | Array<{ numeroDocumento: string; denominacion: string }>
            | undefined) ?? [])
        : []

    const yaEnIndice = listaActual.some((cada) => cada.numeroDocumento === ruc)
    const listaNueva = yaEnIndice
      ? listaActual
      : [...listaActual, { numeroDocumento: ruc, denominacion }]

    const documento: Record<string, unknown> = {
      tipoDocumento: 'RUC',
      numeroDocumento: ruc,
      denominacion,
      creadoPor,
      creadoEn: FieldValue.serverTimestamp(),
    }
    if (peticion.numeroRegistroMtc !== undefined) {
      documento['numeroRegistroMtc'] = peticion.numeroRegistroMtc
    }
    if (peticion.direccion !== undefined) documento['direccion'] = peticion.direccion
    if (peticion.consultadoEn !== undefined) {
      documento['consultadoEn'] = new Date(peticion.consultadoEn)
    }

    tx.create(referencia, documento)
    tx.set(
      referenciaIndice,
      {
        version: (indiceSnap.data()?.['version'] ?? 0) + 1,
        transportistas: listaNueva,
      },
      { merge: true },
    )

    return { numeroDocumento: ruc, denominacion, yaExistia: false }
  })
}
