import { centimosDesdeSoles } from '../totales/calculo.ts'
import { fusionarCoincidencias } from './fusionar.ts'
import {
  centimosDeDecimales,
  normalizarDecimal,
  normalizarMoneda,
} from './moneda.ts'
import type { MonedaDeCompra } from './moneda.ts'
import type {
  BocetoDeCompras,
  CoincidenciaDeCompra,
  LineaSinMatchDeCompra,
} from './tipos.ts'

const FECHA = /^\d{4}-\d{2}-\d{2}$/

function enteroNoNegativo(valor: unknown): number | undefined {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) {
    return Math.round(valor)
  }
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number.parseFloat(valor.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) return Math.round(n)
  }
  return undefined
}

function centimosDeFila(fila: Record<string, unknown>): number | undefined {
  const directo = enteroNoNegativo(fila['precioCompraCentimos'])
  if (directo !== undefined) return directo
  const soles = fila['precioCompraSoles']
  if (typeof soles === 'number' && Number.isFinite(soles) && soles >= 0) {
    return centimosDesdeSoles(soles)
  }
  return undefined
}

function precioImpreso(fila: Record<string, unknown>): string | undefined {
  const crudo = fila['precioUnitario'] ?? fila['precioCompraSoles']
  if (typeof crudo === 'number' && Number.isFinite(crudo) && crudo >= 0) {
    return normalizarDecimal(String(crudo))
  }
  if (typeof crudo === 'string') return normalizarDecimal(crudo)
  return undefined
}

function monedaDe(
  fila: Record<string, unknown>,
  documento: MonedaDeCompra | undefined,
): MonedaDeCompra {
  return normalizarMoneda(fila['moneda']) ?? documento ?? 'PEN'
}

function fechaDeFila(fila: Record<string, unknown>): string | undefined {
  const crudo = fila['precioCompraEn'] ?? fila['fecha']
  if (typeof crudo !== 'string') return undefined
  const recorte = crudo.trim().slice(0, 10)
  return FECHA.test(recorte) ? recorte : undefined
}

function texto(fila: Record<string, unknown>, clave: string): string {
  const valor = fila[clave]
  return typeof valor === 'string' ? valor.trim() : ''
}

function fechaDeValor(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const recorte = valor.trim().slice(0, 10)
  return FECHA.test(recorte) ? recorte : undefined
}

function lecturaDePrecio(
  fila: Record<string, unknown>,
  documento: MonedaDeCompra | undefined,
  fecha: string | undefined,
):
  | Pick<
      CoincidenciaDeCompra,
      'precioCompraCentimos' | 'precioCompraEn' | 'moneda' | 'precioOriginal'
    >
  | undefined {
  const moneda = monedaDe(fila, documento)
  const impreso = precioImpreso(fila)
  const conFecha = fecha !== undefined ? { precioCompraEn: fecha } : {}
  if (moneda === 'USD') {
    const legado = centimosDeFila(fila)
    const original =
      impreso ?? (legado !== undefined ? (legado / 100).toFixed(2) : undefined)
    if (original === undefined) return undefined
    return { moneda: 'USD', precioOriginal: original, ...conFecha }
  }
  const centimos =
    impreso !== undefined
      ? centimosDeDecimales(impreso, '1')
      : centimosDeFila(fila)
  if (centimos === undefined) return undefined
  return { precioCompraCentimos: centimos, ...conFecha }
}

function restoDeLinea(
  leida: ReturnType<typeof lecturaDePrecio>,
): Pick<
  LineaSinMatchDeCompra,
  'precioCompraCentimos' | 'precioCompraEn' | 'moneda' | 'precioOriginal'
> {
  if (leida === undefined) return {}
  return leida
}

export function parsearBocetoDeCompras(
  valor: unknown,
  codigosValidos: ReadonlySet<string>,
  modelo: string,
): BocetoDeCompras {
  if (!valor || typeof valor !== 'object') {
    return { coincidencias: [], sinMatch: [], modelo }
  }
  const crudo = valor as {
    coincidencias?: unknown
    sinMatch?: unknown
    moneda?: unknown
    fecha?: unknown
  }
  const monedaDocumento = normalizarMoneda(crudo.moneda)
  const fechaDocumento = fechaDeValor(crudo.fecha)
  const coincidencias: CoincidenciaDeCompra[] = []
  const sinMatch: LineaSinMatchDeCompra[] = []

  if (Array.isArray(crudo.coincidencias)) {
    for (const item of crudo.coincidencias) {
      if (!item || typeof item !== 'object') continue
      const fila = item as Record<string, unknown>
      const codigo = texto(fila, 'codigo')
      const etiqueta =
        texto(fila, 'etiquetaFactura') || texto(fila, 'descripcion') || codigo
      const fecha = fechaDeFila(fila) ?? fechaDocumento
      const leida = lecturaDePrecio(fila, monedaDocumento, fecha)
      if (codigo === '' || leida === undefined || !codigosValidos.has(codigo)) {
        sinMatch.push({
          etiquetaFactura: etiqueta || codigo || 'línea sin código',
          ...restoDeLinea(leida),
        })
        continue
      }
      coincidencias.push({
        codigo,
        etiquetaFactura: etiqueta,
        ...leida,
      })
    }
  }

  if (Array.isArray(crudo.sinMatch)) {
    for (const item of crudo.sinMatch) {
      if (!item || typeof item !== 'object') continue
      const fila = item as Record<string, unknown>
      const etiqueta =
        texto(fila, 'etiquetaFactura') || texto(fila, 'descripcion')
      if (etiqueta === '') continue
      const fecha = fechaDeFila(fila) ?? fechaDocumento
      const leida = lecturaDePrecio(fila, monedaDocumento, fecha)
      sinMatch.push({
        etiquetaFactura: etiqueta,
        ...restoDeLinea(leida),
      })
    }
  }

  return {
    coincidencias: fusionarCoincidencias(coincidencias),
    sinMatch,
    modelo,
  }
}
