import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Producto } from '../../domain/esquemas/comunes.ts'
import type { CoincidenciaDeCompra } from '../../domain/compras/tipos.ts'
import { MAX_MEDIOS_COMPRAS } from '../../domain/compras/tipos.ts'
import { centimosDesdeSoles, solesDesdeCentimos } from '../../domain/totales/calculo.ts'
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
  const [coincidencias, setCoincidencias] = useState<CoincidenciaDeCompra[]>(
    [],
  )
  const [sinMatch, setSinMatch] = useState<
    readonly { etiquetaFactura: string; precioCompraCentimos?: number }[]
  >([])
  const [aplicando, setAplicando] = useState(false)

  const archivos = brutos.map(fichaDe)

  const descripcionPorCodigo = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const producto of productos) {
      mapa.set(producto.codigo, producto.descripcion)
    }
    return mapa
  }, [productos])

  function fallar(texto: string): void {
    setEstado('error')
    setMensaje(texto)
    usarNotificaciones.getState().mostrar({ tono: 'error', mensaje: texto })
  }

  function quitar(indice: number): void {
    if (ocupado || aplicando) return
    const restantes = brutos.filter((_, i) => i !== indice)
    setBrutos(restantes)
    setCoincidencias([])
    setSinMatch([])
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
    setCoincidencias([])
    setSinMatch([])
    void extraer(juntos)
  }

  async function confirmar(): Promise<void> {
    if (!puedeEscribir || coincidencias.length === 0) return
    setAplicando(true)
    try {
      const respuesta = await aplicarPreciosCompraFn({
        data: { coincidencias },
      })
      if (!respuesta.ok) {
        fallar(respuesta.error?.mensaje ?? 'No se pudo guardar el costo.')
        return
      }
      vaciarCacheInventario()
      setBrutos([])
      setCoincidencias([])
      setSinMatch([])
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
    setCoincidencias([])
    setSinMatch([])
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

      {coincidencias.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="font-mono text-etiqueta uppercase text-desvaida">
            Boceto de precios de compra
          </p>
          <ul className="flex flex-col gap-2">
            {coincidencias.map((fila, indice) => (
              <li
                key={`${fila.codigo}-${indice}`}
                className="grid gap-2 rounded-2xl border border-borde bg-mesa p-3 md:grid-cols-[8rem_1fr_7rem_8rem]"
              >
                <p className="font-mono text-etiqueta uppercase text-desvaida">
                  {fila.codigo}
                </p>
                <p className="truncate text-cuerpo text-tinta">
                  {descripcionPorCodigo.get(fila.codigo) ?? fila.etiquetaFactura}
                </p>
                <div className="flex flex-col gap-1">
                  <Etiqueta htmlFor={`costo-${fila.codigo}-${indice}`}>
                    Costo
                  </Etiqueta>
                  <Campo
                    id={`costo-${fila.codigo}-${indice}`}
                    numerico
                    inputMode="decimal"
                    defaultValue={solesDesdeCentimos(
                      fila.precioCompraCentimos,
                    ).toFixed(2)}
                    disabled={aplicando}
                    onBlur={(e) => {
                      const n = Number.parseFloat(e.target.value.replace(',', '.'))
                      if (!Number.isFinite(n) || n < 0) {
                        e.target.value = solesDesdeCentimos(
                          fila.precioCompraCentimos,
                        ).toFixed(2)
                        return
                      }
                      parcheCoincidencia(indice, {
                        precioCompraCentimos: centimosDesdeSoles(n),
                      })
                    }}
                  />
                </div>
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
              </li>
            ))}
          </ul>
          {sinMatch.length > 0 ? (
            <div>
              <p className="font-mono text-etiqueta uppercase text-desvaida">
                Sin match en el catálogo
              </p>
              <ul className="mt-1 list-disc pl-5 text-cuerpo text-desvaida">
                {sinMatch.map((linea, indice) => (
                  <li key={`${linea.etiquetaFactura}-${indice}`}>
                    {linea.etiquetaFactura}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
              disabled={aplicando || coincidencias.length === 0}
              aria-busy={aplicando || undefined}
              onClick={() => void confirmar()}
            >
              {aplicando ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : null}
              {aplicando ? 'Guardando…' : 'Confirmar'}
            </Boton>
          </div>
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
