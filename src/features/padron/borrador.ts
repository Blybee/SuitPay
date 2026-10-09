/**
 * Borrador de la grilla de padrón.
 * La lista visible sale del índice; la ficha se carga aparte.
 * Guardar persiste solo las filas sucias.
 */

import type {
  AltaDeCliente,
  AltaDeTransportista,
  CambioDeCliente,
  CambioDeTransportista,
  FichaDeCliente,
  FichaDePadron,
  FichaDeTransportista,
} from '../../domain/padron/edicion.ts'

export type {
  AltaDeCliente,
  AltaDeTransportista,
  CambioDeCliente,
  CambioDeTransportista,
  FichaDeCliente,
  FichaDePadron,
  FichaDeTransportista,
} from '../../domain/padron/edicion.ts'

export type VistaDePadron = 'clientes' | 'transportistas'

export interface FilaDeBorrador {
  readonly clave: string
  readonly numeroDocumento: string
  readonly denominacion: string
  readonly denominacionOrigen: string
  readonly nueva: boolean
  readonly ficha: FichaDePadron | null
  readonly fichaOrigen: FichaDePadron | null
}

export interface DiffDeClientes {
  readonly tipo: 'clientes'
  readonly altas: readonly AltaDeCliente[]
  readonly cambios: readonly CambioDeCliente[]
  readonly tocaIndice: boolean
  readonly errores: readonly string[]
}

export interface DiffDeTransportistas {
  readonly tipo: 'transportistas'
  readonly altas: readonly AltaDeTransportista[]
  readonly cambios: readonly CambioDeTransportista[]
  readonly tocaIndice: boolean
  readonly errores: readonly string[]
}

export type DiffDePadron = DiffDeClientes | DiffDeTransportistas

export interface EntradaParaReconciliar {
  readonly numeroDocumento: string
  readonly denominacion: string
}

export function fichaVacia(vista: VistaDePadron): FichaDePadron {
  if (vista === 'clientes') {
    return {
      direccion: '',
      telefono: '',
      correo: '',
      ubigeo: '',
      condicion: '',
    }
  }
  return { direccion: '', numeroRegistroMtc: '' }
}

export function filaDesdeIndice(entrada: EntradaParaReconciliar): FilaDeBorrador {
  return {
    clave: entrada.numeroDocumento,
    numeroDocumento: entrada.numeroDocumento,
    denominacion: entrada.denominacion,
    denominacionOrigen: entrada.denominacion,
    nueva: false,
    ficha: null,
    fichaOrigen: null,
  }
}

export function filaNueva(
  vista: VistaDePadron,
  clave = `nueva-${crypto.randomUUID()}`,
): FilaDeBorrador {
  return {
    clave,
    numeroDocumento: '',
    denominacion: '',
    denominacionOrigen: '',
    nueva: true,
    ficha: fichaVacia(vista),
    fichaOrigen: null,
  }
}

export function documentoInvalido(vista: VistaDePadron, numero: string): boolean {
  const limpio = numero.trim()
  if (limpio.length === 0) return false
  return tipoDeDocumento(vista, limpio) === null
}

export function filtrarFilas(
  filas: readonly FilaDeBorrador[],
  consulta: string,
): readonly FilaDeBorrador[] {
  const texto = consulta.trim().toLocaleLowerCase()
  if (texto.length === 0) return filas
  return filas.filter(
    (fila) =>
      fila.numeroDocumento.toLocaleLowerCase().includes(texto) ||
      fila.denominacion.toLocaleLowerCase().includes(texto),
  )
}

export function esSucia(fila: FilaDeBorrador): boolean {
  if (fila.nueva) return !estaVacia(fila)
  if (fila.denominacion.trim() !== fila.denominacionOrigen.trim()) return true
  return fichaCambio(fila)
}

export function diffDeBorrador(
  vista: 'clientes',
  filas: readonly FilaDeBorrador[],
): DiffDeClientes
export function diffDeBorrador(
  vista: 'transportistas',
  filas: readonly FilaDeBorrador[],
): DiffDeTransportistas
export function diffDeBorrador(
  vista: VistaDePadron,
  filas: readonly FilaDeBorrador[],
): DiffDePadron
export function diffDeBorrador(
  vista: VistaDePadron,
  filas: readonly FilaDeBorrador[],
): DiffDePadron {
  const errores: string[] = []
  const vistos = new Set<string>()
  const altasCliente: AltaDeCliente[] = []
  const cambiosCliente: CambioDeCliente[] = []
  const altasTransporte: AltaDeTransportista[] = []
  const cambiosTransporte: CambioDeTransportista[] = []
  let tocaIndice = false

  for (const fila of filas) {
    if (fila.nueva && estaVacia(fila)) continue

    const numero = fila.numeroDocumento.trim()
    const nombre = fila.denominacion.trim()

    if (numero.length === 0) {
      errores.push('Falta el documento de una fila nueva.')
      continue
    }
    if (vistos.has(numero)) {
      errores.push(`El documento ${numero} está repetido.`)
      continue
    }
    vistos.add(numero)

    if (nombre.length === 0) {
      errores.push(`Falta el nombre de ${numero}.`)
      continue
    }
    if (nombre.length > 300) {
      errores.push(`El nombre de ${numero} pasa de 300 caracteres.`)
      continue
    }

    if (!fila.nueva) {
      const cambiaNombre = nombre !== fila.denominacionOrigen.trim()
      const cambiaFicha = fichaCambio(fila)
      if (!cambiaNombre && !cambiaFicha) continue
      if (cambiaNombre) tocaIndice = true
      if (vista === 'clientes') {
        const cambio: CambioDeCliente = {
          numeroDocumento: numero,
          denominacion: nombre,
        }
        if (cambiaFicha && esFichaDeCliente(fila.ficha)) {
          cambiosCliente.push({ ...cambio, ficha: recortarCliente(fila.ficha) })
        } else {
          cambiosCliente.push(cambio)
        }
      } else if (cambiaFicha && esFichaDeTransportista(fila.ficha)) {
        cambiosTransporte.push({
          numeroDocumento: numero,
          denominacion: nombre,
          ficha: recortarTransportista(fila.ficha),
        })
      } else {
        cambiosTransporte.push({ numeroDocumento: numero, denominacion: nombre })
      }
      continue
    }

    const tipo = tipoDeDocumento(vista, numero)
    if (tipo === null) {
      errores.push(mensajeDeDocumento(vista, numero))
      continue
    }
    tocaIndice = true
    if (vista === 'clientes') {
      altasCliente.push(altaDeCliente(tipo, numero, nombre, fila.ficha))
    } else {
      altasTransporte.push(altaDeTransportista(numero, nombre, fila.ficha))
    }
  }

  if (vista === 'clientes') {
    return {
      tipo: 'clientes',
      altas: altasCliente,
      cambios: cambiosCliente,
      tocaIndice,
      errores,
    }
  }
  return {
    tipo: 'transportistas',
    altas: altasTransporte,
    cambios: cambiosTransporte,
    tocaIndice,
    errores,
  }
}

export function reconciliarConIndice(
  actuales: readonly FilaDeBorrador[],
  indice: readonly EntradaParaReconciliar[],
): readonly FilaDeBorrador[] {
  const nuevas = actuales.filter((fila) => fila.nueva)
  const persistidas = new Map(
    actuales
      .filter((fila) => !fila.nueva)
      .map((fila) => [fila.numeroDocumento, fila]),
  )
  const numeros = new Set(indice.map((entrada) => entrada.numeroDocumento))
  const huerfanas = actuales.filter(
    (fila) =>
      !fila.nueva && !numeros.has(fila.numeroDocumento) && esSucia(fila),
  )
  const delIndice = indice.map((entrada) => {
    const previa = persistidas.get(entrada.numeroDocumento)
    if (previa === undefined) return filaDesdeIndice(entrada)
    const nombreSucio = previa.denominacion.trim() !== previa.denominacionOrigen.trim()
    return {
      ...previa,
      denominacion: nombreSucio ? previa.denominacion : entrada.denominacion,
      denominacionOrigen: entrada.denominacion,
    }
  })
  return [...nuevas, ...huerfanas, ...delIndice]
}

export function confirmarGuardado(filas: readonly FilaDeBorrador[]): {
  readonly filas: readonly FilaDeBorrador[]
  readonly claves: ReadonlyMap<string, string>
} {
  const claves = new Map<string, string>()
  const siguientes: FilaDeBorrador[] = []
  for (const fila of filas) {
    if (fila.nueva && estaVacia(fila)) {
      claves.set(fila.clave, '')
      continue
    }
    const numero = fila.numeroDocumento.trim()
    const nombre = fila.denominacion.trim()
    const clave = fila.nueva ? numero : fila.clave
    claves.set(fila.clave, clave)
    siguientes.push({
      clave,
      numeroDocumento: numero,
      denominacion: nombre,
      denominacionOrigen: nombre,
      nueva: false,
      ficha: fila.ficha,
      fichaOrigen: fila.ficha,
    })
  }
  return { filas: siguientes, claves }
}

function estaVacia(fila: FilaDeBorrador): boolean {
  if (fila.numeroDocumento.trim() !== '' || fila.denominacion.trim() !== '') {
    return false
  }
  if (fila.ficha === null) return true
  return Object.values(fila.ficha).every((valor) => valor.trim() === '')
}

function fichaCambio(fila: FilaDeBorrador): boolean {
  if (fila.nueva || fila.ficha === null || fila.fichaOrigen === null) return false
  return !fichasIguales(fila.ficha, fila.fichaOrigen)
}

function fichasIguales(a: FichaDePadron, b: FichaDePadron): boolean {
  const izquierda = valoresDeFicha(a)
  const derecha = valoresDeFicha(b)
  if (izquierda.length !== derecha.length) return false
  return izquierda.every((valor, indice) => valor.trim() === (derecha[indice] ?? '').trim())
}

function valoresDeFicha(ficha: FichaDePadron): readonly string[] {
  if ('telefono' in ficha) {
    return [
      ficha.direccion,
      ficha.telefono,
      ficha.correo,
      ficha.ubigeo,
      ficha.condicion,
    ]
  }
  return [ficha.direccion, ficha.numeroRegistroMtc]
}

function esFichaDeCliente(
  ficha: FichaDePadron | null,
): ficha is FichaDeCliente {
  return ficha !== null && 'telefono' in ficha
}

function esFichaDeTransportista(
  ficha: FichaDePadron | null,
): ficha is FichaDeTransportista {
  return ficha !== null && 'numeroRegistroMtc' in ficha
}

function tipoDeDocumento(
  vista: VistaDePadron,
  numero: string,
): 'DNI' | 'RUC' | null {
  if (vista === 'transportistas') return /^\d{11}$/.test(numero) ? 'RUC' : null
  if (/^\d{8}$/.test(numero)) return 'DNI'
  if (/^\d{11}$/.test(numero)) return 'RUC'
  return null
}

function mensajeDeDocumento(vista: VistaDePadron, numero: string): string {
  if (vista === 'transportistas') {
    return `El RUC ${numero || 'vacío'} tiene que tener 11 dígitos.`
  }
  return `El documento ${numero || 'vacío'} tiene que ser un DNI de 8 dígitos o un RUC de 11.`
}

function recortarCliente(ficha: FichaDeCliente): FichaDeCliente {
  return {
    direccion: ficha.direccion.trim(),
    telefono: ficha.telefono.trim(),
    correo: ficha.correo.trim(),
    ubigeo: ficha.ubigeo.trim(),
    condicion: ficha.condicion.trim(),
  }
}

function recortarTransportista(ficha: FichaDeTransportista): FichaDeTransportista {
  return {
    direccion: ficha.direccion.trim(),
    numeroRegistroMtc: ficha.numeroRegistroMtc.trim(),
  }
}

function altaDeCliente(
  tipoDocumento: 'DNI' | 'RUC',
  numeroDocumento: string,
  denominacion: string,
  ficha: FichaDePadron | null,
): AltaDeCliente {
  const alta: AltaDeCliente = { tipoDocumento, numeroDocumento, denominacion }
  if (!esFichaDeCliente(ficha)) return alta
  const limpia = recortarCliente(ficha)
  return {
    ...alta,
    ...(limpia.direccion !== '' ? { direccion: limpia.direccion } : {}),
    ...(limpia.telefono !== '' ? { telefono: limpia.telefono } : {}),
    ...(limpia.correo !== '' ? { correo: limpia.correo } : {}),
    ...(limpia.ubigeo !== '' ? { ubigeo: limpia.ubigeo } : {}),
    ...(limpia.condicion !== '' ? { condicion: limpia.condicion } : {}),
  }
}

function altaDeTransportista(
  numeroDocumento: string,
  denominacion: string,
  ficha: FichaDePadron | null,
): AltaDeTransportista {
  const alta: AltaDeTransportista = { numeroDocumento, denominacion }
  if (!esFichaDeTransportista(ficha)) return alta
  const limpia = recortarTransportista(ficha)
  return {
    ...alta,
    ...(limpia.direccion !== '' ? { direccion: limpia.direccion } : {}),
    ...(limpia.numeroRegistroMtc !== ''
      ? { numeroRegistroMtc: limpia.numeroRegistroMtc }
      : {}),
  }
}
