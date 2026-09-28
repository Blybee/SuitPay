import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { cantidadDeDias, isoDeDia } from '../../domain/fichaje/reglas.ts'
import type { EstadoDeMarca } from '../../domain/fichaje/reglas.ts'
import { obtenerBaseDeDatos } from '../../infra/firebase/cliente.ts'

export interface SolicitudPendiente {
  readonly id: string
  readonly nombre: string
  readonly solicitadaEn: Date | null
}

export interface MarcaAprobada {
  readonly id: string
  readonly nombre: string
  readonly nombreClave: string
  readonly diaLima: string
  readonly estadoDia: EstadoDeMarca
  readonly horaEntrada: Date | null
  readonly folio: number | null
  readonly observacion: string | null
  readonly origen: 'solicitud' | 'manual'
}

export interface UltimoRegistro {
  readonly nombre: string
  readonly folio: number
  readonly diaLima: string
  readonly hora: string
  readonly estadoDia: EstadoDeMarca
}

export interface PersonaDeRoster {
  readonly clave: string
  readonly nombre: string
}

const ESTADOS: readonly string[] = [
  'presente',
  'tardanza',
  'falta',
  'justificado',
]

function aFecha(valor: unknown): Date | null {
  if (
    valor !== null &&
    typeof valor === 'object' &&
    'toDate' in valor &&
    typeof (valor as Timestamp).toDate === 'function'
  ) {
    return (valor as Timestamp).toDate()
  }
  return null
}

function esEstado(valor: unknown): valor is EstadoDeMarca {
  return typeof valor === 'string' && ESTADOS.includes(valor)
}

export function usarColaFichaje(): {
  readonly solicitudes: readonly SolicitudPendiente[]
  readonly listo: boolean
} {
  const [solicitudes, setSolicitudes] = useState<readonly SolicitudPendiente[]>(
    [],
  )
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const consulta = query(
      collection(obtenerBaseDeDatos(), 'fichajes'),
      where('estadoSolicitud', '==', 'pendiente'),
    )
    return onSnapshot(
      consulta,
      (instantanea) => {
        const lista = instantanea.docs.map((documento) => ({
          id: documento.id,
          nombre: String(documento.get('nombre') ?? ''),
          solicitadaEn: aFecha(documento.get('solicitadaEn')),
        }))
        lista.sort(
          (una, otra) =>
            (otra.solicitadaEn?.getTime() ?? 0) -
            (una.solicitadaEn?.getTime() ?? 0),
        )
        setSolicitudes(lista)
        setListo(true)
      },
      () => setListo(true),
    )
  }, [])

  return { solicitudes, listo }
}

export function usarMesFichaje(
  anio: number,
  mes: number,
): {
  readonly marcas: readonly MarcaAprobada[]
  readonly listo: boolean
} {
  const [marcas, setMarcas] = useState<readonly MarcaAprobada[]>([])
  const [listo, setListo] = useState(false)
  const inicio = isoDeDia(anio, mes, 1)
  const fin = isoDeDia(anio, mes, cantidadDeDias(anio, mes))

  useEffect(() => {
    const consulta = query(
      collection(obtenerBaseDeDatos(), 'fichajes'),
      where('diaLima', '>=', inicio),
      where('diaLima', '<=', fin),
    )
    return onSnapshot(
      consulta,
      (instantanea) => {
        setMarcas(
          instantanea.docs.flatMap((documento) => {
            if (documento.get('estadoSolicitud') !== 'aprobada') return []
            const estado = documento.get('estadoDia')
            const diaLima = documento.get('diaLima')
            if (!esEstado(estado) || typeof diaLima !== 'string') return []
            const origen =
              documento.get('origen') === 'manual' ? 'manual' : 'solicitud'
            const folio = documento.get('folio')
            return [
              {
                id: documento.id,
                nombre: String(documento.get('nombre') ?? ''),
                nombreClave: String(documento.get('nombreClave') ?? ''),
                diaLima,
                estadoDia: estado,
                horaEntrada: aFecha(documento.get('horaEntrada')),
                folio: typeof folio === 'number' ? folio : null,
                observacion:
                  typeof documento.get('observacion') === 'string'
                    ? documento.get('observacion')
                    : null,
                origen,
              },
            ]
          }),
        )
        setListo(true)
      },
      () => setListo(true),
    )
  }, [inicio, fin])

  return { marcas, listo }
}

export function usarRosterFichaje(): readonly PersonaDeRoster[] {
  const [personas, setPersonas] = useState<readonly PersonaDeRoster[]>([])

  useEffect(() => {
    return onSnapshot(
      doc(obtenerBaseDeDatos(), 'config', 'rosterFichaje'),
      (instantanea) => {
        const lista = instantanea.get('nombres')
        if (!Array.isArray(lista)) {
          setPersonas([])
          return
        }
        setPersonas(
          lista.flatMap((cada) => {
            if (typeof cada !== 'object' || cada === null) return []
            const fila = cada as Record<string, unknown>
            if (
              typeof fila['clave'] !== 'string' ||
              typeof fila['nombre'] !== 'string'
            ) {
              return []
            }
            return [{ clave: fila['clave'], nombre: fila['nombre'] }]
          }),
        )
      },
    )
  }, [])

  return personas
}

export function usarUltimoFichaje(): UltimoRegistro | null {
  const [ultimo, setUltimo] = useState<UltimoRegistro | null>(null)

  useEffect(() => {
    return onSnapshot(
      doc(obtenerBaseDeDatos(), 'config', 'ultimoFichaje'),
      (instantanea) => {
        if (!instantanea.exists()) {
          setUltimo(null)
          return
        }
        const estado = instantanea.get('estadoDia')
        if (!esEstado(estado)) {
          setUltimo(null)
          return
        }
        const folio = instantanea.get('folio')
        setUltimo({
          nombre: String(instantanea.get('nombre') ?? ''),
          folio: typeof folio === 'number' ? folio : 0,
          diaLima: String(instantanea.get('diaLima') ?? ''),
          hora: String(instantanea.get('hora') ?? ''),
          estadoDia: estado,
        })
      },
    )
  }, [])

  return ultimo
}
