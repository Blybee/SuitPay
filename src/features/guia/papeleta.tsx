import { useEffect, useId, useMemo, useState } from 'react'
import { Plus, Printer } from 'lucide-react'
import { sileo } from 'sileo'
import type { TrasladoDeGuia } from '../../domain/guia/tipos.ts'
import { faltantesDelTraslado } from '../../domain/guia/validar.ts'
import { generarClaveDeIdempotencia } from '../emision/clave.ts'
import { emitirGuiaFn, leerIndiceDeTransportistasFn } from './guia.funciones.ts'
import { debeMostrarToastRegenerar } from './recuperar.ts'
import type { RespuestaDelServidor } from '../emision/flujo.ts'
import { reimprimir } from '../emision/reimprimir.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'
import { resolverYPrecargarPdf } from '../emision/precarga.ts'
import { AltaTransportista } from '../transportistas/alta.tsx'

export interface BorradorDeGuia {
  readonly claveIdempotencia: string
  readonly traslado: TrasladoDeGuia
}

const PLACEHOLDER_UBIGEO = '150101'
const PLACEHOLDER_DIRECCION = 'Av. Central 122 LIMA - LIMA - LIMA'

function itemsDesdePedido(
  lineas: readonly LineaDePedido[],
): TrasladoDeGuia['items'] {
  return lineas.map((linea) => ({
    codigo: linea.codigo,
    cantidad: linea.cantidad,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
  }))
}

function trasladoVacio(lineas: readonly LineaDePedido[]): TrasladoDeGuia {
  return {
    modoTransporte: 'publico',
    motivoTraslado: 'venta',
    pesoBruto: 1,
    unidadPeso: 'KGM',
    numeroBultos: 1,
    direccionPartida: { ubigeo: '', direccion: '' },
    direccionLlegada: { ubigeo: '', direccion: '' },
    items: itemsDesdePedido(lineas),
  }
}

function etiquetaDeTransportista(denominacion: string, ruc: string): string {
  return `${denominacion} · ${ruc}`
}

function mensajeDeErrorDeGuia(error: {
  readonly codigo?: string
  readonly mensaje?: string
}): string {
  if (error.codigo === 'emision_rechazada') {
    return 'La guía fue rechazada. Revisa serie T, ubigeo, direcciones y transportista. Las series solo locales de DEMO a menudo no las acepta el servicio de emisión.'
  }
  if (error.codigo === 'serie_no_configurada') {
    return (
      error.mensaje ??
      'No tienes serie de guía asignada. El administrador debe asignarte una serie T.'
    )
  }
  return (
    error.mensaje ??
    'Ocurrió un fallo inesperado. Si vuelve a pasar, avisa al administrador.'
  )
}

export function PapeletaDeGuia({
  abierta,
  onCerrar,
  cliente,
  lineas,
  comprobanteOrigenId,
  etiquetaOrigen,
  urlPdfOrigen,
  borradorInicial,
  onEmitida,
  onRechazoDefinitivo,
}: {
  readonly abierta: boolean
  readonly onCerrar: () => void
  readonly cliente: ClienteDelPedido | null
  readonly lineas: readonly LineaDePedido[]
  readonly comprobanteOrigenId: string | null
  /** Serie-número visible, p. ej. «Asociada a Boleta B001-00000042». */
  readonly etiquetaOrigen?: string | null
  readonly urlPdfOrigen?: string | null
  readonly borradorInicial?: BorradorDeGuia | null
  readonly onEmitida: (respuesta: RespuestaDelServidor) => void
  readonly onRechazoDefinitivo: (borrador: BorradorDeGuia) => void
}) {
  const idListbox = useId()
  const [clave, setClave] = useState(() => generarClaveDeIdempotencia())
  const [traslado, setTraslado] = useState<TrasladoDeGuia>(() =>
    trasladoVacio(lineas),
  )
  const [busqueda, setBusqueda] = useState('')
  const [listaAbierta, setListaAbierta] = useState(false)
  const [indice, setIndice] = useState<
    readonly { numeroDocumento: string; denominacion: string }[]
  >([])
  const [enviando, setEnviando] = useState(false)
  const [imprimiendoOrigen, setImprimiendoOrigen] = useState(false)
  const [altaAbierta, setAltaAbierta] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avisoPdf, setAvisoPdf] = useState<string | null>(null)

  useEffect(() => {
    if (!abierta) return
    if (borradorInicial !== undefined && borradorInicial !== null) {
      setClave(borradorInicial.claveIdempotencia)
      setTraslado(borradorInicial.traslado)
      const t = borradorInicial.traslado.transportista
      setBusqueda(
        t === undefined
          ? ''
          : etiquetaDeTransportista(t.denominacion, t.numeroDocumento),
      )
    } else {
      setClave(generarClaveDeIdempotencia())
      setTraslado(trasladoVacio(lineas))
      setBusqueda('')
    }
    setListaAbierta(false)
    setAltaAbierta(false)
    void leerIndiceDeTransportistasFn().then((r) => {
      setIndice(r.transportistas)
    })
    if (comprobanteOrigenId !== null) {
      void resolverYPrecargarPdf(comprobanteOrigenId, urlPdfOrigen ?? null)
    }
    // Al abrir o recuperar borrador; no al editar el pedido debajo.
  }, [abierta, borradorInicial, comprobanteOrigenId, urlPdfOrigen])

  useEffect(() => {
    if (!abierta) return
    setError(null)
    setAvisoPdf(null)
  }, [abierta])

  const coincidencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q.length < 2) return []
    return indice
      .filter(
        (cada) =>
          cada.numeroDocumento.includes(q) ||
          cada.denominacion.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [busqueda, indice])

  const mostrarListbox = listaAbierta && coincidencias.length > 0
  const faltantes = faltantesDelTraslado(traslado)
  const rucHintAlta = /^\d{11}$/.test(busqueda.trim()) ? busqueda.trim() : ''

  async function emitir(): Promise<void> {
    if (faltantes.length > 0) {
      setError(faltantes[0]?.motivo ?? 'Faltan datos.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await emitirGuiaFn({
        data: {
          claveIdempotencia: clave,
          destinatario:
            cliente === null
              ? null
              : {
                  tipoDocumento: cliente.tipoDocumento,
                  numeroDocumento: cliente.numeroDocumento,
                  denominacion: cliente.denominacion,
                  direccion: cliente.direccion,
                },
          traslado: { ...traslado, items: [...traslado.items] },
          comprobanteOrigenId,
        },
      })
      if (!respuesta.ok || respuesta.error) {
        const codigo = respuesta.error?.codigo ?? 'fallo_inesperado'
        if (debeMostrarToastRegenerar(codigo)) {
          onRechazoDefinitivo({ claveIdempotencia: clave, traslado })
          sileo.action({
            title: 'Guía rechazada',
            description:
              mensajeDeErrorDeGuia(respuesta.error ?? {}) ||
              'La guía fue rechazada. Puedes volver a generar sin reescribir el traslado.',
            duration: null,
            button: {
              title: 'Volver a Generar',
              onClick: () => {
                onRechazoDefinitivo({
                  claveIdempotencia: generarClaveDeIdempotencia(),
                  traslado,
                })
              },
            },
          })
        }
        setError(mensajeDeErrorDeGuia(respuesta.error ?? {}))
        onEmitida({
          ok: false,
          error: respuesta.error,
        })
        return
      }
      onEmitida({ ok: true, comprobante: respuesta.comprobante })
      onCerrar()
    } catch {
      setError(
        'Ocurrió un fallo inesperado. Si vuelve a pasar, avisa al administrador.',
      )
    } finally {
      setEnviando(false)
    }
  }

  function parche(cambio: Partial<TrasladoDeGuia>): void {
    setTraslado((prev) => ({ ...prev, ...cambio }))
  }

  function elegirTransportista(cada: {
    readonly numeroDocumento: string
    readonly denominacion: string
  }): void {
    parche({
      transportista: {
        numeroDocumento: cada.numeroDocumento,
        denominacion: cada.denominacion,
      },
    })
    setBusqueda(etiquetaDeTransportista(cada.denominacion, cada.numeroDocumento))
    setListaAbierta(false)
  }

  async function imprimirOrigen(): Promise<void> {
    if (comprobanteOrigenId === null) return
    setAvisoPdf(null)
    setImprimiendoOrigen(true)
    try {
      const resultado = await reimprimir(comprobanteOrigenId)
      if (!resultado.ok) {
        setAvisoPdf(
          resultado.motivo === 'sin_archivo_todavia'
            ? 'Este comprobante no tiene archivo PDF.'
            : resultado.motivo === 'no_encontrado'
              ? 'No se encontró el comprobante de origen.'
              : 'No se pudo abrir el PDF. Revisa el bloqueador de ventanas.',
        )
      }
    } finally {
      setImprimiendoOrigen(false)
    }
  }

  return (
    <Modal
      abierta={abierta}
      alCambiar={(ahora) => {
        if (!ahora && !enviando) onCerrar()
      }}
      titulo="Guía de remisión"
      descripcion="Completa el traslado y confirma Emitir. El comando no emite por sí solo."
      noSeCierraSola={enviando}
      cerrarConFondo={false}
      className="overflow-visible"
      pie={
        <>
          <Boton disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="principal"
            disabled={enviando}
            onClick={() => void emitir()}
          >
            {enviando ? 'Emitiendo…' : 'Emitir'}
          </Boton>
        </>
      }
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto overflow-x-visible">
        <p className="text-etiqueta text-desvaida">
          {cliente
            ? `Destinatario: ${cliente.denominacion}`
            : 'Sin destinatario (traslado interno o identifícalo en el pedido).'}
          {etiquetaOrigen
            ? ` · ${etiquetaOrigen}`
            : comprobanteOrigenId
              ? ' · Asociada al comprobante reutilizado.'
              : ''}
        </p>
        {comprobanteOrigenId !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              disabled={imprimiendoOrigen}
              aria-busy={imprimiendoOrigen}
              onClick={() => {
                void imprimirOrigen()
              }}
            >
              <Printer className="size-5" aria-hidden />
              {imprimiendoOrigen ? 'Abriendo…' : 'Imprimir origen'}
            </Boton>
            {avisoPdf !== null ? (
              <p className="text-cuerpo font-bold text-aviso" role="status">
                {avisoPdf}
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="text-cuerpo font-bold text-aviso" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Selector
            id="guia-modo"
            etiqueta="Modo de transporte"
            disposicion="columna"
            valor={traslado.modoTransporte}
            onCambiar={(modoTransporte) => parche({ modoTransporte })}
            opciones={[
              { valor: 'publico', etiqueta: 'Público' },
              { valor: 'privado', etiqueta: 'Privado' },
            ]}
          />
          <Selector
            id="guia-motivo"
            etiqueta="Motivo"
            disposicion="columna"
            valor={traslado.motivoTraslado}
            onCambiar={(motivoTraslado) => parche({ motivoTraslado })}
            opciones={[
              { valor: 'venta', etiqueta: 'Venta' },
              { valor: 'compra', etiqueta: 'Compra' },
              { valor: 'consignacion', etiqueta: 'Consignación' },
              { valor: 'entre_almacenes', etiqueta: 'Entre almacenes' },
              { valor: 'otros', etiqueta: 'Otros' },
            ]}
          />
          <div>
            <Etiqueta htmlFor="guia-peso">Peso bruto</Etiqueta>
            <Campo
              id="guia-peso"
              className="mt-1"
              numerico
              value={String(traslado.pesoBruto)}
              onChange={(e) =>
                parche({ pesoBruto: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Etiqueta htmlFor="guia-bultos">Bultos</Etiqueta>
            <Campo
              id="guia-bultos"
              className="mt-1"
              numerico
              value={String(traslado.numeroBultos)}
              onChange={(e) =>
                parche({ numeroBultos: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div>
          <Etiqueta htmlFor="guia-partida">
            Partida (ubigeo · dirección)
          </Etiqueta>
          <div className="mt-1 grid gap-2 sm:grid-cols-[8rem_1fr]">
            <Campo
              id="guia-partida-ubigeo"
              inputMode="numeric"
              placeholder={PLACEHOLDER_UBIGEO}
              value={traslado.direccionPartida.ubigeo}
              onChange={(e) =>
                parche({
                  direccionPartida: {
                    ...traslado.direccionPartida,
                    ubigeo: e.target.value,
                  },
                })
              }
            />
            <Campo
              id="guia-partida"
              placeholder={PLACEHOLDER_DIRECCION}
              value={traslado.direccionPartida.direccion}
              onChange={(e) =>
                parche({
                  direccionPartida: {
                    ...traslado.direccionPartida,
                    direccion: e.target.value,
                  },
                })
              }
            />
          </div>
          {traslado.motivoTraslado === 'entre_almacenes' ? (
            <Campo
              className="mt-2"
              placeholder="Anexo de partida"
              value={traslado.direccionPartida.anexo ?? ''}
              onChange={(e) =>
                parche({
                  direccionPartida: {
                    ...traslado.direccionPartida,
                    anexo: e.target.value,
                  },
                })
              }
            />
          ) : null}
        </div>

        <div>
          <Etiqueta htmlFor="guia-llegada">
            Llegada (ubigeo · dirección)
          </Etiqueta>
          <div className="mt-1 grid gap-2 sm:grid-cols-[8rem_1fr]">
            <Campo
              id="guia-llegada-ubigeo"
              inputMode="numeric"
              placeholder={PLACEHOLDER_UBIGEO}
              value={traslado.direccionLlegada.ubigeo}
              onChange={(e) =>
                parche({
                  direccionLlegada: {
                    ...traslado.direccionLlegada,
                    ubigeo: e.target.value,
                  },
                })
              }
            />
            <Campo
              id="guia-llegada"
              placeholder={PLACEHOLDER_DIRECCION}
              value={traslado.direccionLlegada.direccion}
              onChange={(e) =>
                parche({
                  direccionLlegada: {
                    ...traslado.direccionLlegada,
                    direccion: e.target.value,
                  },
                })
              }
            />
          </div>
          {traslado.motivoTraslado === 'entre_almacenes' ? (
            <Campo
              className="mt-2"
              placeholder="Anexo de llegada"
              value={traslado.direccionLlegada.anexo ?? ''}
              onChange={(e) =>
                parche({
                  direccionLlegada: {
                    ...traslado.direccionLlegada,
                    anexo: e.target.value,
                  },
                })
              }
            />
          ) : null}
        </div>

        {traslado.modoTransporte === 'publico' ? (
          <div>
            <Etiqueta htmlFor="guia-transportista">Transportista</Etiqueta>
            <div className="mt-1 flex items-center gap-2">
              <Campo
                id="guia-transportista"
                className="min-w-0 flex-1"
                placeholder="RUC o denominación"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={mostrarListbox}
                aria-controls={idListbox}
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setListaAbierta(true)
                }}
                onFocus={() => {
                  if (coincidencias.length > 0) setListaAbierta(true)
                }}
              />
              <Boton
                tamano="icono"
                aria-label="Crear transportista"
                title="Crear transportista"
                onClick={() => setAltaAbierta(true)}
              >
                <Plus className="size-5" aria-hidden />
              </Boton>
            </div>
            {mostrarListbox ? (
              <ul
                id={idListbox}
                role="listbox"
                className="mt-1 rounded-2xl border border-borde"
              >
                {coincidencias.map((cada) => (
                  <li key={cada.numeroDocumento} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={
                        traslado.transportista?.numeroDocumento ===
                        cada.numeroDocumento
                      }
                      className="w-full px-3 py-2 text-left text-cuerpo hover:bg-mesa"
                      onClick={() => elegirTransportista(cada)}
                    >
                      {etiquetaDeTransportista(
                        cada.denominacion,
                        cada.numeroDocumento,
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo
              placeholder="DNI conductor"
              value={traslado.conductor?.numeroDocumento ?? ''}
              onChange={(e) =>
                parche({
                  conductor: {
                    tipoDocumento: 'DNI',
                    numeroDocumento: e.target.value,
                    nombres: traslado.conductor?.nombres ?? '',
                    licencia: traslado.conductor?.licencia ?? '',
                    placa: traslado.conductor?.placa ?? '',
                  },
                })
              }
            />
            <Campo
              placeholder="Nombres"
              value={traslado.conductor?.nombres ?? ''}
              onChange={(e) =>
                parche({
                  conductor: {
                    tipoDocumento: 'DNI',
                    numeroDocumento: traslado.conductor?.numeroDocumento ?? '',
                    nombres: e.target.value,
                    licencia: traslado.conductor?.licencia ?? '',
                    placa: traslado.conductor?.placa ?? '',
                  },
                })
              }
            />
            <Campo
              placeholder="Licencia"
              value={traslado.conductor?.licencia ?? ''}
              onChange={(e) =>
                parche({
                  conductor: {
                    tipoDocumento: 'DNI',
                    numeroDocumento: traslado.conductor?.numeroDocumento ?? '',
                    nombres: traslado.conductor?.nombres ?? '',
                    licencia: e.target.value,
                    placa: traslado.conductor?.placa ?? '',
                  },
                })
              }
            />
            <Campo
              placeholder="Placa"
              value={traslado.conductor?.placa ?? ''}
              onChange={(e) =>
                parche({
                  conductor: {
                    tipoDocumento: 'DNI',
                    numeroDocumento: traslado.conductor?.numeroDocumento ?? '',
                    nombres: traslado.conductor?.nombres ?? '',
                    licencia: traslado.conductor?.licencia ?? '',
                    placa: e.target.value,
                  },
                })
              }
            />
          </div>
        )}

        <p className="text-etiqueta text-desvaida">
          {traslado.items.length} ítem{traslado.items.length === 1 ? '' : 's'}{' '}
          desde el pedido.
        </p>
      </div>

      <AltaTransportista
        abierta={altaAbierta}
        rucInicial={rucHintAlta}
        onCerrar={() => setAltaAbierta(false)}
        onCreado={(denominacion, ruc) => {
          elegirTransportista({ numeroDocumento: ruc, denominacion })
          void leerIndiceDeTransportistasFn().then((r) => {
            setIndice(r.transportistas)
          })
        }}
      />
    </Modal>
  )
}

export { mensajeDeErrorDeGuia }
