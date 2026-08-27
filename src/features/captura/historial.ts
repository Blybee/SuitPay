import { create } from 'zustand'
import { esAudioDelDiaActual } from '../../domain/captura/hora-lima.ts'
import {
  borrarAudio,
  guardarAudio,
  listarAudios,
  type ContextoDeAudio,
  type RegistroDeAudio,
} from '../../infra/local/almacenes.ts'

interface EstadoHistorial {
  readonly entradas: readonly RegistroDeAudio[]
  cargar: () => Promise<void>
  registrar: (registro: RegistroDeAudio) => Promise<void>
}

function delDiaActual(
  entradas: readonly RegistroDeAudio[],
  ahora = new Date(),
): RegistroDeAudio[] {
  return entradas.filter((cada) =>
    esAudioDelDiaActual(new Date(cada.grabadoEn), ahora),
  )
}

export const usarHistorialDeAudios = create<EstadoHistorial>((set) => ({
  entradas: [],

  async cargar() {
    const todas = await listarAudios()
    const vigentes = delDiaActual(todas)
    await Promise.all(
      todas
        .filter((cada) => !esAudioDelDiaActual(new Date(cada.grabadoEn)))
        .map((cada) => borrarAudio(cada.id)),
    )
    set({ entradas: vigentes })
  },

  async registrar(registro) {
    await guardarAudio(registro)
    const todas = await listarAudios()
    set({ entradas: delDiaActual(todas) })
  },
}))

export function audiosVisibles(entrada: {
  readonly entradas: readonly RegistroDeAudio[]
  readonly contexto: ContextoDeAudio
  readonly vecinoId: string | null
}): readonly RegistroDeAudio[] {
  const delDia = delDiaActual(entrada.entradas)
  if (entrada.contexto === 'vecino') {
    if (entrada.vecinoId === null) return []
    return delDia.filter(
      (cada) =>
        cada.contexto === 'vecino' && cada.vecinoId === entrada.vecinoId,
    )
  }
  return delDia.filter((cada) => cada.contexto === entrada.contexto)
}
