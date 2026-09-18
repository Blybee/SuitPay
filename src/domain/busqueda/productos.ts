import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

/**
 * Coincidencia aproximada sobre el catálogo.
 *
 * ## El problema que resuelve
 *
 * El sistema actual de la empresa no encuentra un producto si los términos no se
 * teclean en el orden exacto en que están guardados. Es una de las quejas
 * concretas que originaron este proyecto. Aquí "codo fg 1/2", "1/2 fg codo" y
 * "codo fg media" tienen que llegar al mismo sitio.
 *
 * ## Por qué no basta con Fuse a secas
 *
 * Fuse compara la consulta contra el texto como un patrón, no como un conjunto
 * de palabras: con `ignoreLocation` deja de importar *dónde* aparece la
 * coincidencia, pero el orden de los caracteres de la consulta sigue contando.
 * "1/2 fg codo" contra "CODO FG 1/2" puntúa mal, y eso es exactamente el defecto
 * que veníamos a corregir.
 *
 * De modo que la consulta se parte en términos y cada uno se busca por separado;
 * un producto coincide cuando **todos** los términos lo encuentran. El orden
 * deja de existir como concepto y cada término conserva su tolerancia a erratas.
 *
 * La conjunción es deliberadamente estricta: en un mostrador es mejor decir "no
 * encontré nada" que ofrecer algo que solo cumple la mitad de lo pedido.
 *
 * ## La distinción que FR-008 exige
 *
 * No basta con devolver resultados ordenados por parecido. Hay que **distinguir
 * la ausencia de coincidencias de una coincidencia aproximada**, y decirlo. Un
 * buscador que ante "codo fg 3/4" devuelve calladamente el codo de 1/2 porque
 * era lo más parecido es peor que uno que no devuelve nada: el vendedor teclea
 * rápido, ve una fila, la acepta y factura la pieza equivocada.
 */

export interface ProductoBuscable {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
  readonly precio: number
  readonly activo: boolean
  readonly marca?: string
  readonly categoriaId?: string
}

export type GradoDeCoincidencia = 'exacta' | 'fuerte' | 'aproximada'

export interface Coincidencia<T> {
  readonly elemento: T
  /** 0 es coincidencia perfecta y 1 es ninguna, como en Fuse. */
  readonly distancia: number
  readonly grado: GradoDeCoincidencia
}

export interface ResultadoDeBusqueda<T> {
  readonly coincidencias: readonly Coincidencia<T>[]
  /**
   * Verdadero cuando no hay ninguna coincidencia utilizable. La interfaz debe
   * decirlo con palabras y no mostrar una lista vacía sin explicación.
   */
  readonly sinCoincidencias: boolean
  /**
   * Verdadero cuando ninguna coincidencia es exacta ni fuerte. La interfaz debe
   * advertirlo: lo que hay se parece, pero no es seguro que sea lo buscado.
   */
  readonly soloAproximadas: boolean
  readonly termino: string
}

/**
 * Umbral por encima del cual una coincidencia se considera demasiado floja para
 * ofrecerla. Fuse puntúa hasta 1,0 y un catálogo de 500 productos casi siempre
 * tiene algo que se parezca remotamente a cualquier cosa.
 */
const DISTANCIA_MAXIMA_UTILIZABLE = 0.5
const DISTANCIA_EXACTA = 0.02
const DISTANCIA_FUERTE = 0.28

/** Dos caracteres bastan para que "fg" cuente; uno solo no entra en Fuse. */
export const LONGITUD_MINIMA_TERMINO = 2

const DISTANCIA_MARCA_APROXIMADA = 0.4
const LONGITUD_MINIMA_ERRATA_MARCA = 4
const DIFERENCIA_MAXIMA_LONGITUD_MARCA = 2

const OPCIONES: IFuseOptions<ProductoBuscable> = {
  keys: [
    {
      name: 'descripcion',
      weight: 0.85,
      getFn: (producto) => normalizar(producto.descripcion),
    },
    {
      name: 'marca',
      weight: 0.5,
      getFn: (producto) => normalizar(producto.marca ?? ''),
    },
    {
      name: 'codigo',
      weight: 0.15,
      getFn: (producto) => normalizar(producto.codigo),
    },
  ],
  includeScore: true,
  // El término puede aparecer en cualquier posición de la descripción.
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: DISTANCIA_MAXIMA_UTILIZABLE,
  minMatchCharLength: LONGITUD_MINIMA_TERMINO,
}

/** Vocabulario corto: transposiciones tipo "vlamax" contra "VALMAX", no contra la descripción. */
const OPCIONES_MARCA: IFuseOptions<string> = {
  includeScore: true,
  ignoreLocation: true,
  ignoreDiacritics: true,
  threshold: DISTANCIA_MARCA_APROXIMADA,
  minMatchCharLength: LONGITUD_MINIMA_TERMINO,
}

/**
 * Normaliza para comparar: sin tildes, en mayúsculas y sin espacios de sobra.
 * Los nombres del catálogo están bien definidos, pero se teclean con prisa y de
 * pie, y nadie va a escribir "válvula" con tilde en el mostrador.
 *
 * El guion (y puntuación parecida) se vuelve espacio para que "AQUATO-JUEGO" y
 * "AQUATO JUEGO" sean el mismo haystack. No se toca `/`: es parte de las
 * medidas 1/2 y 3/4, y FR-008 depende de que sigan siendo un solo término.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[-_.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Términos que Fuse puede puntuar. Los de un carácter no entran en la conjunción. */
export function terminosDeConsulta(terminoLimpio: string): readonly string[] {
  return terminoLimpio
    .split(' ')
    .filter((cada) => cada.length >= LONGITUD_MINIMA_TERMINO)
}

export interface IndiceDeProductos {
  readonly fuse: Fuse<ProductoBuscable>
  readonly fuseMarcas: Fuse<string>
  readonly porDescripcionNormalizada: ReadonlyMap<string, ProductoBuscable>
  readonly porMarca: ReadonlyMap<string, readonly ProductoBuscable[]>
}

export function crearIndice(
  productos: readonly ProductoBuscable[],
): IndiceDeProductos {
  const activos = productos.filter((producto) => producto.activo)
  const porDescripcionNormalizada = new Map<string, ProductoBuscable>()
  const porMarca = new Map<string, ProductoBuscable[]>()
  for (const producto of activos) {
    porDescripcionNormalizada.set(normalizar(producto.descripcion), producto)
    const marca = normalizar(producto.marca ?? '')
    if (marca.length === 0) continue
    const deLaMarca = porMarca.get(marca)
    if (deLaMarca === undefined) porMarca.set(marca, [producto])
    else deLaMarca.push(producto)
  }
  return {
    fuse: new Fuse(activos, OPCIONES),
    fuseMarcas: new Fuse([...porMarca.keys()], OPCIONES_MARCA),
    porDescripcionNormalizada,
    porMarca,
  }
}

function gradoDe(distancia: number): GradoDeCoincidencia {
  if (distancia <= DISTANCIA_EXACTA) return 'exacta'
  if (distancia <= DISTANCIA_FUERTE) return 'fuerte'
  return 'aproximada'
}

type Hallazgo = { producto: ProductoBuscable; distancia: number }

function registrarHallazgo(
  encontrados: Map<string, Hallazgo>,
  producto: ProductoBuscable,
  distancia: number,
): void {
  const yaEstaba = encontrados.get(producto.codigo)
  if (yaEstaba === undefined || distancia < yaEstaba.distancia) {
    encontrados.set(producto.codigo, { producto, distancia })
  }
}

function expandirMarca(
  indice: IndiceDeProductos,
  termino: string,
  encontrados: Map<string, Hallazgo>,
): void {
  const exactos = indice.porMarca.get(termino)
  if (exactos !== undefined) {
    for (const producto of exactos) registrarHallazgo(encontrados, producto, 0)
  }

  if (termino.length < LONGITUD_MINIMA_ERRATA_MARCA) return

  for (const resultado of indice.fuseMarcas.search(termino)) {
    const marca = resultado.item
    const distancia = resultado.score ?? 1
    if (distancia > DISTANCIA_MARCA_APROXIMADA) continue
    if (
      Math.abs(termino.length - marca.length) > DIFERENCIA_MAXIMA_LONGITUD_MARCA
    ) {
      continue
    }
    const deLaMarca = indice.porMarca.get(marca)
    if (deLaMarca === undefined) continue
    for (const producto of deLaMarca) {
      registrarHallazgo(encontrados, producto, distancia)
    }
  }
}

/** Distancia de cada producto para un único término, por código. */
function distanciasPorTermino(
  indice: IndiceDeProductos,
  termino: string,
): Map<string, Hallazgo> {
  const encontrados = new Map<string, Hallazgo>()
  for (const resultado of indice.fuse.search(termino)) {
    const distancia = resultado.score ?? 1
    if (distancia > DISTANCIA_MAXIMA_UTILIZABLE) continue
    registrarHallazgo(encontrados, resultado.item, distancia)
  }
  expandirMarca(indice, termino, encontrados)
  return encontrados
}

export function buscarProductos(
  indice: IndiceDeProductos,
  termino: string,
  limite?: number,
): ResultadoDeBusqueda<ProductoBuscable> {
  const terminoLimpio = normalizar(termino)

  if (terminoLimpio.length === 0) {
    return {
      coincidencias: [],
      sinCoincidencias: true,
      soloAproximadas: false,
      termino: terminoLimpio,
    }
  }

  // Si la consulta reproduce una descripción entera, no hay nada que estimar.
  const exacto = indice.porDescripcionNormalizada.get(terminoLimpio)
  if (exacto !== undefined) {
    return {
      coincidencias: [{ elemento: exacto, distancia: 0, grado: 'exacta' }],
      sinCoincidencias: false,
      soloAproximadas: false,
      termino: terminoLimpio,
    }
  }

  const terminos = terminosDeConsulta(terminoLimpio)

  // "Aquato- j" deja solo AQUATO: el token de un carácter no puede exigir AND
  // porque Fuse no lo indexa (minMatchCharLength). Sin términos útiles no hay
  // búsqueda, no una lista vacía disfrazada de "no encontré nada".
  if (terminos.length === 0) {
    return {
      coincidencias: [],
      sinCoincidencias: true,
      soloAproximadas: false,
      termino: terminoLimpio,
    }
  }

  // Un producto coincide cuando lo encuentran todos los términos. Se arranca de
  // las coincidencias del primero y se van descartando las que fallen el resto,
  // que además es lo más rápido: el primer término suele ser el más selectivo.
  let candidatos = distanciasPorTermino(indice, terminos[0] ?? terminoLimpio)
  const distanciasAcumuladas = new Map<string, number[]>()
  for (const [codigo, encontrado] of candidatos) {
    distanciasAcumuladas.set(codigo, [encontrado.distancia])
  }

  for (const cadaTermino of terminos.slice(1)) {
    const delTermino = distanciasPorTermino(indice, cadaTermino)
    const sobreviven = new Map<
      string,
      { producto: ProductoBuscable; distancia: number }
    >()
    for (const [codigo, encontrado] of candidatos) {
      const enEste = delTermino.get(codigo)
      if (enEste === undefined) continue
      sobreviven.set(codigo, encontrado)
      distanciasAcumuladas.get(codigo)?.push(enEste.distancia)
    }
    candidatos = sobreviven
    if (candidatos.size === 0) break
  }

  const ordenadas = [...candidatos.values()]
    .map((encontrado) => {
      const distancias = distanciasAcumuladas.get(encontrado.producto.codigo) ?? [
        encontrado.distancia,
      ]
      const media =
        distancias.reduce((suma, cada) => suma + cada, 0) / distancias.length
      return {
        elemento: encontrado.producto,
        distancia: media,
        grado: gradoDe(media),
      }
    })
    .sort((uno, otro) => uno.distancia - otro.distancia)
  const coincidencias =
    limite === undefined ? ordenadas : ordenadas.slice(0, limite)

  return {
    coincidencias,
    sinCoincidencias: coincidencias.length === 0,
    soloAproximadas:
      coincidencias.length > 0 &&
      coincidencias.every((coincidencia) => coincidencia.grado === 'aproximada'),
    termino: terminoLimpio,
  }
}

/**
 * El lote de candidatos que se envía al servicio de asistencia al interpretar
 * una captura. Se filtra en el cliente a propósito: mandar los 500 productos por
 * cada renglón sería caro y lento, y el principio IV exige que lo que sale del
 * sistema sea lo mínimo necesario.
 */
export function loteDeCandidatos(
  indice: IndiceDeProductos,
  terminos: readonly string[],
  porTermino = 8,
): ProductoBuscable[] {
  const porCodigo = new Map<string, ProductoBuscable>()
  for (const termino of terminos) {
    for (const coincidencia of buscarProductos(indice, termino, porTermino)
      .coincidencias) {
      porCodigo.set(coincidencia.elemento.codigo, coincidencia.elemento)
    }
  }
  return [...porCodigo.values()]
}
