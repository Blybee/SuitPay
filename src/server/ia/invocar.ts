import { anonimizarTexto } from '../../domain/aprendizaje/compacto.ts'
import {
  INTERRUPTORES_POR_DEFECTO,
  modalidadEfectiva,
  proveedorDe,
} from '../../domain/ia/proveedor.ts'
import type {
  InterruptoresDeIa,
  ModalidadDeIa,
} from '../../domain/ia/proveedor.ts'
import { llamarGeminiConPartes } from '../asistencia/cliente-modelo.ts'
import type {
  DependenciasDelClienteModelo,
  ParteGemini,
} from '../asistencia/cliente-modelo.ts'
import { leerNombresDeClientes } from './nombres.ts'
import { modelosVisibles } from './modelos.ts'
import { llamarOpenRouter } from './openrouter.ts'
import type { MotivoDeRespaldo } from './openrouter.ts'

export async function interruptoresVigentes(): Promise<InterruptoresDeIa> {
  const { leerParametros } = await import('../parametros/gestionar.ts')
  const parametros = await leerParametros()
  return { texto: parametros.iaTexto, imagen: parametros.iaImagen }
}

function claveOpenRouter(): string | undefined {
  const limpio = process.env.OPENROUTER_API_KEY?.trim()
  return limpio === undefined || limpio === '' ? undefined : limpio
}

function avisarRespaldo(motivo: MotivoDeRespaldo, modelo: string): void {
  console.warn('[SuitPay] ia: respaldo gemini', { motivo, modelo })
}

/**
 * Única entrada de las tareas que pueden salir de Gemini.
 * Audio, PDF y Compras no llegan a OpenRouter. Si OpenRouter falla
 * (429, 402, 5xx, timeout o JSON que no cumple el schema), sigue Gemini.
 */
export async function invocarIa(entrada: {
  readonly modalidad: ModalidadDeIa
  readonly partes: readonly ParteGemini[]
  readonly schema: unknown
  readonly deps?: DependenciasDelClienteModelo
  readonly timeoutMs?: number
  readonly interruptores?: InterruptoresDeIa
  readonly nombresDeClientes?: readonly string[]
}): Promise<unknown> {
  const deps = entrada.deps ?? {}
  const gemini = (partes: readonly ParteGemini[]) =>
    llamarGeminiConPartes({
      partes,
      schema: entrada.schema,
      deps,
      timeoutMs: entrada.timeoutMs,
    })

  const modalidad = modalidadEfectiva(entrada.modalidad, entrada.partes)
  const interruptores = entrada.interruptores ?? INTERRUPTORES_POR_DEFECTO
  if (proveedorDe(modalidad, interruptores) === 'gemini') {
    return gemini(entrada.partes)
  }

  const modelos = modelosVisibles()
  const modelo =
    modalidad === 'imagen' ? modelos.openrouterImagen : modelos.openrouterTexto
  const clave = claveOpenRouter()
  if (clave === undefined) {
    avisarRespaldo('sin_clave', modelo)
    return gemini(entrada.partes)
  }

  let nombres = entrada.nombresDeClientes
  if (nombres === undefined) {
    try {
      nombres = await leerNombresDeClientes()
    } catch {
      avisarRespaldo('indice_clientes', modelo)
      return gemini(entrada.partes)
    }
  }

  const partes = entrada.partes.map((parte) =>
    parte.text === undefined
      ? parte
      : { ...parte, text: anonimizarTexto(parte.text, nombres) },
  )
  const resultado = await llamarOpenRouter({
    modelo,
    partes,
    schema: entrada.schema,
    nombres,
    clave,
    fetchFn: deps.fetchFn ?? fetch,
    timeoutMs: entrada.timeoutMs ?? deps.timeoutMs ?? 45_000,
  })
  if (!resultado.ok) {
    avisarRespaldo(resultado.motivo, resultado.modelo)
    return gemini(partes)
  }
  return resultado.json
}
