import { compactarCatalogo } from '../../domain/aprendizaje/compacto.ts'
import { compactoParaCompras } from '../../domain/compras/compacto.ts'
import { parsearBocetoDeCompras } from '../../domain/compras/parsear.ts'
import type { BocetoDeCompras } from '../../domain/compras/tipos.ts'
import {
  MAX_MEDIOS_COMPRAS,
  TECHO_MEDIO_COMPRAS_BYTES,
  TECHO_MEDIOS_COMPRAS_BYTES,
} from '../../domain/compras/tipos.ts'
import { ErrorDeSuitPay } from '../errores.ts'
import {
  MODELO_POR_DEFECTO,
  invocarModeloConPartes,
} from '../asistencia/cliente-modelo.ts'
import type { ParteGemini } from '../asistencia/cliente-modelo.ts'
import { asistenciaSimuladaActiva } from '../asistencia/simulado.ts'
import { productosParaCompacto } from '../aprendizaje/catalogo-compacto.ts'
import { AlmacenDeCatalogoFirestore } from '../catalogo/almacen-firestore.ts'
import { promptDePreciosCompra, SCHEMA_PRECIOS_COMPRA } from './prompts.ts'

const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface MedioDeCompra {
  readonly mimeType: string
  readonly dataBase64: string
}

function bytesDeBase64(data: string): number {
  return Math.floor((data.length * 3) / 4)
}

export function exigirMediosDeCompra(
  medios: readonly MedioDeCompra[],
): void {
  if (medios.length === 0) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'sin_archivo' })
  }
  if (medios.length > MAX_MEDIOS_COMPRAS) {
    throw new ErrorDeSuitPay('peticion_invalida', {
      motivo: 'demasiados_archivos',
    })
  }
  let total = 0
  for (const medio of medios) {
    if (!MIME_PERMITIDOS.has(medio.mimeType)) {
      throw new ErrorDeSuitPay('peticion_invalida', {
        motivo: 'tipo_no_aceptado',
      })
    }
    const bytes = bytesDeBase64(medio.dataBase64)
    if (bytes > TECHO_MEDIO_COMPRAS_BYTES) {
      throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'archivo_grande' })
    }
    total += bytes
  }
  if (total > TECHO_MEDIOS_COMPRAS_BYTES) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'archivo_grande' })
  }
}

function parteDeMedio(medio: MedioDeCompra): ParteGemini {
  const imagen = medio.mimeType.startsWith('image/')
  return {
    inlineData: { mimeType: medio.mimeType, data: medio.dataBase64 },
    ...(imagen ? { mediaResolution: { level: 'MEDIA_RESOLUTION_HIGH' } } : {}),
  }
}

export function extraerPreciosCompraSimulado(
  codigosValidos: ReadonlySet<string>,
): BocetoDeCompras {
  const primero = [...codigosValidos][0]
  if (primero === undefined) {
    return { coincidencias: [], sinMatch: [], modelo: 'simulado' }
  }
  return parsearBocetoDeCompras(
    {
      coincidencias: [
        {
          codigo: primero,
          precioCompraCentimos: 1250,
          precioCompraEn: '2026-03-15',
          etiquetaFactura: 'línea simulada de factura',
        },
      ],
      sinMatch: [
        {
          etiquetaFactura: 'accesorio no catalogado',
          precioCompraCentimos: 300,
        },
      ],
    },
    codigosValidos,
    'simulado',
  )
}

export async function extraerPreciosCompra(entrada: {
  readonly medios: readonly MedioDeCompra[]
}): Promise<BocetoDeCompras> {
  exigirMediosDeCompra(entrada.medios)
  const publicado = await new AlmacenDeCatalogoFirestore().leerPublicado()
  if (publicado === null || publicado.productos.length === 0) {
    throw new ErrorDeSuitPay('peticion_invalida', { motivo: 'sin_catalogo' })
  }
  const compacto = compactarCatalogo(
    productosParaCompacto(publicado.productos, publicado.categorias),
    {},
  )
  const codigosValidos = new Set(compacto.map((item) => item.id))

  if (asistenciaSimuladaActiva()) {
    return extraerPreciosCompraSimulado(codigosValidos)
  }

  const modelo = process.env.ASISTENCIA_MODELO ?? MODELO_POR_DEFECTO
  const prompt = promptDePreciosCompra({
    catalogoJson: compactoParaCompras(compacto),
    archivos: entrada.medios.length,
  })
  const partes: ParteGemini[] = [{ text: prompt }]
  for (const medio of entrada.medios) partes.push(parteDeMedio(medio))
  try {
    const crudo = await invocarModeloConPartes({
      partes,
      schema: SCHEMA_PRECIOS_COMPRA,
      timeoutMs: 90_000,
    })
    return parsearBocetoDeCompras(crudo, codigosValidos, modelo)
  } catch (error) {
    if (error instanceof ErrorDeSuitPay) throw error
    throw new ErrorDeSuitPay('asistencia_no_disponible')
  }
}
