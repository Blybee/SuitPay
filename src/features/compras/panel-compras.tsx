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
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
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

function fechaLatam(iso: string | undefined): string {
  if (iso === undefined) return ''
  const [anio, mes, dia] = iso.split('-')
  if (anio === undefined || mes === undefined || dia === undefined) return iso
  return `${dia}/${mes}/${anio}`
}

function claveDeFecha(fecha: string | undefined): string {
  return fecha ?? ''
}

function centimosDeFila(
  fila: CoincidenciaDeCompra | LineaSinMatchDeCompra,
  textoTc: Readonly<Record<string, string>>,
): number | undefined {
  if (fila.moneda === 'USD') {
    if (fila.precioOriginal === undefined) return undefined
    const factor = normalizarDecimal(
      textoTc[claveDeFecha(fila.precioCompraEn)] ?? '',
    )
    if (factor === undefined) return undefined
    return centimosDeDecimales(fila.precioOriginal, factor)
  }
  return fila.precioCompraCentimos
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

  const fechasUsd = useMemo(() => {
    const fechas = new Set<string>()
    for (const fila of [...coincidencias, ...sinMatch]) {
      if (fila.moneda === 'USD' && fila.precioCompraEn) {
        fechas.add(fila.precioCompraEn)
      }
    }
    return [...fechas].sort().join('|')
  }, [coincidencias, sinMatch])

  const faltaTipoCambio = coincidencias.some(
    (fila) =>
      fila.moneda === 'USD' && centimosDeFila(fila, textoTc) === undefined,
  )

  useEffect(() => {
    if (fechasUsd.length === 0) return
    const fechas = fechasUsd.split('|')
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
          for (const tipo of tipos) {
            if (tcEditado.current.has(tipo.fecha)) continue
            const texto = textoDeTipoCambio(tipo.venta)
            if (texto !== undefined) siguiente[tipo.fecha] = texto
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
  }, [fechasUsd])

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
      const clave = claveDeFecha(fila.precioCompraEn)
      const factor = normalizarDecimal(textoTc[clave] ?? '')
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

  function cambiarTipoCambio(fecha: string, valor: string): void {
    tcEditado.current.add(fecha)
    setTextoTc((actual) => ({ ...actual, [fecha]: valor }))
  }

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
        <div className="mt-4 flex flex-col gap-3">
          {coincidencias.length > 0 ? (
            <>
              <p className="font-mono text-etiqueta uppercase text-desvaida">
                Boceto de precios de compra
              </p>
              <ul className="flex flex-col gap-2">
                {coincidencias.map((fila, indice) => (
                  <li
                    key={`${fila.codigo}-${indice}`}
                    className="flex flex-col gap-2 rounded-2xl border border-borde bg-mesa p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-[8rem_1fr_7rem_11rem]">
                      <p className="font-mono text-etiqueta uppercase text-desvaida">
                        {fila.codigo}
                      </p>
                      <p className="truncate text-cuerpo text-tinta">
                        {descripcionPorCodigo.get(fila.codigo) ??
                          fila.etiquetaFactura}
                      </p>
                      {fila.moneda === 'USD' ? (
                        <span />
                      ) : (
                        <CostoEnSoles
                          fila={fila}
                          indice={indice}
                          aplicando={aplicando}
                          onCentimos={(centimos) => {
                            parcheCoincidencia(indice, {
                              precioCompraCentimos: centimos,
                              moneda: 'PEN',
                            })
                          }}
                        />
                      )}
                      <div className="flex flex-col gap-1">
                        <Etiqueta htmlFor={`fecha-${fila.codigo}-${indice}`}>
                          Fecha
                        </Etiqueta>
                        <Campo
                          id={`fecha-${fila.codigo}-${indice}`}
                          type="date"
                          value={fila.precioCompraEn ?? ''}
                          disabled={aplicando}
                          onChange={(e) => {
                            const valor = e.target.value
                            parcheCoincidencia(indice, {
                              precioCompraEn: valor === '' ? undefined : valor,
                            })
                          }}
                        />
                      </div>
                    </div>
                    {fila.moneda === 'USD' ? (
                      <FormulaEnDolares
                        fila={fila}
                        indice={indice}
                        textoTc={
                          textoTc[claveDeFecha(fila.precioCompraEn)] ?? ''
                        }
                        aplicando={aplicando}
                        onPrecio={(precioOriginal) => {
                          parcheCoincidencia(indice, { precioOriginal })
                        }}
                        onTipoCambio={(valor) => {
                          cambiarTipoCambio(
                            claveDeFecha(fila.precioCompraEn),
                            valor,
                          )
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {avisoTc !== null ? (
            <p className="text-cuerpo text-aviso">{avisoTc}</p>
          ) : null}
          {faltaTipoCambio ? (
            <p className="text-cuerpo text-aviso">
              Escribe el tipo de cambio venta para confirmar una compra en
              dólares.
            </p>
          ) : null}
          {sinMatch.length > 0 ? (
            <div>
              <p className="font-mono text-etiqueta uppercase text-desvaida">
                Sin match en el catálogo
              </p>
              <ul className="mt-1 flex flex-col gap-2">
                {sinMatch.map((linea, indice) => (
                  <li
                    key={`${linea.etiquetaFactura}-${indice}`}
                    className="text-cuerpo text-desvaida"
                  >
                    <p>{linea.etiquetaFactura}</p>
                    {linea.moneda === 'USD' &&
                    linea.precioOriginal !== undefined ? (
                      <FormulaEnDolares
                        fila={linea}
                        indice={indice}
                        textoTc={
                          textoTc[claveDeFecha(linea.precioCompraEn)] ?? ''
                        }
                        aplicando={aplicando}
                        precioBloqueado
                        onPrecio={() => undefined}
                        onTipoCambio={(valor) => {
                          cambiarTipoCambio(
                            claveDeFecha(linea.precioCompraEn),
                            valor,
                          )
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {coincidencias.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Boton
                variante="discreto"
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
                {aplicando ? 'Guardando…' : 'Confirmar'}
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

function CostoEnSoles({
  fila,
  indice,
  aplicando,
  onCentimos,
}: {
  readonly fila: CoincidenciaDeCompra
  readonly indice: number
  readonly aplicando: boolean
  readonly onCentimos: (centimos: number) => void
}) {
  const centimos = fila.precioCompraCentimos ?? 0
  return (
    <div className="flex flex-col gap-1">
      <Etiqueta htmlFor={`costo-${fila.codigo}-${indice}`}>Costo</Etiqueta>
      <Campo
        id={`costo-${fila.codigo}-${indice}`}
        numerico
        inputMode="decimal"
        defaultValue={solesDesdeCentimos(centimos).toFixed(2)}
        disabled={aplicando}
        onBlur={(e) => {
          const n = centimosDesdeTextoDecimal(e.target.value)
          if (n === undefined) {
            e.target.value = solesDesdeCentimos(centimos).toFixed(2)
            return
          }
          onCentimos(n)
        }}
      />
    </div>
  )
}

function FormulaEnDolares({
  fila,
  indice,
  textoTc,
  aplicando,
  precioBloqueado = false,
  onPrecio,
  onTipoCambio,
}: {
  readonly fila: {
    readonly codigo?: string
    readonly precioOriginal?: string
    readonly precioCompraEn?: string
  }
  readonly indice: number
  readonly textoTc: string
  readonly aplicando: boolean
  readonly precioBloqueado?: boolean
  readonly onPrecio: (precio: string) => void
  readonly onTipoCambio: (valor: string) => void
}) {
  const factor = normalizarDecimal(textoTc)
  const centimos =
    fila.precioOriginal !== undefined && factor !== undefined
      ? centimosDeDecimales(fila.precioOriginal, factor)
      : undefined
  const soles = centimos !== undefined ? formatearImporte(centimos) : '—'
  const nombre = fila.codigo ?? fila.precioOriginal ?? String(indice)
  const fecha = fechaLatam(fila.precioCompraEn)
  return (
    <div className="flex flex-wrap items-end gap-2 text-cuerpo text-tinta">
      <span className="sr-only">
        {`US$ ${fila.precioOriginal ?? '—'} × ${textoTc || '—'} = S/ ${soles}`}
      </span>
      <span className="pb-2 font-mono">US$</span>
      <div className="w-28">
        <Etiqueta htmlFor={`usd-${nombre}-${indice}`}>Precio USD</Etiqueta>
        <Campo
          id={`usd-${nombre}-${indice}`}
          numerico
          inputMode="decimal"
          aria-label={`Precio en dólares de ${nombre}`}
          defaultValue={fila.precioOriginal ?? ''}
          disabled={aplicando || precioBloqueado}
          onChange={(e) => {
            const decimal = normalizarDecimal(e.target.value)
            if (decimal === undefined) return
            onPrecio(decimal)
          }}
        />
      </div>
      <span className="pb-2 font-mono">×</span>
      <div className="w-28">
        <Etiqueta htmlFor={`tc-${nombre}-${indice}`}>
          {fecha.length > 0 ? `TC ${fecha}` : 'Tipo de cambio'}
        </Etiqueta>
        <Campo
          id={`tc-${nombre}-${indice}`}
          numerico
          inputMode="decimal"
          aria-label={
            fecha.length > 0 ? `Tipo de cambio ${fecha}` : 'Tipo de cambio'
          }
          value={textoTc}
          disabled={aplicando}
          onChange={(e) => {
            onTipoCambio(e.target.value)
          }}
        />
      </div>
      <span className="pb-2 font-mono">{`= S/ ${soles}`}</span>
    </div>
  )
}
