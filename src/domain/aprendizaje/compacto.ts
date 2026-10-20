/**
 * Catálogo compacto para asistencia (constitución IV v1.4.0).
 * Sin precio de venta, stock, costo de compra ni ficha de cliente.
 */

export interface EntradaDeMemoria {
  readonly aliases: readonly string[]
  readonly etiquetas: readonly string[]
}

export interface ProductoParaCompacto {
  readonly codigo: string
  readonly descripcion: string
  readonly activo?: boolean
  readonly marca?: string
  readonly familia?: string
}

export interface ItemCatalogoCompacto {
  readonly id: string
  readonly n: string
  readonly m: string
  readonly a: readonly string[]
  readonly e: readonly string[]
}

export function compactarCatalogo(
  productos: readonly ProductoParaCompacto[],
  memoria: Readonly<Record<string, EntradaDeMemoria>>,
): readonly ItemCatalogoCompacto[] {
  return productos
    .filter((p) => p.activo !== false)
    .map((p) => {
      const entrada = memoria[p.codigo]
      return {
        id: p.codigo,
        n: p.descripcion,
        m: (p.marca ?? '').trim(),
        a: entrada?.aliases ?? [],
        e: entrada?.etiquetas ?? [],
      }
    })
}

export function anonimizarNotas(
  notas: readonly string[],
): readonly string[] {
  return notas
    .map((nota) => anonimizarTexto(nota))
    .filter((nota) => nota.length > 0)
}

const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const TELEFONO =
  /(?:\+51|0051)[\s.-]*9(?:[\s.-]*\d){8}|(?<![\d])9(?:[\s.-]?\d){8}(?![\d])/g
const DIRECCION =
  /\b(?:Avenida|Av|Jir[oó]n|Jr|Calle|Pasaje|Psje|Manzana|Mz|Lote|Lt)\.?(?:\s+[\p{L}\p{N}][\p{L}\p{N}.'’-]*){1,5}/giu
const NOMBRE =
  "\\p{Lu}[\\p{L}'’-]{1,40}"
const TRATAMIENTO = new RegExp(
  `\\b(?:Sr\\.?|Sra\\.?|Se[nñ]or(?:a)?|[Cc]liente)\\s+(${NOMBRE}(?:\\s+(?:de|del|la|los|las)\\s+${NOMBRE}|\\s+${NOMBRE}){0,3})`,
  'gu',
)
const DOCUMENTO = /(?<![\w-])\d{8,11}(?![\w-])/g

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Quita del texto lo que identifica a un cliente antes de salir a un modelo.
 * Los códigos con guion (`TUB-PVC-12`, `SKU-12345678`) y las cantidades cortas
 * se quedan: no son un documento suelto.
 */
export function anonimizarTexto(
  valor: string,
  nombresDeClientes: readonly string[] = [],
): string {
  let texto = valor
  texto = texto.replace(CORREO, '[correo]')
  texto = texto.replace(TELEFONO, '[tel]')
  texto = texto.replace(DIRECCION, '[dir]')
  texto = texto.replace(TRATAMIENTO, (coincidencia, nombre: string) =>
    coincidencia.replace(nombre, '[nombre]'),
  )
  const nombres = [...nombresDeClientes]
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre.length >= 4)
    .sort((a, b) => b.length - a.length)
  for (const nombre of nombres) {
    const patron = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaparRegex(nombre)}(?![\\p{L}\\p{N}])`,
      'giu',
    )
    texto = texto.replace(patron, '[cliente]')
  }
  texto = texto.replace(DOCUMENTO, '[doc]')
  return texto.trim()
}
