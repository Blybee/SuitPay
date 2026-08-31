import { anonimizarNotas } from '../../domain/aprendizaje/compacto.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'
import { extraerListaPdf } from './extraer-pdf.ts'
import type { ResultadoDeListaPdf } from './extraer-pdf.ts'
import { interpretarCaptura } from './interpretar.ts'
import { leerCatalogoCompactoComoCandidatos } from '../aprendizaje/catalogo-compacto.ts'
import { SCHEMA_RESPUESTA_ASISTENCIA, promptDeAsistencia } from './prompts.ts'
import { invocarModeloConPartes } from './cliente-modelo.ts'
import {
  asistenciaSimuladaActiva,
  interpretarSimulado,
} from './simulado.ts'
import { randomUUID } from 'node:crypto'

async function leerInstrucciones(clienteId: string | undefined): Promise<string[]> {
  if (clienteId === undefined || clienteId.trim() === '') return []
  const snap = await bd()
    .collection(COLECCIONES.clientes)
    .doc(clienteId.trim())
    .get()
  const crudo = snap.data()?.['instruccionesCotizacion']
  if (!Array.isArray(crudo)) return []
  return [
    ...anonimizarNotas(crudo.filter((n): n is string => typeof n === 'string')),
  ]
}

export async function interpretarRequerimiento(entrada: {
  readonly medioUrl?: string
  readonly tipoMedio?: 'pdf' | 'imagen'
  readonly texto?: string
  readonly clienteId?: string
  readonly vendedorId: string
}): Promise<ResultadoDeListaPdf> {
  const texto = entrada.texto?.trim() ?? ''
  const medioUrl = entrada.medioUrl?.trim() ?? ''
  if (texto === '' && medioUrl === '') {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'sin_medio' })
  }

  const notas = await leerInstrucciones(entrada.clienteId)
  const instrucciones = [
    ...notas,
    ...(texto !== '' ? [`Texto pegado por el vendedor:\n${texto}`] : []),
  ]

  if (entrada.tipoMedio === 'imagen' && medioUrl !== '') {
    const resultado = await interpretarCaptura({
      tipo: 'imagen',
      medioUrl,
      instrucciones,
      vendedorId: entrada.vendedorId,
    })
    return {
      capturaId: resultado.capturaId,
      medioUrl: resultado.medioUrl,
      items: resultado.lineas.map((l) => ({
        textoOriginal: l.textoOriginal,
        cantidad: l.cantidad,
        unidad: l.candidatos[0]?.unidad ?? 'NIU',
        codigo: l.seleccion,
        confidence: l.estadoLinea === 'resuelta' ? 'high' : 'low',
      })),
      cliente: null,
    }
  }

  if (medioUrl !== '') {
    return extraerListaPdf({
      medioUrl,
      vendedorId: entrada.vendedorId,
      instrucciones,
    })
  }

  const candidatos = await leerCatalogoCompactoComoCandidatos()
  if (candidatos.length === 0) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'sin_catalogo' })
  }

  const capturaId = randomUUID()
  let itemsModelo
  if (asistenciaSimuladaActiva()) {
    itemsModelo = interpretarSimulado({
      tipo: 'imagen',
      candidatos,
    })
  } else {
    const prompt = promptDeAsistencia('imagen', candidatos, instrucciones)
    const crudo = await invocarModeloConPartes({
      partes: [{ text: prompt }],
      schema: SCHEMA_RESPUESTA_ASISTENCIA,
    })
    const { normalizarRespuestaDelModelo } = await import('./cliente-modelo.ts')
    itemsModelo = normalizarRespuestaDelModelo(crudo)
  }

  if (itemsModelo.ilegible) {
    throw new ErrorDeSuitPay('medio_ilegible')
  }

  return {
    capturaId,
    medioUrl: '',
    items: itemsModelo.items.map((item) => ({
      textoOriginal: item.textoOriginal,
      cantidad: item.cantidad,
      unidad: item.unidad,
      codigo: item.codigo,
      confidence: item.confidence,
    })),
    cliente: null,
  }
}
