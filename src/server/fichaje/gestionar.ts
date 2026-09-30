import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type { DocumentData, DocumentSnapshot } from 'firebase-admin/firestore'
import { diaEnLima } from '../../domain/anulacion/ventana.ts'
import {
  claveDeNombre,
  estadoPorHoraDeEntrada,
  horaDeEntradaDe,
  horariosDesde,
  indiceDeSemanaEnLima,
  instanteDesdeFechaHoraLima,
  minutosDelDiaEnLima,
  nombreParaMostrar,
  semanaCompleta,
} from '../../domain/fichaje/reglas.ts'
import type { EstadoDeMarca } from '../../domain/fichaje/reglas.ts'
import { fallar } from '../errores.ts'
import { bd, COLECCIONES, DOCUMENTOS } from '../firebase/admin.ts'

/**
 * Fichaje de entrada. El cliente del jefe solo lee; toda escritura pasa por
 * aquí, con el Admin SDK, para que una solicitud pública no abra las reglas.
 */

const ESTADOS: readonly EstadoDeMarca[] = [
  'presente',
  'tardanza',
  'falta',
  'justificado',
]

export interface AltaManual {
  readonly nombre: string
  readonly fecha: string
  readonly hora: string
  readonly estado: EstadoDeMarca
  readonly observacion: string
}

export interface ResultadoDeSolicitud {
  readonly id: string
  readonly repetida: boolean
}

interface NombreDeRoster {
  readonly clave: string
  readonly nombre: string
}

function referenciaDeRuta(ruta: string) {
  const [coleccion, documento] = ruta.split('/')
  return bd()
    .collection(coleccion ?? 'config')
    .doc(documento ?? 'contadorFichajes')
}

function esEstado(valor: unknown): valor is EstadoDeMarca {
  return (
    typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor)
  )
}

function horaCorta(instante: Date): string {
  const minutos = minutosDelDiaEnLima(instante)
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

function leerRoster(datos: DocumentData | undefined): NombreDeRoster[] {
  const lista = datos?.['nombres']
  if (!Array.isArray(lista)) return []
  return lista.flatMap((cada) => {
    if (typeof cada !== 'object' || cada === null) return []
    const fila = cada as Record<string, unknown>
    if (
      typeof fila['clave'] !== 'string' ||
      typeof fila['nombre'] !== 'string'
    ) {
      return []
    }
    return [{ clave: fila['clave'], nombre: fila['nombre'] }]
  })
}

function ultimoNumero(datos: DocumentData | undefined): number {
  return typeof datos?.['ultimoNumero'] === 'number' ? datos['ultimoNumero'] : 0
}

function reservaDeDia(clave: string, dia: string) {
  return bd().collection(COLECCIONES.fichajeReservas).doc(`${clave}__${dia}`)
}

function candadoPendiente(clave: string) {
  return bd().collection(COLECCIONES.fichajeReservas).doc(`pendiente__${clave}`)
}

export async function solicitarEntrada(
  crudo: string,
): Promise<ResultadoDeSolicitud> {
  const nombre = nombreParaMostrar(crudo)
  if (nombre === null) fallar('peticion_invalida', { campo: 'nombre' })
  const clave = claveDeNombre(nombre)

  const id = await bd().runTransaction(async (tx) => {
    const candado = candadoPendiente(clave)
    const existente = await tx.get(candado)
    if (existente.exists) {
      const previo = existente.get('fichajeId')
      if (typeof previo === 'string') return { id: previo, repetida: true }
    }

    const ref = bd().collection(COLECCIONES.fichajes).doc()
    tx.set(ref, {
      nombre,
      nombreClave: clave,
      origen: 'solicitud',
      estadoSolicitud: 'pendiente',
      solicitadaEn: FieldValue.serverTimestamp(),
      horaEntrada: null,
      diaLima: null,
      estadoDia: null,
      resueltaPor: null,
      resueltaEn: null,
      observacion: null,
      folio: null,
    })
    tx.set(candado, { fichajeId: ref.id })
    return { id: ref.id, repetida: false }
  })

  return id
}

/**
 * Aprueba las solicitudes pendientes. La hora de entrada es el instante de
 * esta llamada, la misma para todo el lote. Si el trabajador ya tiene marca
 * ese día, esa solicitud se salta; si era la única, se rechaza la operación.
 * Aprobar una ya aprobada no vuelve a escribir la hora.
 */
export async function aprobarSolicitudes(
  ids: readonly string[],
  uid: string,
): Promise<number> {
  const unicos = [
    ...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)),
  ]
  if (unicos.length === 0) fallar('peticion_invalida', { campo: 'ids' })

  const ahora = new Date()
  const dia = diaEnLima(ahora)
  const marca = Timestamp.fromDate(ahora)

  return bd().runTransaction(async (tx) => {
    const contadorRef = referenciaDeRuta(DOCUMENTOS.contadorFichajes)
    const rosterRef = referenciaDeRuta(DOCUMENTOS.rosterFichaje)
    const ultimoRef = referenciaDeRuta(DOCUMENTOS.ultimoFichaje)
    const contador = await tx.get(contadorRef)
    const rosterSnap = await tx.get(rosterRef)

    const fichas: DocumentSnapshot[] = []
    for (const id of unicos) {
      fichas.push(await tx.get(bd().collection(COLECCIONES.fichajes).doc(id)))
    }

    const pendientes = fichas.filter(
      (ficha) => ficha.exists && ficha.get('estadoSolicitud') === 'pendiente',
    )

    const reservas = []
    for (const ficha of pendientes) {
      const clave = String(ficha.get('nombreClave'))
      const reservaRef = reservaDeDia(clave, dia)
      const candadoRef = candadoPendiente(clave)
      reservas.push({
        ficha,
        clave,
        nombre: String(ficha.get('nombre')),
        reservaRef,
        reserva: await tx.get(reservaRef),
        candado: await tx.get(candadoRef),
      })
    }

    const libres = reservas.filter((cada) => !cada.reserva.exists)

    if (unicos.length === 1 && pendientes.length === 0) {
      const ficha = fichas[0]
      if (ficha?.exists && ficha.get('estadoSolicitud') === 'aprobada') return 0
      if (!ficha?.exists) fallar('no_encontrado')
      fallar('solicitud_ya_resuelta')
    }

    if (unicos.length === 1 && pendientes.length === 1 && libres.length === 0) {
      fallar('entrada_ya_registrada')
    }

    if (libres.length === 0) return 0

    let folio = ultimoNumero(contador.data())
    const roster = leerRoster(rosterSnap.data())
    const horarios = horariosDesde(rosterSnap.get('horarios'))
    let ultimoNombre = ''
    let ultimoEstado: EstadoDeMarca = 'presente'

    for (const cada of libres) {
      folio += 1
      const estado = estadoPorHoraDeEntrada(
        ahora,
        horaDeEntradaDe(
          horarios,
          cada.clave,
          indiceDeSemanaEnLima(ahora),
        ),
      )
      tx.update(cada.ficha.ref, {
        estadoSolicitud: 'aprobada',
        horaEntrada: marca,
        diaLima: dia,
        estadoDia: estado,
        resueltaPor: uid,
        resueltaEn: marca,
        folio,
      })
      tx.set(cada.reservaRef, { fichajeId: cada.ficha.id, diaLima: dia })
      if (
        cada.candado.exists &&
        cada.candado.get('fichajeId') === cada.ficha.id
      ) {
        tx.delete(cada.candado.ref)
      }
      if (!roster.some((fila) => fila.clave === cada.clave)) {
        roster.push({ clave: cada.clave, nombre: cada.nombre })
      }
      ultimoNombre = cada.nombre
      ultimoEstado = estado
    }

    tx.set(contadorRef, {
      ultimoNumero: folio,
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    tx.set(rosterRef, { nombres: roster }, { merge: true })
    tx.set(ultimoRef, {
      nombre: ultimoNombre,
      folio,
      diaLima: dia,
      horaEntrada: marca,
      estadoDia: ultimoEstado,
      origen: 'solicitud',
      hora: horaCorta(ahora),
    })

    return libres.length
  })
}

export async function rechazarSolicitud(
  id: string,
  uid: string,
): Promise<void> {
  if (id.trim().length === 0) fallar('peticion_invalida', { campo: 'id' })

  await bd().runTransaction(async (tx) => {
    const ref = bd().collection(COLECCIONES.fichajes).doc(id)
    const ficha = await tx.get(ref)
    if (!ficha.exists) fallar('no_encontrado')
    const estado = ficha.get('estadoSolicitud')
    if (estado === 'rechazada') return
    if (estado !== 'pendiente') fallar('solicitud_ya_resuelta')

    const clave = String(ficha.get('nombreClave'))
    const candadoRef = candadoPendiente(clave)
    const candado = await tx.get(candadoRef)

    tx.update(ref, {
      estadoSolicitud: 'rechazada',
      resueltaPor: uid,
      resueltaEn: FieldValue.serverTimestamp(),
    })
    if (candado.exists && candado.get('fichajeId') === id) {
      tx.delete(candadoRef)
    }
  })
}

export async function registrarManual(
  alta: AltaManual,
  uid: string,
): Promise<number> {
  const nombre = nombreParaMostrar(alta.nombre)
  if (nombre === null) fallar('peticion_invalida', { campo: 'nombre' })
  if (!esEstado(alta.estado)) fallar('peticion_invalida', { campo: 'estado' })
  const instante = instanteDesdeFechaHoraLima(alta.fecha, alta.hora)
  if (instante === null) fallar('peticion_invalida', { campo: 'fecha' })

  const observacion = alta.observacion.trim().slice(0, 400)
  const clave = claveDeNombre(nombre)
  const dia = diaEnLima(instante)
  const marca = Timestamp.fromDate(instante)

  return bd().runTransaction(async (tx) => {
    const reservaRef = reservaDeDia(clave, dia)
    const reserva = await tx.get(reservaRef)
    if (reserva.exists) fallar('entrada_ya_registrada')

    const contadorRef = referenciaDeRuta(DOCUMENTOS.contadorFichajes)
    const rosterRef = referenciaDeRuta(DOCUMENTOS.rosterFichaje)
    const ultimoRef = referenciaDeRuta(DOCUMENTOS.ultimoFichaje)
    const contador = await tx.get(contadorRef)
    const rosterSnap = await tx.get(rosterRef)
    const folio = ultimoNumero(contador.data()) + 1
    const ref = bd().collection(COLECCIONES.fichajes).doc()
    const roster = leerRoster(rosterSnap.data())
    if (!roster.some((fila) => fila.clave === clave)) {
      roster.push({ clave, nombre })
    }

    tx.set(ref, {
      nombre,
      nombreClave: clave,
      origen: 'manual',
      estadoSolicitud: 'aprobada',
      solicitadaEn: marca,
      horaEntrada: marca,
      diaLima: dia,
      estadoDia: alta.estado,
      resueltaPor: uid,
      resueltaEn: FieldValue.serverTimestamp(),
      observacion: observacion.length > 0 ? observacion : null,
      folio,
    })
    tx.set(reservaRef, { fichajeId: ref.id, diaLima: dia })
    tx.set(contadorRef, {
      ultimoNumero: folio,
      actualizadoEn: FieldValue.serverTimestamp(),
    })
    tx.set(rosterRef, { nombres: roster }, { merge: true })
    tx.set(ultimoRef, {
      nombre,
      folio,
      diaLima: dia,
      horaEntrada: marca,
      estadoDia: alta.estado,
      origen: 'manual',
      hora: alta.hora,
    })
    return folio
  })
}

export async function editarMarca(
  id: string,
  cambio: { hora: string; estado: EstadoDeMarca; observacion: string },
  uid: string,
): Promise<void> {
  if (id.trim().length === 0) fallar('peticion_invalida', { campo: 'id' })
  if (!esEstado(cambio.estado)) fallar('peticion_invalida', { campo: 'estado' })

  await bd().runTransaction(async (tx) => {
    const ref = bd().collection(COLECCIONES.fichajes).doc(id)
    const ficha = await tx.get(ref)
    if (!ficha.exists) fallar('no_encontrado')
    if (ficha.get('estadoSolicitud') !== 'aprobada') {
      fallar('solicitud_ya_resuelta')
    }
    const dia = ficha.get('diaLima')
    if (typeof dia !== 'string') fallar('peticion_invalida', { campo: 'fecha' })
    const instante = instanteDesdeFechaHoraLima(dia, cambio.hora)
    if (instante === null) fallar('peticion_invalida', { campo: 'hora' })

    const ultimoRef = referenciaDeRuta(DOCUMENTOS.ultimoFichaje)
    const ultimo = await tx.get(ultimoRef)
    const observacion = cambio.observacion.trim().slice(0, 400)
    const marca = Timestamp.fromDate(instante)

    tx.update(ref, {
      horaEntrada: marca,
      estadoDia: cambio.estado,
      observacion: observacion.length > 0 ? observacion : null,
      resueltaPor: uid,
      resueltaEn: FieldValue.serverTimestamp(),
    })

    if (
      ultimo.exists &&
      ultimo.get('folio') === ficha.get('folio') &&
      ultimo.get('diaLima') === dia
    ) {
      tx.set(
        ultimoRef,
        {
          horaEntrada: marca,
          hora: cambio.hora,
          estadoDia: cambio.estado,
        },
        { merge: true },
      )
    }
  })
}

/** Quita la entrada del día. La persona sigue en el equipo, como sin fichar. */
export async function eliminarMarca(id: string): Promise<void> {
  if (id.trim().length === 0) fallar('peticion_invalida', { campo: 'id' })

  await bd().runTransaction(async (tx) => {
    const ref = bd().collection(COLECCIONES.fichajes).doc(id)
    const ficha = await tx.get(ref)
    if (!ficha.exists) return
    if (ficha.get('estadoSolicitud') !== 'aprobada') {
      fallar('solicitud_ya_resuelta')
    }

    const clave = String(ficha.get('nombreClave'))
    const dia = String(ficha.get('diaLima') ?? '')
    const reservaRef = reservaDeDia(clave, dia)
    const reserva = await tx.get(reservaRef)
    const ultimoRef = referenciaDeRuta(DOCUMENTOS.ultimoFichaje)
    const ultimo = await tx.get(ultimoRef)

    tx.delete(ref)
    if (reserva.exists && reserva.get('fichajeId') === id) {
      tx.delete(reservaRef)
    }
    if (
      ultimo.exists &&
      ultimo.get('folio') === ficha.get('folio') &&
      ultimo.get('diaLima') === dia
    ) {
      tx.delete(ultimoRef)
    }
  })
}

/**
 * Borra todos los fichajes de una persona, sus reservas y su lugar en el
 * equipo. La ficha del mes desaparece porque ya no queda ningún registro.
 */
export async function eliminarHistorial(clave: string): Promise<void> {
  const limpia = clave.trim()
  if (limpia.length === 0) fallar('peticion_invalida', { campo: 'clave' })

  const instantanea = await bd()
    .collection(COLECCIONES.fichajes)
    .where('nombreClave', '==', limpia)
    .get()

  const lote = bd().batch()
  const dias = new Set<string>()
  for (const documento of instantanea.docs) {
    lote.delete(documento.ref)
    const dia = documento.get('diaLima')
    if (typeof dia === 'string' && dia.length > 0 && !dias.has(dia)) {
      dias.add(dia)
      lote.delete(reservaDeDia(limpia, dia))
    }
  }
  lote.delete(candadoPendiente(limpia))

  const rosterRef = referenciaDeRuta(DOCUMENTOS.rosterFichaje)
  const rosterSnap = await rosterRef.get()
  const horarios = horariosDesde(rosterSnap.get('horarios'))
  delete horarios[limpia]
  lote.set(
    rosterRef,
    {
      nombres: leerRoster(rosterSnap.data()).filter(
        (fila) => fila.clave !== limpia,
      ),
      horarios,
    },
    { merge: true },
  )

  const ultimoRef = referenciaDeRuta(DOCUMENTOS.ultimoFichaje)
  const ultimo = await ultimoRef.get()
  if (
    ultimo.exists &&
    claveDeNombre(String(ultimo.get('nombre') ?? '')) === limpia
  ) {
    lote.delete(ultimoRef)
  }

  await lote.commit()
}

/** Saca a alguien del equipo de turno. No borra el histórico del mes. */
export async function quitarDelEquipo(clave: string): Promise<void> {
  const limpia = clave.trim()
  if (limpia.length === 0) fallar('peticion_invalida', { campo: 'clave' })

  const rosterRef = referenciaDeRuta(DOCUMENTOS.rosterFichaje)
  await bd().runTransaction(async (tx) => {
    const rosterSnap = await tx.get(rosterRef)
    const roster = leerRoster(rosterSnap.data()).filter(
      (fila) => fila.clave !== limpia,
    )
    tx.set(rosterRef, { nombres: roster }, { merge: true })
  })
}

/** Horas de entrada de lunes a sábado. Cada día laboral trae la suya. */
export async function fijarHorarioEntrada(
  clave: string,
  dias: Readonly<Record<string, string>>,
): Promise<void> {
  const limpia = clave.trim()
  const semana = semanaCompleta(dias)
  if (limpia.length === 0 || semana === null) {
    fallar('peticion_invalida', { campo: semana === null ? 'hora' : 'clave' })
  }

  const rosterRef = referenciaDeRuta(DOCUMENTOS.rosterFichaje)
  await bd().runTransaction(async (tx) => {
    const snap = await tx.get(rosterRef)
    const horarios = horariosDesde(snap.get('horarios'))
    horarios[limpia] = semana
    tx.set(rosterRef, { horarios }, { merge: true })
  })
}
