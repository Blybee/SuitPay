import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Producto } from '../../domain/esquemas/comunes.ts'
import type {
  CoincidenciaDeCompra,
  LineaSinMatchDeCompra,
} from '../../domain/compras/tipos.ts'
import { MAX_MEDIOS_COMPRAS } from '../../domain/compras/tipos.ts'
import {
  centimosDeDecimales,
  centimosDesdeTextoDecimal,
  normalizarDecimal,
  textoDeTipoCambio,
} from '../../domain/compras/moneda.ts'
import {
  formatearImporte,
  solesDesdeCentimos,
} from '../../domain/totales/calculo.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'
import { vaciarCacheInventario } from '../inventario/consultar.ts'
import { Boton, Campo } from '../../ui/componentes/primitivas.tsx'
import {
  clasificarArchivo,
  ZonaDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'
import type {
  ArchivoElegido,
  EstadoDeCarga,
} from '../../ui/componentes/ZonaDeCarga.tsx'
import { Nota } from '../../ui/componentes/Nota.tsx'
import {
  aplicarPreciosCompraFn,
  extraerPreciosCompraFn,
  leerTiposDeCambioFn,
} from './compras.funciones.ts'
import { archivoABase64, mimeDeArchivo } from './archivo.ts'

const ACCEPT_COMPRAS =
  'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

function fichaDe(archivo: File): ArchivoElegido {
  const clase = clasificarArchivo(archivo)
  return {
    nombre: archivo.name,
    bytes: archivo.size,
    clase: clase === 'imagen' ? 'imagen' : 'pdf',
  }
}

function mensajeDeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'mensaje' in error) {
    const texto = (error as { mensaje?: string }).mensaje
    if (typeof texto === 'string' && texto.length > 0) return texto
  }
  return 'No se pudo leer la factura.'
}

function claveDeGrupo(grupo: number | undefined): string {
  return String(grupo ?? 0)
}

function centimosDeFila(
  fila: CoincidenciaDeCompra | LineaSinMatchDeCompra,
  textoTc: Readonly<Record<string, string>>,
): number | undefined {
  if (fila.moneda === 'USD') {
    if (fila.precioOriginal === undefined) return undefined
    const factor = normalizarDecimal(textoTc[claveDeGrupo(fila.grupo)] ?? '')
    if (factor === undefined) return undefined
    return centimosDeDecimales(fila.precioOriginal, factor)
  }
  return fila.precioCompraCentimos
}

function conDecimales(texto: string, escala: number): string {
  const decimal = normalizarDecimal(texto)
  if (decimal === undefined) return texto
  const [entero, fraccion = ''] = decimal.split('.')
  if (fraccion.length >= escala) return decimal
  return `${entero ?? '0'}.${fraccion.padEnd(escala, '0')}`
}

function etiquetaDeOrden(archivos: readonly File[], grupo: number): string {
  const nombre = archivos[grupo]?.name ?? ''
  const numeros = nombre.match(/\d+/g)
  const ultimo = numeros?.at(-1)
  return ultimo !== undefined ? `OC ${ultimo}` : `OC ${grupo + 1}`
}

interface GrupoVisible {
  id: number
  etiqueta: string
  fecha?: string
  enDolares: boolean
  filas: { fila: CoincidenciaDeCompra; indice: number }[]
  huerfanas: { linea: LineaSinMatchDeCompra; indice: number }[]
}

export function PanelCompras({
  puedeEscribir,
  deshabilitado,
  productos,
}: {
  readonly puedeEscribir: boolean
  readonly deshabilitado: boolean
  readonly productos: readonly Producto[]
}) {
  const [brutos, setBrutos] = useState<File[]>([])
  const [estado, setEstado] = useState<EstadoDeCarga>('vacio')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [coincidencias, setCoincidencias] = useState<CoincidenciaDeCompra[]>([])
  const [sinMatch, setSinMatch] = useState<readonly LineaSinMatchDeCompra[]>([])
  const [aplicando, setAplicando] = useState(false)
  const [textoTc, setTextoTc] = useState<Record<string, string>>({})
  const [avisoTc, setAvisoTc] = useState<string | null>(null)
  const tcEditado = useRef(new Set<string>())
  const consultaTc = useRef(0)

  const archivos = brutos.map(fichaDe)

  const descripcionPorCodigo = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const producto of productos) {
      mapa.set(producto.codigo, producto.descripcion)
    }
    return mapa
  }, [productos])

  const pedidosTc = useMemo(() => {
    const porGrupo = new Map<string, string>()
    for (const fila of [...coincidencias, ...sinMatch]) {
      if (fila.moneda !== 'USD' || !fila.precioCompraEn) continue
      const clave = claveDeGrupo(fila.grupo)
      if (!porGrupo.has(clave)) porGrupo.set(clave, fila.precioCompraEn)
    }
    return [...porGrupo.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([grupo, fecha]) => `${grupo}@${fecha}`)
      .join('|')
  }, [coincidencias, sinMatch])

  const faltaTipoCambio = coincidencias.some(
    (fila) =>
      fila.moneda === 'USD' && centimosDeFila(fila, textoTc) === undefined,
  )

  useEffect(() => {
    if (pedidosTc.length === 0) return
    const pedidos = pedidosTc.split('|').map((pedido) => {
      const [grupo, fecha] = pedido.split('@')
      return { grupo: grupo ?? '', fecha: fecha ?? '' }
    })
    const fechas = [...new Set(pedidos.map((pedido) => pedido.fecha))]
    const ticket = ++consultaTc.current
    void (async () => {
      try {
        const respuesta = await leerTiposDeCambioFn({ data: { fechas } })
        if (ticket !== consultaTc.current) return
        if (!respuesta.ok || respuesta.tipos === undefined) {
          setAvisoTc(
            'No se pudo consultar SUNAT. Escribe el tipo de cambio venta de la fecha de la orden.',
          )
          return
        }
        const tipos = respuesta.tipos
        setTextoTc((actual) => {
          const siguiente = { ...actual }
          for (const pedido of pedidos) {
            if (tcEditado.current.has(pedido.grupo)) continue
            const tipo = tipos.find((item) => item.fecha === pedido.fecha)
            if (tipo === undefined) continue
            const texto = textoDeTipoCambio(tipo.venta)
            if (texto !== undefined) siguiente[pedido.grupo] = texto
          }
          return siguiente
        })
        if (respuesta.fallos !== undefined && respuesta.fallos.length > 0) {
          setAvisoTc(
            'SUNAT no publicó el tipo de cambio de alguna fecha. Escríbelo para confirmar.',
          )
        }
      } catch {
        if (ticket !== consultaTc.current) return
        setAvisoTc(
          'No se pudo consultar SUNAT. Escribe el tipo de cambio venta de la fecha de la orden.',
        )
      }
    })()
  }, [pedidosTc])

  function fallar(texto: string): void {
    setEstado('error')
    setMensaje(texto)
    usarNotificaciones.getState().mostrar({ tono: 'error', mensaje: texto })
  }

  function limpiarBoceto(): void {
    setCoincidencias([])
    setSinMatch([])
    setTextoTc({})
    setAvisoTc(null)
    tcEditado.current.clear()
  }

  function quitar(indice: number): void {
    if (ocupado || aplicando) return
    const restantes = brutos.filter((_, i) => i !== indice)
    setBrutos(restantes)
    limpiarBoceto()
    if (restantes.length === 0) {
      setEstado('vacio')
      setMensaje(null)
      return
    }
    void extraer(restantes)
  }

  async function extraer(lista: readonly File[]): Promise<void> {
    setEstado('procesando')
    setMensaje(null)
    setOcupado(true)
    try {
      const medios = []
      for (const archivo of lista) {
        const mime = mimeDeArchivo(archivo)
        if (mime === null) {
          fallar('Solo se aceptan PDF o imágenes (JPEG, PNG, WebP).')
          return
        }
        medios.push({
          mimeType: mime,
          dataBase64: await archivoABase64(archivo),
        })
      }
      const respuesta = await extraerPreciosCompraFn({ data: { medios } })
      if (!respuesta.ok || respuesta.boceto === undefined) {
        fallar(respuesta.error?.mensaje ?? 'No se pudo interpretar la factura.')
        return
      }
      tcEditado.current.clear()
      setTextoTc({})
      setAvisoTc(null)
      setCoincidencias([...respuesta.boceto.coincidencias])
      setSinMatch(respuesta.boceto.sinMatch)
      setEstado('listo')
      usarNotificaciones.getState().mostrar({
        tono: 'info',
        mensaje: `${respuesta.boceto.coincidencias.length} productos reconocidos. Revisa y confirma.`,
      })
    } catch (error) {
      fallar(mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  function cargar(elegidos: readonly File[]): void {
    if (!puedeEscribir || ocupado || aplicando) return
    for (const elegido of elegidos) {
      const clase = clasificarArchivo(elegido)
      if (clase !== 'pdf' && clase !== 'imagen') {
        fallar('Solo se aceptan PDF o imágenes (JPEG, PNG, WebP).')
        return
      }
    }
    const juntos = [...brutos, ...elegidos]
    setBrutos(juntos)
    limpiarBoceto()
    void extraer(juntos)
  }

  async function confirmar(): Promise<void> {
    if (!puedeEscribir || coincidencias.length === 0 || faltaTipoCambio) return
    const listas = coincidencias.map((fila) => {
      if (fila.moneda !== 'USD' || fila.precioOriginal === undefined)
        return fila
      const factor = normalizarDecimal(textoTc[claveDeGrupo(fila.grupo)] ?? '')
      if (factor === undefined) return fila
      const centimos = centimosDeDecimales(fila.precioOriginal, factor)
      return {
        ...fila,
        tipoCambio: Number(factor),
        tipoCambioEn: fila.precioCompraEn,
        ...(centimos !== undefined ? { precioCompraCentimos: centimos } : {}),
      }
    })
    setAplicando(true)
    try {
      const respuesta = await aplicarPreciosCompraFn({
        data: { coincidencias: listas },
      })
      if (!respuesta.ok) {
        fallar(respuesta.error?.mensaje ?? 'No se pudo guardar el costo.')
        return
      }
      vaciarCacheInventario()
      setBrutos([])
      limpiarBoceto()
      setEstado('vacio')
      usarNotificaciones.getState().mostrar({
        tono: 'exito',
        mensaje: 'Precios de compra actualizados.',
      })
    } finally {
      setAplicando(false)
    }
  }

  function descartar(): void {
    if (ocupado || aplicando) return
    setBrutos([])
    limpiarBoceto()
    setEstado('vacio')
    setMensaje(null)
  }

  function parcheCoincidencia(
    indice: number,
    cambio: Partial<CoincidenciaDeCompra>,
  ): void {
    setCoincidencias((actual) =>
      actual.map((fila, i) => (i === indice ? { ...fila, ...cambio } : fila)),
    )
  }

  function cambiarTipoCambio(grupo: number, valor: string): void {
    const clave = claveDeGrupo(grupo)
    tcEditado.current.add(clave)
    setTextoTc((actual) => ({ ...actual, [clave]: valor }))
  }

  function cambiarFecha(grupo: number, fecha: string | undefined): void {
    const clave = claveDeGrupo(grupo)
    tcEditado.current.delete(clave)
    setTextoTc((actual) => {
      if (!(clave in actual)) return actual
      const siguiente = { ...actual }
      delete siguiente[clave]
      return siguiente
    })
    setCoincidencias((actual) =>
      actual.map((fila) =>
        (fila.grupo ?? 0) === grupo ? { ...fila, precioCompraEn: fecha } : fila,
      ),
    )
    setSinMatch((actual) =>
      actual.map((fila) =>
        (fila.grupo ?? 0) === grupo ? { ...fila, precioCompraEn: fecha } : fila,
      ),
    )
  }

  const grupos = useMemo(() => {
    const mapa = new Map<number, GrupoVisible>()
    function asegurar(id: number): GrupoVisible {
      const previo = mapa.get(id)
      if (previo !== undefined) return previo
      const creado: GrupoVisible = {
        id,
        etiqueta: etiquetaDeOrden(brutos, id),
        enDolares: false,
        filas: [],
        huerfanas: [],
      }
      mapa.set(id, creado)
      return creado
    }
    coincidencias.forEach((fila, indice) => {
      const grupo = asegurar(fila.grupo ?? 0)
      grupo.filas.push({ fila, indice })
      if (fila.moneda === 'USD') grupo.enDolares = true
      if (grupo.fecha === undefined && fila.precioCompraEn !== undefined) {
        grupo.fecha = fila.precioCompraEn
      }
    })
    sinMatch.forEach((linea, indice) => {
      const grupo = asegurar(linea.grupo ?? 0)
      grupo.huerfanas.push({ linea, indice })
      if (linea.moneda === 'USD') grupo.enDolares = true
      if (grupo.fecha === undefined && linea.precioCompraEn !== undefined) {
        grupo.fecha = linea.precioCompraEn
      }
    })
    return [...mapa.values()].sort((a, b) => a.id - b.id)
  }, [brutos, coincidencias, sinMatch])

  return (
    <section className="rounded-3xl border border-borde bg-papel p-6 shadow-sm">
      <ZonaDeCarga
        multiple
        maxArchivos={MAX_MEDIOS_COMPRAS}
        titulo="Compras"
        etiqueta="Facturas PDF o imagen"
        nota={
          <Nota linea="El archivo no se guarda. El modelo propone costos; tú confirmas." />
        }
        accept={ACCEPT_COMPRAS}
        aceptados={['pdf', 'imagen']}
        archivos={archivos}
        estado={estado}
        mensaje={mensaje}
        ocultarEstadoSinError
        deshabilitado={deshabilitado || ocupado || aplicando || !puedeEscribir}
        onArchivos={(lista) => {
          cargar(lista)
        }}
        onQuitar={quitar}
      />

      {coincidencias.length > 0 || sinMatch.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-cuerpo font-medium text-tinta">
            Boceto de precios de compra
          </h3>
          <div className="mt-2 max-h-[min(32rem,60dvh)] overflow-auto">
            <table className="w-full min-w-[40rem] border-separate border-spacing-0">
              <caption className="sr-only">
                Precios de compra propuestos, agrupados por orden
              </caption>
              <colgroup>
                <col />
                <col className="w-36" />
                <col className="w-6" />
                <col className="w-20" />
                <col className="w-6" />
                <col className="w-28" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-papel">
                <tr>
                  <th scope="col" className="py-2 text-left">
                    <span className="sr-only">Producto</span>
                  </th>
                  <th
                    scope="col"
                    className="px-1 py-2 text-right text-cuerpo font-normal text-desvaida"
                  >
                    Precio US$
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-center font-normal text-desvaida"
                  >
                    <span aria-hidden>×</span>
                    <span className="sr-only">por</span>
                  </th>
                  <th
                    scope="col"
                    className="px-1 py-2 text-right text-cuerpo font-normal text-desvaida"
                  >
                    TC
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-center font-normal text-desvaida"
                  >
                    <span aria-hidden>=</span>
                    <span className="sr-only">igual a</span>
                  </th>
                  <th
                    scope="col"
                    className="px-1 py-2 text-right text-cuerpo font-normal text-desvaida"
                  >
                    S/
                  </th>
                </tr>
              </thead>
              {grupos.map((grupo) => (
                <tbody key={grupo.id}>
                  <GrupoDeOrden
                    grupo={grupo}
                    textoTc={textoTc[claveDeGrupo(grupo.id)] ?? ''}
                    aplicando={aplicando}
                    descripcionPorCodigo={descripcionPorCodigo}
                    onFecha={(fecha) => cambiarFecha(grupo.id, fecha)}
                    onTipoCambio={(valor) => cambiarTipoCambio(grupo.id, valor)}
                    onPrecio={(indice, precioOriginal) => {
                      parcheCoincidencia(indice, { precioOriginal })
                    }}
                    onCentimos={(indice, centimos) => {
                      parcheCoincidencia(indice, {
                        precioCompraCentimos: centimos,
                        moneda: 'PEN',
                      })
                    }}
                  />
                </tbody>
              ))}
            </table>
          </div>
          {avisoTc !== null ? (
            <p className="mt-2 text-cuerpo text-aviso">{avisoTc}</p>
          ) : null}
          {faltaTipoCambio ? (
            <p className="mt-2 text-cuerpo text-aviso">
              Escribe el tipo de cambio venta para confirmar una compra en
              dólares.
            </p>
          ) : null}
          {coincidencias.length > 0 ? (
            <div className="sticky bottom-0 z-20 -mx-6 mt-3 flex justify-end gap-2 border-t border-borde bg-papel px-6 py-3">
              <Boton
                variante="secundario"
                disabled={ocupado || aplicando}
                onClick={descartar}
              >
                Descartar
              </Boton>
              <Boton
                variante="principal"
                disabled={
                  aplicando || coincidencias.length === 0 || faltaTipoCambio
                }
                aria-busy={aplicando || undefined}
                onClick={() => void confirmar()}
              >
                {aplicando ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : null}
                {aplicando
                  ? 'Guardando…'
                  : `Guardar ${coincidencias.length} ${
                      coincidencias.length === 1 ? 'precio' : 'precios'
                    }`}
              </Boton>
            </div>
          ) : null}
        </div>
      ) : ocupado ? (
        <p className="mt-4 flex items-center gap-2 text-cuerpo text-desvaida">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Leyendo facturas…
        </p>
      ) : null}
    </section>
  )
}

function GrupoDeOrden({
  grupo,
  textoTc,
  aplicando,
  descripcionPorCodigo,
  onFecha,
  onTipoCambio,
  onPrecio,
  onCentimos,
}: {
  readonly grupo: GrupoVisible
  readonly textoTc: string
  readonly aplicando: boolean
  readonly descripcionPorCodigo: ReadonlyMap<string, string>
  readonly onFecha: (fecha: string | undefined) => void
  readonly onTipoCambio: (valor: string) => void
  readonly onPrecio: (indice: number, precio: string) => void
  readonly onCentimos: (indice: number, centimos: number) => void
}) {
  const factorVisible =
    normalizarDecimal(textoTc) !== undefined
      ? conDecimales(textoTc, 3)
      : textoTc
  return (
    <>
      <tr>
        <th
          scope="rowgroup"
          colSpan={6}
          className="border-t border-borde py-2 text-left font-normal"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-medium text-tinta">{grupo.etiqueta}</span>
            <span className="text-desvaida" aria-hidden>
              ·
            </span>
            <span className="flex items-center gap-2 text-cuerpo text-desvaida">
              Fecha
              <Campo
                id={`fecha-${grupo.id}`}
                variante="en-linea"
                superficie="mesa"
                type="date"
                className="w-40 max-w-40"
                aria-label={`Fecha de ${grupo.etiqueta}`}
                value={grupo.fecha ?? ''}
                disabled={aplicando}
                onChange={(e) => {
                  const valor = e.target.value
                  onFecha(valor === '' ? undefined : valor)
                }}
              />
            </span>
            {grupo.enDolares ? (
              <>
                <span className="text-desvaida" aria-hidden>
                  ·
                </span>
                <span className="flex items-center gap-2 text-cuerpo text-desvaida">
                  TC SUNAT
                  <Campo
                    id={`tc-${grupo.id}`}
                    variante="en-linea"
                    superficie="mesa"
                    numerico
                    inputMode="decimal"
                    className="w-24 max-w-24 !text-desvaida"
                    aria-label={`Tipo de cambio SUNAT de ${grupo.etiqueta}`}
                    value={textoTc}
                    disabled={aplicando}
                    onChange={(e) => onTipoCambio(e.target.value)}
                    onBlur={(e) => {
                      const texto = conDecimales(e.target.value, 3)
                      if (normalizarDecimal(texto) === undefined) return
                      onTipoCambio(texto)
                    }}
                  />
                </span>
              </>
            ) : null}
          </div>
        </th>
      </tr>
      {grupo.filas.map(({ fila, indice }) => (
        <FilaDePrecio
          key={`${grupo.id}-${indice}`}
          nombre={fila.codigo}
          descripcion={
            descripcionPorCodigo.get(fila.codigo) ?? fila.etiquetaFactura
          }
          codigo={fila.codigo}
          moneda={fila.moneda}
          precioOriginal={fila.precioOriginal}
          centimos={fila.precioCompraCentimos}
          textoTc={factorVisible}
          soles={
            fila.moneda === 'USD'
              ? textoSoles(
                  centimosDeFila(fila, { [claveDeGrupo(grupo.id)]: textoTc }),
                )
              : undefined
          }
          aplicando={aplicando}
          onPrecio={(precio) => onPrecio(indice, precio)}
          onCentimos={(centimos) => onCentimos(indice, centimos)}
        />
      ))}
      {grupo.huerfanas.map(({ linea, indice }) => (
        <FilaDePrecio
          key={`${grupo.id}-sin-${indice}`}
          nombre={linea.etiquetaFactura}
          descripcion={linea.etiquetaFactura}
          nota="No está en el catálogo"
          moneda={linea.moneda}
          precioOriginal={linea.precioOriginal}
          centimos={linea.precioCompraCentimos}
          textoTc={factorVisible}
          soles={
            linea.moneda === 'USD'
              ? textoSoles(
                  centimosDeFila(linea, { [claveDeGrupo(grupo.id)]: textoTc }),
                )
              : undefined
          }
          aplicando={aplicando}
          precioBloqueado
          onPrecio={() => undefined}
          onCentimos={() => undefined}
        />
      ))}
    </>
  )
}

function textoSoles(centimos: number | undefined): string {
  return centimos !== undefined ? formatearImporte(centimos) : '—'
}

function FilaDePrecio({
  nombre,
  descripcion,
  codigo,
  nota,
  moneda,
  precioOriginal,
  centimos,
  textoTc,
  soles,
  aplicando,
  precioBloqueado = false,
  onPrecio,
  onCentimos,
}: {
  readonly nombre: string
  readonly descripcion: string
  readonly codigo?: string
  readonly nota?: string
  readonly moneda?: 'PEN' | 'USD'
  readonly precioOriginal?: string
  readonly centimos?: number
  readonly textoTc: string
  readonly soles?: string
  readonly aplicando: boolean
  readonly precioBloqueado?: boolean
  readonly onPrecio: (precio: string) => void
  readonly onCentimos: (centimos: number) => void
}) {
  const enDolares = moneda === 'USD'
  const precioVisible =
    precioOriginal !== undefined ? conDecimales(precioOriginal, 4) : ''
  return (
    <tr className="border-b border-borde">
      <th scope="row" className="py-1 pr-3 text-left font-normal">
        <p className="truncate font-medium text-cuerpo text-tinta">
          {descripcion}
        </p>
        {codigo !== undefined ? (
          <p className="font-mono text-[length:var(--text-etiqueta)] leading-4 tracking-normal text-desvaida">
            {codigo}
          </p>
        ) : null}
        {nota !== undefined ? (
          <p className="text-[length:var(--text-etiqueta)] leading-4 text-desvaida">
            {nota}
          </p>
        ) : null}
      </th>
      <td className="px-1 py-1">
        {enDolares ? (
          <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[length:var(--text-etiqueta)] text-desvaida">
              US$
            </span>
            <Campo
              variante="en-linea"
              superficie="mesa"
              numerico
              inputMode="decimal"
              className="pl-9 !text-desvaida"
              aria-label={`Precio en dólares de ${nombre}`}
              defaultValue={precioVisible}
              disabled={aplicando || precioBloqueado}
              onChange={(e) => {
                const decimal = normalizarDecimal(e.target.value)
                if (decimal === undefined) return
                onPrecio(decimal)
              }}
              onBlur={(e) => {
                const decimal = normalizarDecimal(e.target.value)
                if (decimal === undefined) {
                  e.target.value = precioVisible
                  return
                }
                const texto = conDecimales(decimal, 4)
                e.target.value = texto
                onPrecio(texto)
              }}
            />
          </span>
        ) : null}
      </td>
      <td className="text-center text-desvaida" aria-hidden>
        {enDolares ? '×' : null}
      </td>
      <td className="px-1 text-right font-mono text-cuerpo tabular-nums text-desvaida">
        {enDolares ? textoTc : null}
      </td>
      <td className="text-center text-desvaida" aria-hidden>
        {enDolares ? '=' : null}
      </td>
      <td className="px-1 py-1 text-right">
        {enDolares ? (
          <span className="font-mono text-renglon font-bold text-tinta tabular-nums">
            <span className="sr-only">
              {`US$ ${precioVisible || '—'} × ${textoTc || '—'} = S/ ${soles ?? '—'}`}
            </span>
            <span aria-hidden>{soles ?? '—'}</span>
          </span>
        ) : (
          <Campo
            variante="en-linea"
            superficie="mesa"
            numerico
            inputMode="decimal"
            aria-label={`Costo en soles de ${nombre}`}
            defaultValue={
              centimos !== undefined
                ? solesDesdeCentimos(centimos).toFixed(2)
                : ''
            }
            disabled={aplicando || precioBloqueado}
            onChange={(e) => {
              const n = centimosDesdeTextoDecimal(e.target.value)
              if (n === undefined) return
              onCentimos(n)
            }}
            onBlur={(e) => {
              const n = centimosDesdeTextoDecimal(e.target.value)
              if (n === undefined) {
                e.target.value =
                  centimos !== undefined
                    ? solesDesdeCentimos(centimos).toFixed(2)
                    : ''
                return
              }
              e.target.value = solesDesdeCentimos(n).toFixed(2)
              onCentimos(n)
            }}
          />
        )}
      </td>
    </tr>
  )
}
