import { centimosDesdeSoles } from '../totales/calculo.ts'
import { fusionarCoincidencias } from './fusionar.ts'
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
  }
  const coincidencias: CoincidenciaDeCompra[] = []
  const sinMatch: LineaSinMatchDeCompra[] = []

  if (Array.isArray(crudo.coincidencias)) {
    for (const item of crudo.coincidencias) {
      if (!item || typeof item !== 'object') continue
      const fila = item as Record<string, unknown>
      const codigo = texto(fila, 'codigo')
      const precio = centimosDeFila(fila)
      const etiqueta =
        texto(fila, 'etiquetaFactura') || texto(fila, 'descripcion') || codigo
      const fecha = fechaDeFila(fila)
      if (codigo === '' || precio === undefined || !codigosValidos.has(codigo)) {
        sinMatch.push({
          etiquetaFactura: etiqueta || codigo || 'línea sin código',
          ...(precio !== undefined ? { precioCompraCentimos: precio } : {}),
          ...(fecha !== undefined ? { precioCompraEn: fecha } : {}),
        })
        continue
      }
      coincidencias.push({
        codigo,
        precioCompraCentimos: precio,
        etiquetaFactura: etiqueta,
        ...(fecha !== undefined ? { precioCompraEn: fecha } : {}),
      })
    }
  }

  if (Array.isArray(crudo.sinMatch)) {
    for (const item of crudo.sinMatch) {
      if (!item || typeof item !== 'object') continue
      const fila = item as Record<string, unknown>
      const etiqueta = texto(fila, 'etiquetaFactura') || texto(fila, 'descripcion')
      if (etiqueta === '') continue
      const precio = centimosDeFila(fila)
      const fecha = fechaDeFila(fila)
      sinMatch.push({
        etiquetaFactura: etiqueta,
        ...(precio !== undefined ? { precioCompraCentimos: precio } : {}),
        ...(fecha !== undefined ? { precioCompraEn: fecha } : {}),
      })
    }
  }

  return {
    coincidencias: fusionarCoincidencias(coincidencias),
    sinMatch,
    modelo,
  }
}
