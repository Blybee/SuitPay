import { create } from 'zustand'

/**
 * El estado degradado.
 *
 * ## Por qué se distinguen tres causas y no una
 *
 * FR-051 obliga a decirle al vendedor **qué capacidad no está disponible**, no
 * solo que algo va mal, y la distinción cambia lo que puede hacer:
 *
 * - **Red caída**: puede seguir armando el pedido, porque la búsqueda es local y
 *   el pedido vive en el dispositivo. No puede emitir. La salida práctica del
 *   local es pasar al wifi de un teléfono de la empresa.
 * - **Asistencia caída**: no puede dictar ni fotografiar guías, pero **puede
 *   vender con normalidad** escribiendo. Es la degradación más benigna de las
 *   tres y decirlo con claridad evita que alguien crea que el sistema entero se
 *   cayó.
 * - **Proveedor caído**: puede vender, y la venta queda en espera con documento
 *   interno. Es la que exige recoger datos de contacto del cliente.
 *
 * Un aviso genérico de "sin conexión" haría que las tres se confundieran, y la
 * segunda es la más frecuente y la que menos importa.
 *
 * ## Por qué es persistente y no una notificación
 *
 * DESIGN.md y FR-051 lo piden explícitamente: una banda fijada, no un mensaje
 * que se desvanece. La razón es la escena: un local ruidoso, con un vendedor de
 * pie que aparta la vista de la pantalla a cada rato para sacar mercadería. Una
 * notificación de cuatro segundos es una notificación que nadie ve, y perderse
 * que el proveedor está caído significa cobrar una venta creyendo que se emitió.
 */

export const CAUSAS = ['red', 'asistencia', 'proveedor'] as const
export type CausaDeDegradacion = (typeof CAUSAS)[number]

export interface Degradacion {
  readonly causa: CausaDeDegradacion
  readonly desde: number
  /** Qué no se puede hacer, en palabras para el vendedor. */
  readonly capacidadPerdida: string
  /** Qué sí puede hacer mientras tanto. Nunca vacío: siempre hay algo. */
  readonly loQueSiFunciona: string
}

const DESCRIPCIONES: Record<
  CausaDeDegradacion,
  { capacidadPerdida: string; loQueSiFunciona: string }
> = {
  red: {
    capacidadPerdida: 'Sin conexión: no se puede emitir ni guardar cotizaciones.',
    loQueSiFunciona:
      'Puedes seguir armando el pedido; no se pierde. Prueba con el wifi del teléfono.',
  },
  asistencia: {
    capacidadPerdida: 'El dictado y la lectura de fotos no están disponibles.',
    loQueSiFunciona: 'La venta funciona con normalidad escribiendo el pedido.',
  },
  proveedor: {
    capacidadPerdida: 'El servicio de emisión no responde.',
    loQueSiFunciona:
      'Puedes cobrar: la venta queda en espera. Toma el teléfono del cliente y entrégale el documento interno.',
  },
}

interface EstadoDeDegradacion {
  readonly activas: readonly Degradacion[]
}

interface AccionesDeDegradacion {
  declarar: (causa: CausaDeDegradacion) => void
  resolver: (causa: CausaDeDegradacion) => void
  resolverTodas: () => void
}

export type AlmacenDeDegradacion = EstadoDeDegradacion & AccionesDeDegradacion

export const usarDegradacion = create<AlmacenDeDegradacion>((set, get) => ({
  activas: [],

  declarar(causa) {
    // Declarar dos veces la misma causa no reinicia su antigüedad. El "desde"
    // sirve para poder decir cuánto lleva así, y reiniciarlo en cada reintento
    // fallido lo volvería inútil.
    if (get().activas.some((cada) => cada.causa === causa)) return
    set({
      activas: [
        ...get().activas,
        { causa, desde: Date.now(), ...DESCRIPCIONES[causa] },
      ],
    })
  },

  resolver(causa) {
    set({ activas: get().activas.filter((cada) => cada.causa !== causa) })
  },

  resolverTodas() {
    set({ activas: [] })
  },
}))

/**
 * La degradación que se muestra cuando hay varias. Se ordena por gravedad y no
 * por orden de llegada: si la red está caída, decir que la asistencia no
 * funciona es información cierta e inútil.
 */
const GRAVEDAD: Record<CausaDeDegradacion, number> = {
  red: 3,
  proveedor: 2,
  asistencia: 1,
}

export function degradacionPrincipal(
  estado: AlmacenDeDegradacion,
): Degradacion | null {
  const ordenadas = [...estado.activas].sort(
    (uno, otro) => GRAVEDAD[otro.causa] - GRAVEDAD[uno.causa],
  )
  return ordenadas[0] ?? null
}

export function estaDegradado(estado: AlmacenDeDegradacion): boolean {
  return estado.activas.length > 0
}

export function sePuedeEmitir(estado: AlmacenDeDegradacion): boolean {
  return !estado.activas.some(
    (cada) => cada.causa === 'red' || cada.causa === 'proveedor',
  )
}

/**
 * Vigila la conectividad del navegador.
 *
 * `navigator.onLine` es notoriamente optimista: dice que hay red cuando hay
 * interfaz de red, aunque el router no llegue a ninguna parte. Sirve para
 * detectar el corte evidente, y de ahí que **un fallo real de una operación
 * también declare la degradación**: la señal fiable es que algo no funcionó, no
 * que el sistema operativo crea que hay cable.
 */
export function vigilarConectividad(): () => void {
  if (typeof window === 'undefined') return () => {}

  const declarar = () => usarDegradacion.getState().declarar('red')
  const resolver = () => usarDegradacion.getState().resolver('red')

  if (!navigator.onLine) declarar()

  window.addEventListener('offline', declarar)
  window.addEventListener('online', resolver)

  return () => {
    window.removeEventListener('offline', declarar)
    window.removeEventListener('online', resolver)
  }
}
