import { randomUUID } from 'node:crypto'
import { bd, COLECCIONES } from '../firebase/admin.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import { invocarModelo } from './cliente-modelo.ts'
import type { DependenciasDelClienteModelo } from './cliente-modelo.ts'
import { leerMedioDeStorage } from './medios.ts'
import { construirPayloadDeAsistencia } from './payload.ts'
import {
  asistenciaSimuladaActiva,
  interpretarSimulado,
} from './simulado.ts'
import type {
  CandidatoDeAsistencia,
  CandidatoDeLinea,
  ItemDelModelo,
  LineaDeCaptura,
  ResultadoDeInterpretacion,
  TipoDeCaptura,
} from './tipos.ts'

export interface PeticionDeInterpretarCaptura {
  readonly tipo: TipoDeCaptura
  readonly medioUrl: string
  readonly candidatos: readonly CandidatoDeAsistencia[]
  readonly vendedorId: string
}

export interface DependenciasDeInterpretar {
  readonly leerMedio?: (medioUrl: string) => Promise<{
    mimeType: string
    dataBase64: string
  }>
  readonly depsModelo?: DependenciasDelClienteModelo
  readonly forzarSimulado?: boolean
  readonly ahora?: () => Date
  readonly idCaptura?: () => string
  readonly persistir?: (entrada: {
    readonly capturaId: string
    readonly tipo: TipoDeCaptura
    readonly medioUrl: string
    readonly lineas: readonly LineaDeCaptura[]
    readonly vendedorId: string
    readonly creadoEn: string
  }) => Promise<void>
}

function mapearLinea(
  item: ItemDelModelo,
  candidatos: readonly CandidatoDeAsistencia[],
): LineaDeCaptura {
  if (item.ilegible) {
    return {
      textoOriginal: item.textoOriginal,
      candidatos: [],
      seleccion: null,
      estadoLinea: 'pendiente',
      cantidad: item.cantidad,
    }
  }

  const porCodigo = new Map(candidatos.map((c) => [c.codigo, c]))
  const directo =
    item.codigo !== null ? (porCodigo.get(item.codigo) ?? null) : null

  if (directo && item.confidence === 'high') {
    return {
      textoOriginal: item.textoOriginal,
      candidatos: [
        {
          codigo: directo.codigo,
          descripcion: directo.descripcion,
          unidad: directo.unidad,
          cantidad: item.cantidad,
          grado: 'exacta',
        },
      ],
      seleccion: directo.codigo,
      estadoLinea: 'resuelta',
      cantidad: item.cantidad,
    }
  }

  // Ambiguos: sugerir hasta 4 del lote por solapamiento de palabras
  const terminos = item.textoOriginal
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñ/]+/i)
    .filter((t) => t.length >= 2)

  const puntuados = candidatos
    .map((c) => {
      const desc = c.descripcion.toLowerCase()
      const hits = terminos.filter((t) => desc.includes(t)).length
      return { c, hits }
    })
    .filter((p) => p.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 4)

  const lista: CandidatoDeLinea[] = puntuados.map((p) => ({
    codigo: p.c.codigo,
    descripcion: p.c.descripcion,
    unidad: p.c.unidad,
    cantidad: item.cantidad,
    grado: p.hits >= 3 ? 'fuerte' : 'aproximada',
  }))

  if (directo && !lista.some((l) => l.codigo === directo.codigo)) {
    lista.unshift({
      codigo: directo.codigo,
      descripcion: directo.descripcion,
      unidad: directo.unidad,
      cantidad: item.cantidad,
      grado: 'aproximada',
    })
  }

  if (lista.length === 0) {
    return {
      textoOriginal: item.textoOriginal,
      candidatos: [],
      seleccion: null,
      estadoLinea: 'pendiente',
      cantidad: item.cantidad,
    }
  }

  if (lista.length === 1 && item.confidence === 'high') {
    return {
      textoOriginal: item.textoOriginal,
      candidatos: lista,
      seleccion: lista[0]!.codigo,
      estadoLinea: 'resuelta',
      cantidad: item.cantidad,
    }
  }

  return {
    textoOriginal: item.textoOriginal,
    candidatos: lista,
    seleccion: null,
    estadoLinea: 'ambigua',
    cantidad: item.cantidad,
  }
}

export async function interpretarCaptura(
  peticion: PeticionDeInterpretarCaptura,
  deps: DependenciasDeInterpretar = {},
): Promise<ResultadoDeInterpretacion> {
  if (peticion.candidatos.length === 0) {
    throw new ErrorDeSuitPay('peticion_invalida', {
      motivo: 'candidatos_vacios',
    })
  }

  const leer =
    deps.leerMedio ??
    (async (url) => {
      const medio = await leerMedioDeStorage(url, peticion.tipo)
      return { mimeType: medio.mimeType, dataBase64: medio.dataBase64 }
    })
  const medio = await leer(peticion.medioUrl)

  // Construye el payload auditable (principio IV) aunque el medio viaje aparte.
  const payload = construirPayloadDeAsistencia({
    tipo: peticion.tipo,
    medio,
    candidatos: peticion.candidatos,
  })

  const usarSimulado =
    deps.forzarSimulado === true || asistenciaSimuladaActiva()

  let respuestaModelo
  try {
    if (usarSimulado) {
      respuestaModelo = interpretarSimulado({
        tipo: peticion.tipo,
        candidatos: payload.candidatos,
      })
    } else {
      respuestaModelo = await invocarModelo({
        tipo: payload.tipo,
        medio: payload.medio,
        candidatos: payload.candidatos,
        deps: deps.depsModelo,
      })
    }
  } catch (error) {
    if (error instanceof ErrorDeSuitPay) throw error
    console.error('[SuitPay] interpretarCaptura: fallo inesperado', error)
    throw new ErrorDeSuitPay('asistencia_no_disponible')
  }

  if (respuestaModelo.ilegible) {
    // Conservar el original en Storage; no borrar.
    throw new ErrorDeSuitPay('medio_ilegible')
  }

  const lineas = respuestaModelo.items.map((item) =>
    mapearLinea(item, peticion.candidatos),
  )

  // Ningún renglón del modelo se descarta: si items vacío tras no-ilegible,
  // dejamos una pendiente explícita.
  const lineasFinales =
    lineas.length > 0
      ? lineas
      : [
          {
            textoOriginal: '(sin renglones interpretados)',
            candidatos: [],
            seleccion: null,
            estadoLinea: 'pendiente' as const,
            cantidad: 1,
          },
        ]

  const capturaId = deps.idCaptura?.() ?? randomUUID()
  const ahora = deps.ahora?.() ?? new Date()
  const creadoEn = ahora.toISOString()

  const persistir =
    deps.persistir ??
    (async (entrada) => {
      await bd()
        .collection(COLECCIONES.capturas)
        .doc(entrada.capturaId)
        .set({
          tipo: entrada.tipo,
          medioUrl: entrada.medioUrl,
          estado: 'propuesta',
          lineas: entrada.lineas,
          vendedorId: entrada.vendedorId,
          creadoEn: entrada.creadoEn,
        })
    })

  await persistir({
    capturaId,
    tipo: peticion.tipo,
    medioUrl: peticion.medioUrl,
    lineas: lineasFinales,
    vendedorId: peticion.vendedorId,
    creadoEn,
  })

  return {
    capturaId,
    lineas: lineasFinales,
    medioUrl: peticion.medioUrl,
    tipo: peticion.tipo,
  }
}
