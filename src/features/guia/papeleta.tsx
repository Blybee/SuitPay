import { useEffect, useMemo, useState } from 'react'
import { sileo } from 'sileo'
import type { TrasladoDeGuia } from '../../domain/guia/tipos.ts'
import { faltantesDelTraslado } from '../../domain/guia/validar.ts'
import { generarClaveDeIdempotencia } from '../emision/clave.ts'
import { emitirGuiaFn } from './guia.funciones.ts'
import { leerIndiceDeTransportistasFn } from './guia.funciones.ts'
import { debeMostrarToastRegenerar } from './recuperar.ts'
import type { RespuestaDelServidor } from '../emision/flujo.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'
import type { LineaDePedido } from '../../domain/totales/calculo.ts'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'

export interface BorradorDeGuia {
  readonly claveIdempotencia: string
  readonly traslado: TrasladoDeGuia
}

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
    direccionPartida: { ubigeo: '150101', direccion: '' },
    direccionLlegada: { ubigeo: '150101', direccion: '' },
    items: itemsDesdePedido(lineas),
  }
}

export function PapeletaDeGuia({
  abierta,
  onCerrar,
  cliente,
  lineas,
  comprobanteOrigenId,
  borradorInicial,
  onEmitida,
  onRechazoDefinitivo,
}: {
  readonly abierta: boolean
  readonly onCerrar: () => void
  readonly cliente: ClienteDelPedido | null
  readonly lineas: readonly LineaDePedido[]
  readonly comprobanteOrigenId: string | null
  readonly borradorInicial?: BorradorDeGuia | null
  readonly onEmitida: (respuesta: RespuestaDelServidor) => void
  readonly onRechazoDefinitivo: (borrador: BorradorDeGuia) => void
}) {
  const [clave, setClave] = useState(() => generarClaveDeIdempotencia())
  const [traslado, setTraslado] = useState<TrasladoDeGuia>(() =>
    trasladoVacio(lineas),
  )
  const [busqueda, setBusqueda] = useState('')
  const [indice, setIndice] = useState<
    readonly { numeroDocumento: string; denominacion: string }[]
  >([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierta) return
    if (borradorInicial !== undefined && borradorInicial !== null) {
      setClave(borradorInicial.claveIdempotencia)
      setTraslado(borradorInicial.traslado)
    } else {
      setClave(generarClaveDeIdempotencia())
      setTraslado(trasladoVacio(lineas))
    }
    setError(null)
    void leerIndiceDeTransportistasFn().then((r) => {
      if (r.ok) setIndice(r.transportistas)
    })
    // Solo al abrir o al recuperar un borrador; no al editar el pedido debajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lineas se lee al abrir
  }, [abierta, borradorInicial])

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

  const faltantes = faltantesDelTraslado(traslado)

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
              respuesta.error?.mensaje ??
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
        onEmitida({
          ok: false,
          error: respuesta.error,
        })
        return
      }
      onEmitida({ ok: true, comprobante: respuesta.comprobante })
      onCerrar()
    } finally {
      setEnviando(false)
    }
  }

  function parche(cambio: Partial<TrasladoDeGuia>): void {
    setTraslado((prev) => ({ ...prev, ...cambio }))
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
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        <p className="text-etiqueta text-desvaida">
          {cliente
            ? `Destinatario: ${cliente.denominacion}`
            : 'Sin destinatario (traslado interno o identifícalo en el pedido).'}
          {comprobanteOrigenId ? ' · Asociada al comprobante reutilizado.' : ''}
        </p>

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
            <Campo
              id="guia-transportista"
              className="mt-1"
              placeholder="RUC o denominación"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {traslado.transportista ? (
              <p className="mt-1 text-etiqueta text-tinta">
                {traslado.transportista.denominacion} ·{' '}
                {traslado.transportista.numeroDocumento}
              </p>
            ) : null}
            {coincidencias.length > 0 ? (
              <ul className="mt-1 rounded-2xl border border-borde">
                {coincidencias.map((cada) => (
                  <li key={cada.numeroDocumento}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-cuerpo hover:bg-mesa"
                      onClick={() => {
                        parche({
                          transportista: {
                            numeroDocumento: cada.numeroDocumento,
                            denominacion: cada.denominacion,
                          },
                        })
                        setBusqueda(cada.denominacion)
                      }}
                    >
                      {cada.denominacion} · {cada.numeroDocumento}
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

        {error ? (
          <p className="text-cuerpo font-bold text-aviso" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
