import type { EstadoDeComprobante } from '../../domain/documentos/tipos.ts'
import type { EstadoNormalizado, ClaseDeFallo  } from '../proveedor/interfaz.ts'

/**
 * La máquina de estados del comprobante.
 *
 * ## Por qué esto es una tabla y no una serie de condicionales
 *
 * La regla más importante del sistema es negativa: **desde `indeterminado` está
 * prohibido volver a emitir**. Una prohibición repartida por condicionales a lo
 * largo del código es una prohibición que alguien terminará saltándose sin
 * enterarse, porque nada le avisará. Aquí es un dato: `TRANSICIONES` enumera lo
 * permitido y todo lo que no aparece está prohibido por omisión.
 *
 * La razón de fondo es que `indeterminado` significa literalmente "no sabemos si
 * el documento existe". Volver a emitir desde ahí es apostar a que no existe, y
 * si la apuesta sale mal el resultado es un comprobante fiscal duplicado que hay
 * que anular. La única salida legítima es preguntarle al proveedor, que es lo que
 * hace la reconciliación.
 *
 * ## Qué significa exactamente `enviado`, que no es lo que parece
 *
 * Ésta es la sutileza más importante del módulo y equivocarla rompe el mostrador.
 *
 * `enviado` **no** significa "estamos esperando al proveedor". Significa que el
 * proveedor ha confirmado que **tiene el documento, lo ha firmado y lo está
 * tramitando** hacia la autoridad por su cuenta. Es lo que devuelven sus estados
 * `01`, `03` y `19`, que son la respuesta inmediata más frecuente.
 *
 * La consecuencia práctica: en `enviado` **la venta está cerrada**. El documento
 * existe, tiene su PDF y el vendedor puede entregarlo. Que la constancia de la
 * autoridad llegue diez minutos más tarde no es asunto del mostrador, porque el
 * proveedor firma en sus servidores y mantiene su propia cola de reintentos.
 *
 * Tratar `enviado` como un estado de espera habría sido el error caro: el vendedor
 * se quedaría mirando la pantalla con el cliente delante esperando algo que puede
 * tardar minutos, u horas si la autoridad está caída, cuando el papel que tiene
 * que entregar ya está listo. Ver `ventaEstaCerrada`.
 *
 * ## Por qué `enviado` no se escribe antes de llamar al proveedor
 *
 * El diagrama de `data-model.md` lo coloca entre `reclamado` y el desenlace.
 * Escribirlo *antes* de la llamada costaría **una escritura de Firestore más por
 * venta**, y solo compraría distinguir un proceso que murió antes de llamar de
 * uno que murió después.
 *
 * Esa distinción sale más barata por otro lado: la reconciliación barre también
 * los `reclamado` **envejecidos** (ver `exigeVerificacion`). Un comprobante que
 * sigue en `reclamado` pasados unos minutos significa que el proceso se cayó en
 * algún punto alrededor de la llamada, y no se puede saber de qué lado. Tratarlo
 * como verificable cuesta una consulta; darlo por no emitido costaría un duplicado.
 */

/**
 * Lo permitido, por estado de origen. Todo lo ausente está prohibido.
 *
 * Nótese lo que **no** sale de `indeterminado`: no puede ir a `reclamado` ni a
 * `enviado`. Solo a los estados que la reconciliación puede constatar, o a
 * `requiere_intervencion` cuando no consigue constatar nada.
 */
const TRANSICIONES: Record<
  EstadoDeComprobante,
  readonly EstadoDeComprobante[]
> = {
  // Va directo al desenlace. Ver más abajo por qué `enviado` no se persiste en
  // el camino de la emisión. `requiere_intervencion` está porque la
  // reconciliación barre los `reclamado` envejecidos y alguno no se podrá
  // esclarecer.
  reclamado: [
    'enviado',
    'aceptado',
    'rechazado',
    'indeterminado',
    'pendiente',
    'requiere_intervencion',
  ],

  // El documento ya existe, así que se puede anular el mismo día sin esperar la
  // constancia de la autoridad.
  enviado: ['aceptado', 'rechazado', 'indeterminado', 'pendiente', 'anulado'],

  // Solo la reconciliación sale de aquí, y solo tras consultar al proveedor.
  //
  // `enviado` **sí** está permitido, y es importante entender por qué no
  // contradice la prohibición: llegar a `enviado` desde aquí es lo que ocurre
  // cuando la reconciliación **descubre** que el proveedor tenía el documento
  // todo el tiempo. Es adoptar un hecho, no producirlo.
  //
  // La prohibición de reintentar no vive en esta tabla: vive en
  // `sePuedeInvocarEmision`, que es lo que decide si se puede *llamar* al
  // proveedor. Confundir "a qué estado puede pasar" con "qué acción se permite"
  // fue un error de la primera versión de este archivo.
  indeterminado: [
    'enviado',
    'aceptado',
    'rechazado',
    'anulado',
    'pendiente',
    'requiere_intervencion',
  ],

  // La venta esperó porque el proveedor no respondía. La tarea programada
  // completa la emisión, y de ahí sí se puede volver a `enviado`: en este estado
  // sabemos con certeza que **no** se emitió nada.
  //
  // `indeterminado` está aquí porque el reintento programado puede recibir a su
  // vez una respuesta ambigua. Sin esta transición, esa venta se quedaría en
  // `pendiente` y el barrido la reintentaría en cada pasada, creando un documento
  // nuevo cada vez. Es decir: su ausencia era un generador de duplicados.
  pendiente: [
    'enviado',
    'aceptado',
    'rechazado',
    'indeterminado',
    'requiere_intervencion',
  ],

  aceptado: ['anulado'],

  // Un rechazo es definitivo. La corrección es un documento nuevo, con su propia
  // clave, no una transición de este.
  rechazado: [],

  anulado: [],

  // No se cierra solo: sale de aquí cuando una persona decide qué pasó.
  requiere_intervencion: ['aceptado', 'rechazado', 'anulado'],
}

export function transicionPermitida(
  desde: EstadoDeComprobante,
  hacia: EstadoDeComprobante,
): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

/**
 * Si desde este estado se puede invocar al proveedor para emitir.
 *
 * **Ésta es la función que impide el duplicado**, no la tabla de transiciones. La
 * distinción es la lección que costó dos fallos encontrados por las pruebas: la
 * tabla dice a qué estados puede *pasar* un comprobante, incluidos los que la
 * reconciliación descubre; esta función dice cuándo se puede *llamar* al
 * proveedor, que es la acción peligrosa.
 *
 * Solo `reclamado` y `pendiente`, y en los dos consta que no hay documento del
 * otro lado. Está escrita como lista blanca corta a propósito: si alguien añade un
 * estado nuevo, por omisión **no** podrá emitir y tendrá que venir aquí a
 * decidirlo explícitamente.
 */
export function sePuedeInvocarEmision(estado: EstadoDeComprobante): boolean {
  return estado === 'reclamado' || estado === 'pendiente'
}

/**
 * Si el comprobante ya alcanzó un estado del que no se mueve por sí solo. Es lo
 * que permite a una segunda petición con la misma clave contestar sin tocar nada.
 */
export function esEstadoFinal(estado: EstadoDeComprobante): boolean {
  return TRANSICIONES[estado].length === 0
}

/**
 * Cuánto puede llevar un comprobante en un estado de tránsito antes de que haya
 * que ir a preguntarle al proveedor qué pasó.
 *
 * Cinco minutos es holgado para una emisión que normalmente tarda segundos, y
 * corto para que una venta no se quede en el limbo toda la tarde.
 */
export const MINUTOS_ANTES_DE_VERIFICAR = 5

/**
 * Si un comprobante atascado en `reclamado` lleva ahí demasiado tiempo y hay que
 * preguntarle al proveedor qué pasó.
 *
 * Cubre un caso que no aparece en ningún requisito porque no es una regla de
 * negocio sino una realidad de la operación: **el proceso puede morir entre la
 * llamada al proveedor y la escritura del resultado**. Cuando eso pasa, el
 * comprobante se queda en `reclamado` y no hay forma de saber, desde el propio
 * dato, si el proveedor llegó a recibirlo.
 *
 * Solo `reclamado`. `enviado` no entra: ahí el proveedor ya confirmó que tiene el
 * documento, así que no hay nada que averiguar.
 */
export function exigeVerificacion(
  estado: EstadoDeComprobante,
  emitidoEn: Date,
  ahora: Date,
): boolean {
  if (estado !== 'reclamado') return false
  const minutos = (ahora.getTime() - emitidoEn.getTime()) / 60_000
  return minutos >= MINUTOS_ANTES_DE_VERIFICAR
}

/**
 * Traduce el resultado del proveedor al estado del comprobante, según la tabla de
 * la decisión 4b de `research.md`.
 *
 * `registrado` y `sin_respuesta_autoridad` van a `enviado` y **no** a `aceptado`.
 * La distinción es honesta: decir `aceptado` afirmaría que la autoridad lo aceptó,
 * y todavía no lo ha hecho. Que la venta esté cerrada para el mostrador es otra
 * cosa, y de eso se encarga `ventaEstaCerrada`.
 */
export function estadoSegunProveedor(
  informado: EstadoNormalizado,
): EstadoDeComprobante {
  switch (informado) {
    case 'aceptado':
      return 'aceptado'
    case 'registrado':
    case 'sin_respuesta_autoridad':
      return 'enviado'
    case 'rechazado':
      return 'rechazado'
    case 'anulado':
      return 'anulado'
  }
}

/**
 * Si la venta está cerrada desde el punto de vista del mostrador: el documento
 * existe, es entregable y no hay nada que el vendedor deba hacer ni esperar.
 *
 * Es distinto de `esEstadoFinal`, que habla de la máquina de estados. Aquí se
 * responde a la única pregunta que importa con un cliente delante: **¿puedo dar
 * por hecha esta venta y atender al siguiente?**
 */
export function ventaEstaCerrada(estado: EstadoDeComprobante): boolean {
  return estado === 'enviado' || estado === 'aceptado' || estado === 'anulado'
}

/**
 * Traduce la clase de fallo al estado en que queda el comprobante. Es la decisión
 * de la que depende todo lo demás, y por eso vive aquí y no en el sitio donde se
 * atrapa el fallo.
 */
export function estadoSegunFallo(clase: ClaseDeFallo): EstadoDeComprobante {
  switch (clase) {
    // Sabemos con certeza que no se emitió: la venta puede esperar y completarse
    // luego. El correlativo ya está consumido y se reutilizará en el reintento.
    case 'indisponible':
      return 'pendiente'

    // Sabemos con certeza que se rechazó. El correlativo queda consumido y
    // registrado como tal (FR-030): un hueco en la numeración es explicable, un
    // número reutilizado no.
    case 'rechazo_definitivo':
      return 'rechazado'

    // No sabemos nada. Aquí muere el reintento.
    case 'indeterminado':
      return 'indeterminado'
  }
}

export class TransicionInvalida extends Error {
  readonly desde: EstadoDeComprobante
  readonly hacia: EstadoDeComprobante

  constructor(desde: EstadoDeComprobante, hacia: EstadoDeComprobante) {
    super(`Transición prohibida: ${desde} → ${hacia}`)
    this.name = 'TransicionInvalida'
    this.desde = desde
    this.hacia = hacia
  }
}

/**
 * Comprueba una transición antes de escribirla. Lanza en lugar de devolver un
 * booleano porque una transición prohibida es un error de programación, no una
 * situación del negocio: nadie debe poder continuar tras ignorarla.
 */
export function exigirTransicion(
  desde: EstadoDeComprobante,
  hacia: EstadoDeComprobante,
): void {
  if (desde === hacia) return
  if (!transicionPermitida(desde, hacia)) {
    throw new TransicionInvalida(desde, hacia)
  }
}
