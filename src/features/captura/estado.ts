import { create } from 'zustand'
import type { LineaDeCaptura, TipoDeCaptura } from './tipos.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'

export type FaseDeCaptura =
  | 'idle'
  | 'grabando'
  | 'subiendo'
  | 'procesando'
  | 'revision'
  | 'revision_texto'
  | 'ilegible'
  | 'error'

export interface EstadoDeCapturaEnCurso {
  readonly fase: FaseDeCaptura
  readonly tipo: TipoDeCaptura | null
  readonly capturaId: string | null
  readonly medioUrl: string | null
  readonly medioObjectUrl: string | null
  readonly lineas: readonly LineaDeCapturaEditable[]
  readonly clientePropuesto: ClienteDelPedido | null
  readonly mensajeError: string | null
  readonly motivoIlegible: string | null
}

export interface LineaDeCapturaEditable {
  readonly textoOriginal: string
  readonly candidatos: LineaDeCaptura['candidatos']
  readonly seleccion: string | null
  readonly estadoLinea: LineaDeCaptura['estadoLinea']
  readonly cantidad: number
}

interface Acciones {
  iniciarGrabacion: (tipo: TipoDeCaptura) => void
  marcarSubiendo: () => void
  marcarProcesando: () => void
  recibirPropuesta: (entrada: {
    capturaId: string
    medioUrl: string
    medioObjectUrl: string | null
    tipo: TipoDeCaptura
    lineas: readonly LineaDeCaptura[]
    clientePropuesto?: ClienteDelPedido | null
    pasoTextoPrimero?: boolean
  }) => void
  actualizarTextoOriginal: (indice: number, texto: string) => void
  elegirCandidato: (indice: number, codigo: string) => void
  asignarProducto: (
    indice: number,
    producto: {
      codigo: string
      descripcion: string
      unidad: string
    },
  ) => void
  quitarLinea: (indice: number) => void
  pasarAEmparejamiento: () => void
  marcarIlegible: (motivo: string, medioObjectUrl: string | null) => void
  marcarError: (mensaje: string) => void
  cancelar: () => void
  hayPendientesOAmbiguas: () => boolean
}

export type AlmacenDeCaptura = EstadoDeCapturaEnCurso & Acciones

const INICIAL: EstadoDeCapturaEnCurso = {
  fase: 'idle',
  tipo: null,
  capturaId: null,
  medioUrl: null,
  medioObjectUrl: null,
  lineas: [],
  clientePropuesto: null,
  mensajeError: null,
  motivoIlegible: null,
}

function liberarObjectUrl(url: string | null): void {
  if (url !== null && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

export const usarCaptura = create<AlmacenDeCaptura>((set, get) => ({
  ...INICIAL,

  iniciarGrabacion(tipo) {
    const prev = get().medioObjectUrl
    liberarObjectUrl(prev)
    set({
      ...INICIAL,
      fase: 'grabando',
      tipo,
    })
  },

  marcarSubiendo() {
    set({ fase: 'subiendo', mensajeError: null })
  },

  marcarProcesando() {
    set({ fase: 'procesando', mensajeError: null })
  },

  recibirPropuesta(entrada) {
    set({
      fase: entrada.pasoTextoPrimero ? 'revision_texto' : 'revision',
      tipo: entrada.tipo,
      capturaId: entrada.capturaId,
      medioUrl: entrada.medioUrl,
      medioObjectUrl: entrada.medioObjectUrl,
      lineas: entrada.lineas.map((l) => ({ ...l })),
      clientePropuesto: entrada.clientePropuesto ?? null,
      mensajeError: null,
      motivoIlegible: null,
    })
  },

  actualizarTextoOriginal(indice, texto) {
    const lineas = get().lineas.map((l, i) =>
      i === indice ? { ...l, textoOriginal: texto } : l,
    )
    set({ lineas })
  },

  elegirCandidato(indice, codigo) {
    const lineas = get().lineas.map((l, i) => {
      if (i !== indice) return l
      const candidato = l.candidatos.find((c) => c.codigo === codigo)
      if (!candidato) return l
      return {
        ...l,
        seleccion: codigo,
        estadoLinea: 'resuelta' as const,
        cantidad: candidato.cantidad > 0 ? candidato.cantidad : l.cantidad,
      }
    })
    set({ lineas })
  },

  asignarProducto(indice, producto) {
    const lineas = get().lineas.map((l, i) => {
      if (i !== indice) return l
      const ya = l.candidatos.find((c) => c.codigo === producto.codigo)
      const candidatos = ya
        ? l.candidatos
        : [
            {
              codigo: producto.codigo,
              descripcion: producto.descripcion,
              unidad: producto.unidad,
              cantidad: l.cantidad,
              grado: 'exacta' as const,
            },
            ...l.candidatos,
          ]
      return {
        ...l,
        candidatos,
        seleccion: producto.codigo,
        estadoLinea: 'resuelta' as const,
      }
    })
    set({ lineas })
  },

  quitarLinea(indice) {
    set({ lineas: get().lineas.filter((_, i) => i !== indice) })
  },

  pasarAEmparejamiento() {
    if (get().fase === 'revision_texto') {
      set({ fase: 'revision' })
    }
  },

  marcarIlegible(motivo, medioObjectUrl) {
    const prev = get().medioObjectUrl
    if (prev !== medioObjectUrl) liberarObjectUrl(prev)
    set({
      fase: 'ilegible',
      motivoIlegible: motivo,
      medioObjectUrl,
      mensajeError: null,
    })
  },

  marcarError(mensaje) {
    set({ fase: 'error', mensajeError: mensaje })
  },

  cancelar() {
    liberarObjectUrl(get().medioObjectUrl)
    set({ ...INICIAL })
  },

  hayPendientesOAmbiguas() {
    return get().lineas.some(
      (l) => l.estadoLinea === 'pendiente' || l.estadoLinea === 'ambigua',
    )
  },
}))
