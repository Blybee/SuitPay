import { agruparPorFila, textoDeFila, unirDireccion } from './filas.ts'
import type {
  ClienteDePadron,
  ItemDeTexto,
  LecturaDePadron,
  PaginaDeTexto,
  TransportistaDePadron,
} from './tipos.ts'

/**
 * Cada ficha del listado cabe en su página (14 clientes, o un bloque de
 * transportistas). El registro abierto se cierra al terminar la página: si se
 * arrastrara, el encabezado de la página siguiente se pegaría a la dirección.
 */

const X_NUMERO_CLIENTE = 70
const X_DOCUMENTO_CLIENTE = 120
const X_NOMBRE_CLIENTE = 400
const X_CODIGO_TRANSPORTISTA = 52
const X_RUC_TRANSPORTISTA = 460

function esVendedor(fila: readonly ItemDeTexto[]): boolean {
  return /^VENDEDOR\s*:/i.test(textoDeFila(fila))
}

function esTelefono(texto: string): boolean {
  const limpio = texto.trim()
  if (!/^[\d\s+()./-]+$/.test(limpio)) return false
  const digitos = limpio.replace(/\D/g, '')
  return digitos.length >= 6 && digitos.length <= 15
}

function telefonoDe(fila: readonly ItemDeTexto[]): string | undefined {
  const partes = fila
    .filter((item) => item.x >= X_NOMBRE_CLIENTE && esTelefono(item.str))
    .map((item) => item.str.trim())
  if (partes.length === 0) return undefined
  const junto = partes.join(' / ')
  const elegido = junto.length <= 30 ? junto : (partes[0] ?? junto)
  const recortado = elegido.slice(0, 30).trim()
  return recortado.length === 0 ? undefined : recortado
}

function nombreEntre(
  fila: readonly ItemDeTexto[],
  desde: number,
  hasta: number,
): string {
  return fila
    .filter((item) => item.x >= desde && item.x < hasta)
    .map((item) => item.str.trim())
    .filter((texto) => texto.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type IdentidadCliente =
  | { readonly tipo: 'otra' }
  | { readonly tipo: 'invalida' }
  | { readonly tipo: 'valida'; readonly cliente: ClienteDePadron }

function identidadDeCliente(fila: readonly ItemDeTexto[]): IdentidadCliente {
  const numero = fila.find(
    (item) => item.x < X_NUMERO_CLIENTE && /^\d{1,6}$/.test(item.str.trim()),
  )
  if (numero === undefined) return { tipo: 'otra' }

  const documento = fila.find(
    (item) =>
      item.x >= X_NUMERO_CLIENTE &&
      item.x < X_DOCUMENTO_CLIENTE &&
      /^\d{8}$|^\d{11}$/.test(item.str.trim()),
  )
  const denominacion = nombreEntre(
    fila,
    X_DOCUMENTO_CLIENTE,
    X_NOMBRE_CLIENTE,
  ).slice(0, 300)
  if (documento === undefined || denominacion.length < 2) {
    return { tipo: 'invalida' }
  }

  const numeroDocumento = documento.str.trim()
  const telefono = telefonoDe(fila)
  return {
    tipo: 'valida',
    cliente: {
      tipoDocumento: numeroDocumento.length === 11 ? 'RUC' : 'DNI',
      numeroDocumento,
      denominacion,
      ...(telefono !== undefined ? { telefono } : {}),
    },
  }
}

type IdentidadTransportista =
  | { readonly tipo: 'otra' }
  | { readonly tipo: 'invalida' }
  | { readonly tipo: 'valida'; readonly transportista: TransportistaDePadron }

function identidadDeTransportista(
  fila: readonly ItemDeTexto[],
): IdentidadTransportista {
  const codigo = fila.find(
    (item) =>
      item.x < X_CODIGO_TRANSPORTISTA && /^\d{1,6}$/.test(item.str.trim()),
  )
  if (codigo === undefined) return { tipo: 'otra' }

  const ruc = fila.find(
    (item) => item.x >= X_RUC_TRANSPORTISTA && /^\d{11}$/.test(item.str.trim()),
  )
  const denominacion = nombreEntre(
    fila,
    X_CODIGO_TRANSPORTISTA,
    X_RUC_TRANSPORTISTA,
  ).slice(0, 300)
  if (ruc === undefined || denominacion.length < 2) {
    return { tipo: 'invalida' }
  }

  return {
    tipo: 'valida',
    transportista: {
      numeroDocumento: ruc.str.trim(),
      denominacion,
    },
  }
}

function direccionRecortada(texto: string | undefined): string | undefined {
  if (texto === undefined) return undefined
  const limpia = texto.replace(/\s+/g, ' ').trim().slice(0, 300)
  return limpia.length === 0 ? undefined : limpia
}

export function parsearClientes(
  paginas: readonly PaginaDeTexto[],
): LecturaDePadron<ClienteDePadron> {
  const vistos = new Set<string>()
  const filas: ClienteDePadron[] = []
  let descartados = 0

  for (const pagina of paginas) {
    let abierto: ClienteDePadron | undefined
    let direccion: string | undefined

    const cerrar = (): void => {
      if (abierto === undefined) return
      const direccionFinal = direccionRecortada(direccion)
      const ficha: ClienteDePadron = {
        ...abierto,
        ...(direccionFinal !== undefined ? { direccion: direccionFinal } : {}),
      }
      if (vistos.has(ficha.numeroDocumento)) {
        descartados += 1
      } else {
        vistos.add(ficha.numeroDocumento)
        filas.push(ficha)
      }
      abierto = undefined
      direccion = undefined
    }

    for (const fila of agruparPorFila(pagina.items)) {
      if (esVendedor(fila)) continue
      const identidad = identidadDeCliente(fila)
      if (identidad.tipo === 'valida') {
        cerrar()
        abierto = identidad.cliente
        continue
      }
      if (identidad.tipo === 'invalida') {
        cerrar()
        descartados += 1
        continue
      }
      if (abierto !== undefined) {
        direccion = unirDireccion(direccion, textoDeFila(fila))
      }
    }
    cerrar()
  }

  return { filas, descartados }
}

export function parsearTransportistas(
  paginas: readonly PaginaDeTexto[],
): LecturaDePadron<TransportistaDePadron> {
  const vistos = new Set<string>()
  const filas: TransportistaDePadron[] = []
  let descartados = 0

  for (const pagina of paginas) {
    let abierto: TransportistaDePadron | undefined
    let direccion: string | undefined

    const cerrar = (): void => {
      if (abierto === undefined) return
      const direccionFinal = direccionRecortada(direccion)
      const ficha: TransportistaDePadron = {
        ...abierto,
        ...(direccionFinal !== undefined ? { direccion: direccionFinal } : {}),
      }
      if (vistos.has(ficha.numeroDocumento)) {
        descartados += 1
      } else {
        vistos.add(ficha.numeroDocumento)
        filas.push(ficha)
      }
      abierto = undefined
      direccion = undefined
    }

    for (const fila of agruparPorFila(pagina.items)) {
      const identidad = identidadDeTransportista(fila)
      if (identidad.tipo === 'valida') {
        cerrar()
        abierto = identidad.transportista
        continue
      }
      if (identidad.tipo === 'invalida') {
        cerrar()
        descartados += 1
        continue
      }
      if (abierto !== undefined) {
        direccion = unirDireccion(direccion, textoDeFila(fila))
      }
    }
    cerrar()
  }

  return { filas, descartados }
}
