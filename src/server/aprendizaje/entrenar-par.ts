import { anonimizarTexto } from '../../domain/aprendizaje/compacto.ts'
import type {
  AlineacionDeEntrenamiento,
  CoberturaDeEntrenamiento,
  EstadoDeAlineacion,
} from '../../domain/aprendizaje/memoria.ts'
import {
  coberturaDeAlineaciones,
  diffsDesdeAlineaciones,
} from '../../domain/aprendizaje/memoria.ts'
import type { DeltaDeMarca } from '../../domain/aprendizaje/priores.ts'
import { deltasDeMarcaDesdeCodigos } from '../../domain/aprendizaje/priores.ts'
import { diaEnLima } from '../../domain/anulacion/ventana.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import {
  invocarModeloConPartes,
} from '../asistencia/cliente-modelo.ts'
import type { ParteGemini } from '../asistencia/cliente-modelo.ts'
import { textoDeCandidatosParaPrompt } from '../asistencia/payload.ts'
import { asistenciaSimuladaActiva } from '../asistencia/simulado.ts'
import {
  aplicarYPersistirDiff,
  leerMemoriaDeAprendizaje,
  registrarSesionEntrenamiento,
} from './almacen.ts'
import { leerContextoDeAsistencia } from './catalogo-compacto.ts'
import {
  SCHEMA_ENTRENAMIENTO,
  promptDeEntrenamiento,
} from './prompts-entrenamiento.ts'

export const TECHO_MEDIO_ENTRENAMIENTO_BYTES = 8 * 1024 * 1024

const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface MedioDeEntrenamiento {
  readonly mimeType: string
  readonly dataBase64: string
}

export interface LadoDeEntrenamiento {
  readonly medio?: MedioDeEntrenamiento
  readonly texto?: string
}

export interface PropuestaDeEntrenamiento {
  readonly alineaciones: readonly AlineacionDeEntrenamiento[]
  readonly cobertura: CoberturaDeEntrenamiento
  readonly marcas: readonly DeltaDeMarca[]
  readonly modelo: string
}

function bytesDeBase64(data: string): number {
  return Math.floor((data.length * 3) / 4)
}

function exigirLado(lado: LadoDeEntrenamiento, etiqueta: string): void {
  const texto = lado.texto?.trim() ?? ''
  const medio = lado.medio
  if (texto === '' && medio === undefined) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: `sin_${etiqueta}` })
  }
  if (medio !== undefined) {
    if (!MIME_PERMITIDOS.has(medio.mimeType)) {
      throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'tipo_no_aceptado' })
    }
    if (bytesDeBase64(medio.dataBase64) > TECHO_MEDIO_ENTRENAMIENTO_BYTES) {
      throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'archivo_grande' })
    }
  }
}

function parteDeMedio(medio: MedioDeEntrenamiento): ParteGemini {
  const imagen = medio.mimeType.startsWith('image/')
  return {
    inlineData: { mimeType: medio.mimeType, data: medio.dataBase64 },
    ...(imagen ? { mediaResolution: { level: 'MEDIA_RESOLUTION_HIGH' } } : {}),
  }
}

export function parsearAlineaciones(
  valor: unknown,
  codigosValidos: ReadonlySet<string>,
): AlineacionDeEntrenamiento[] {
  if (!valor || typeof valor !== 'object') return []
  const crudo = (valor as { alineaciones?: unknown }).alineaciones
  if (!Array.isArray(crudo)) return []
  const estados: readonly EstadoDeAlineacion[] = [
    'emparejado',
    'omitido',
    'no_en_catalogo',
  ]
  const salida: AlineacionDeEntrenamiento[] = []
  for (const raw of crudo) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const textoPedido = anonimizarTexto(
      typeof r.textoPedido === 'string' ? r.textoPedido : '',
    )
    if (textoPedido === '') continue
    let estado: EstadoDeAlineacion = estados.includes(
      r.estado as EstadoDeAlineacion,
    )
      ? (r.estado as EstadoDeAlineacion)
      : 'omitido'
    let codigo = typeof r.codigo === 'string' ? r.codigo.trim() : ''
    if (estado === 'emparejado' && (codigo === '' || !codigosValidos.has(codigo))) {
      estado = 'no_en_catalogo'
      codigo = ''
    }
    if (estado !== 'emparejado') {
      codigo = ''
    }
    const lista = (campo: unknown) =>
      Array.isArray(campo)
        ? campo
            .filter((x): x is string => typeof x === 'string')
            .map((x) => anonimizarTexto(x))
            .filter((x) => x !== '')
        : []
    const marca =
      estado === 'emparejado' && typeof r.marca === 'string'
        ? anonimizarTexto(r.marca)
        : ''
    salida.push({
      textoPedido,
      codigo,
      marca,
      estado,
      aliases: estado === 'emparejado' ? lista(r.aliases) : [],
      etiquetas: estado === 'emparejado' ? lista(r.etiquetas) : [],
    })
  }
  return salida
}

function deltasDesdeAlineaciones(
  alineaciones: readonly AlineacionDeEntrenamiento[],
  porCodigo: Readonly<
    Record<string, { readonly marca: string; readonly familia: string }>
  >,
): DeltaDeMarca[] {
  return deltasDeMarcaDesdeCodigos(
    alineaciones
      .filter((a) => a.estado === 'emparejado')
      .map((a) => a.codigo),
    porCodigo,
  )
}

function simularAlineaciones(
  textoPedido: string,
  textoOro: string,
  codigosValidos: ReadonlySet<string>,
  porCodigo: Readonly<
    Record<string, { readonly marca: string; readonly familia: string }>
  >,
): AlineacionDeEntrenamiento[] {
  const renglonesPedido = textoPedido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  if (renglonesPedido.length === 0 || textoOro.trim() === '') return []
  const oro = textoOro.toLowerCase()
  const hallados = [...codigosValidos].filter((codigo) =>
    oro.includes(codigo.toLowerCase()),
  )
  return renglonesPedido.map((textoPedidoRenglon, i) => {
    const codigo = hallados[i] ?? ''
    if (codigo === '') {
      return {
        textoPedido: textoPedidoRenglon,
        codigo: '',
        marca: '',
        estado: 'omitido' as const,
        aliases: [],
        etiquetas: [],
      }
    }
    return {
      textoPedido: textoPedidoRenglon,
      codigo,
      marca: porCodigo[codigo]?.marca ?? '',
      estado: 'emparejado' as const,
      aliases: [textoPedidoRenglon],
      etiquetas: [],
    }
  })
}

export async function proponerEntrenamiento(entrada: {
  readonly pedido: LadoDeEntrenamiento
  readonly oro: LadoDeEntrenamiento
}): Promise<PropuestaDeEntrenamiento> {
  exigirLado(entrada.pedido, 'pedido')
  exigirLado(entrada.oro, 'oro')

  const contexto = await leerContextoDeAsistencia()
  if (contexto.candidatos.length === 0) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'sin_catalogo' })
  }
  const codigosValidos = new Set(contexto.candidatos.map((c) => c.codigo))
  const memoria = await leerMemoriaDeAprendizaje()
  const textoPedido = entrada.pedido.texto?.trim() ?? ''
  const textoOro = entrada.oro.texto?.trim() ?? ''

  let alineaciones: AlineacionDeEntrenamiento[]
  let modelo = 'simulado'

  if (asistenciaSimuladaActiva()) {
    alineaciones = simularAlineaciones(
      textoPedido,
      textoOro,
      codigosValidos,
      contexto.porCodigo,
    )
  } else {
    modelo = process.env.ASISTENCIA_MODELO ?? 'gemini'
    const prompt = promptDeEntrenamiento({
      catalogoJson: textoDeCandidatosParaPrompt(contexto.candidatos),
      memoriaJson: JSON.stringify(memoria),
      prioresJson: contexto.prioresJson,
      textoPedido: textoPedido === '' ? undefined : textoPedido,
      textoOro: textoOro === '' ? undefined : textoOro,
    })
    const partes: ParteGemini[] = [{ text: prompt }]
    if (entrada.pedido.medio !== undefined) {
      partes.push(parteDeMedio(entrada.pedido.medio))
    }
    if (entrada.oro.medio !== undefined) {
      partes.push(parteDeMedio(entrada.oro.medio))
    }
    try {
      const crudo = await invocarModeloConPartes({
        partes,
        schema: SCHEMA_ENTRENAMIENTO,
        timeoutMs: 90_000,
      })
      alineaciones = parsearAlineaciones(crudo, codigosValidos)
    } catch (error) {
      if (error instanceof ErrorDeSuitPay) throw error
      console.error('[SuitPay] entrenamiento: modelo falló', error)
      throw new ErrorDeSuitPay('asistencia_no_disponible')
    }
  }

  return {
    alineaciones,
    cobertura: coberturaDeAlineaciones(alineaciones),
    marcas: deltasDesdeAlineaciones(alineaciones, contexto.porCodigo),
    modelo,
  }
}

export async function confirmarEntrenamiento(entrada: {
  readonly uid: string
  readonly alineaciones: readonly AlineacionDeEntrenamiento[]
  readonly modelo: string
  readonly marcasPermitidas?: readonly { familia: string; marca: string }[]
}): Promise<{
  readonly productos: number
  readonly cobertura: CoberturaDeEntrenamiento
}> {
  const contexto = await leerContextoDeAsistencia()
  const codigosValidos = new Set(contexto.candidatos.map((c) => c.codigo))
  const alineaciones = parsearAlineaciones(
    { alineaciones: entrada.alineaciones },
    codigosValidos,
  )
  const memoria = await leerMemoriaDeAprendizaje()
  const diffs = diffsDesdeAlineaciones(alineaciones, memoria)
  let marcas = deltasDesdeAlineaciones(alineaciones, contexto.porCodigo)
  if (entrada.marcasPermitidas !== undefined) {
    const permitidas = new Set(
      entrada.marcasPermitidas.map(
        (m) => `${m.familia.trim().toLowerCase()}\0${m.marca.trim()}`,
      ),
    )
    marcas = marcas.filter((d) =>
      permitidas.has(`${d.familia}\0${d.marca}`),
    )
  }
  const persistido = await aplicarYPersistirDiff(diffs, marcas)
  const cobertura = coberturaDeAlineaciones(alineaciones)
  await registrarSesionEntrenamiento({
    diaLima: diaEnLima(new Date()),
    uid: entrada.uid,
    cobertura,
    pares: alineaciones.filter((a) => a.estado === 'emparejado').length,
    modelo: entrada.modelo,
  })
  return { productos: Object.keys(persistido.productos).length, cobertura }
}
