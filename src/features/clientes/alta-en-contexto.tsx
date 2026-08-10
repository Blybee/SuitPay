import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import type { ClienteEnIndice } from '../../infra/local/catalogo.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'
import {
  clienteCompatibleConModo,
  mensajeIncompatibilidadCliente,
  tipoDocumentoClienteDesdeNumero,
  tiposDocumentoClientePermitidos,
} from './compatibilidad-documento.ts'
import type { ModoDeClienteEnDocumento } from './compatibilidad-documento.ts'
import { buscarCoincidenciasDeCliente } from './coincidencias.ts'
import {
  actualizarClienteFn,
  consultarContribuyenteFn,
  crearClienteFn,
} from './clientes.funciones.ts'
import type { DatosDeContribuyenteParaRevision } from './clientes.funciones.ts'
import { leerClientePorDocumento } from './existencia.ts'
import { FormularioManualDeCliente } from './manual.tsx'
import type { DatosManualesDeCliente } from './manual.tsx'
import {
  decidirTrasConsultaContribuyente,
  mensajeDeConsultaIndisponible,
} from './resultado-consulta.ts'
import { RevisionDeContribuyente } from './revision.tsx'

export type ArranqueManualDeCliente = {
  readonly tipoDocumento: 'DNI' | 'RUC'
  readonly numeroDocumento: string
  readonly mensaje?: string
}

export type ArranqueRevisionDeCliente = DatosDeContribuyenteParaRevision

type Fase =
  | 'buscar'
  | 'coincidencias'
  | 'revision'
  | 'manual'
  | 'guardando'
  | 'error'

function tipoPorDocumento(numero: string): 'DNI' | 'RUC' {
  return tipoDocumentoClienteDesdeNumero(numero) ?? 'DNI'
}

/**
 * Alta / elección de cliente sin abandonar la venta (FR-022–FR-026).
 */
export function AltaClienteEnContexto({
  abierta,
  onCerrar,
  indiceDeClientes,
  onClienteElegido,
  onClienteCreadoEnIndice,
  modoDocumento = 'nota_venta',
  consultaInicial = null,
  arranqueManual = null,
  arranqueRevision = null,
}: {
  readonly abierta: boolean
  readonly onCerrar: () => void
  readonly indiceDeClientes: readonly ClienteEnIndice[]
  readonly onClienteElegido: (cliente: ClienteDelPedido) => void
  readonly onClienteCreadoEnIndice: (entrada: ClienteEnIndice) => void
  /** Restringe DNI/RUC según boleta/factura/cotización. */
  readonly modoDocumento?: ModoDeClienteEnDocumento
  /** Si llega al abrir (p. ej. desde el RUC/DNI inline), se busca sola. */
  readonly consultaInicial?: string | null
  /**
   * Abre directo en alta manual (p. ej. padrón caído).
   * Evita reconsultar un host que ya falló.
   */
  readonly arranqueManual?: ArranqueManualDeCliente | null
  /** Abre en revisión con datos ya consultados (sin segunda llamada al padrón). */
  readonly arranqueRevision?: ArranqueRevisionDeCliente | null
}) {
  const tiposPermitidos = tiposDocumentoClientePermitidos(modoDocumento)
  const tipoManualPorDefecto = tiposPermitidos[0] ?? 'RUC'

  const [fase, setFase] = useState<Fase>('buscar')
  const [consulta, setConsulta] = useState('')
  const [coincidencias, setCoincidencias] = useState<readonly ClienteEnIndice[]>(
    [],
  )
  const [revision, setRevision] = useState<DatosDeContribuyenteParaRevision | null>(
    null,
  )
  const [manual, setManual] = useState<DatosManualesDeCliente>({
    tipoDocumento: tipoManualPorDefecto,
    numeroDocumento: '',
    denominacion: '',
  })
  const [editandoExistente, setEditandoExistente] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const consultaAutoProcesada = useRef<string | null>(null)
  const manualAutoProcesado = useRef<string | null>(null)
  const revisionAutoProcesada = useRef<string | null>(null)

  function reiniciar() {
    setFase('buscar')
    setConsulta('')
    setCoincidencias([])
    setRevision(null)
    setMensaje(null)
    setEditandoExistente(false)
    setManual({
      tipoDocumento: tipoManualPorDefecto,
      numeroDocumento: '',
      denominacion: '',
    })
    consultaAutoProcesada.current = null
    manualAutoProcesado.current = null
    revisionAutoProcesada.current = null
  }

  function rechazarSiIncompatible(numeroDocumento: string): boolean {
    if (clienteCompatibleConModo(numeroDocumento, modoDocumento)) return false
    setMensaje(mensajeIncompatibilidadCliente(numeroDocumento, modoDocumento))
    return true
  }

  function cerrar() {
    reiniciar()
    onCerrar()
  }

  async function usarExistente(entrada: ClienteEnIndice) {
    if (rechazarSiIncompatible(entrada.numeroDocumento)) {
      setFase('coincidencias')
      return
    }
    setFase('guardando')
    const completo = await leerClientePorDocumento(entrada.numeroDocumento)
    if (completo !== null) {
      onClienteElegido({
        tipoDocumento:
          completo.tipoDocumento === 'RUC' || completo.tipoDocumento === 'DNI'
            ? completo.tipoDocumento
            : tipoPorDocumento(completo.numeroDocumento),
        numeroDocumento: completo.numeroDocumento,
        denominacion: completo.denominacion,
        ...(completo.direccion !== undefined
          ? { direccion: completo.direccion }
          : {}),
      })
      cerrar()
      return
    }
    onClienteElegido({
      tipoDocumento: tipoPorDocumento(entrada.numeroDocumento),
      numeroDocumento: entrada.numeroDocumento,
      denominacion: entrada.denominacion,
    })
    cerrar()
  }

  async function editarExistente(entrada: ClienteEnIndice) {
    setFase('guardando')
    setMensaje(null)
    const completo = await leerClientePorDocumento(entrada.numeroDocumento)
    if (completo !== null) {
      setManual({
        tipoDocumento: completo.tipoDocumento,
        numeroDocumento: completo.numeroDocumento,
        denominacion: completo.denominacion,
        ...(completo.direccion !== undefined
          ? { direccion: completo.direccion }
          : {}),
      })
    } else {
      setManual({
        tipoDocumento: tipoPorDocumento(entrada.numeroDocumento),
        numeroDocumento: entrada.numeroDocumento,
        denominacion: entrada.denominacion,
      })
    }
    setEditandoExistente(true)
    setFase('manual')
  }

  async function buscar(consultaForzada?: string) {
    setMensaje(null)
    setEditandoExistente(false)
    const texto = (consultaForzada ?? consulta).trim()
    if (texto.length === 0) return
    if (consultaForzada !== undefined) setConsulta(texto)

    const locales = buscarCoincidenciasDeCliente(texto, indiceDeClientes)
    const esDocumento = /^\d{8,11}$/.test(texto)

    if (!esDocumento) {
      if (locales.length > 0) {
        setCoincidencias(locales)
        setFase('coincidencias')
        return
      }
      setMensaje('Escribe un RUC/DNI o parte de la razón social.')
      setFase('error')
      return
    }

    if (rechazarSiIncompatible(texto)) {
      setFase('error')
      return
    }

    // RUC/DNI: listar coincidencias locales + el registro en Firestore si existe.
    setFase('guardando')
    const existente = await leerClientePorDocumento(texto)
    const porDocumento = new Map<string, ClienteEnIndice>()
    for (const cada of locales) {
      porDocumento.set(cada.numeroDocumento, cada)
    }
    if (existente !== null) {
      porDocumento.set(existente.numeroDocumento, {
        numeroDocumento: existente.numeroDocumento,
        denominacion: existente.denominacion,
      })
    }

    if (porDocumento.size > 0) {
      setCoincidencias([...porDocumento.values()])
      setFase('coincidencias')
      return
    }

    // No registrado: consulta padrón → revisión o alta manual.
    const tipo = tipoPorDocumento(texto)
    try {
      const respuesta = await consultarContribuyenteFn({
        data: { tipoDocumento: tipo, numeroDocumento: texto },
      })
      const decision = decidirTrasConsultaContribuyente(respuesta, {
        tipoDocumento: tipo,
        numeroDocumento: texto,
      })
      if (decision.tipo === 'confirmar') {
        setRevision(decision.datos)
        setFase('revision')
        return
      }
      setManual({
        tipoDocumento: decision.tipoDocumento,
        numeroDocumento: decision.numeroDocumento,
        denominacion: '',
      })
      setMensaje(decision.mensaje)
      setFase('manual')
      return
    } catch {
      setManual({
        tipoDocumento: tipo,
        numeroDocumento: texto,
        denominacion: '',
      })
      setMensaje(mensajeDeConsultaIndisponible())
      setFase('manual')
    }
  }

  useEffect(() => {
    if (!abierta) {
      consultaAutoProcesada.current = null
      manualAutoProcesado.current = null
      revisionAutoProcesada.current = null
      return
    }

    if (arranqueRevision !== null && arranqueRevision !== undefined) {
      const clave = `${arranqueRevision.tipoDocumento}:${arranqueRevision.numeroDocumento}`
      if (revisionAutoProcesada.current === clave) return
      revisionAutoProcesada.current = clave
      setConsulta(arranqueRevision.numeroDocumento)
      setRevision(arranqueRevision)
      setFase('revision')
      return
    }

    if (arranqueManual !== null && arranqueManual !== undefined) {
      const clave = `${arranqueManual.tipoDocumento}:${arranqueManual.numeroDocumento}`
      if (manualAutoProcesado.current === clave) return
      manualAutoProcesado.current = clave
      setConsulta(arranqueManual.numeroDocumento)
      setManual({
        tipoDocumento: arranqueManual.tipoDocumento,
        numeroDocumento: arranqueManual.numeroDocumento,
        denominacion: '',
      })
      setMensaje(arranqueManual.mensaje ?? mensajeDeConsultaIndisponible())
      setEditandoExistente(false)
      setFase('manual')
      return
    }

    const inicial = consultaInicial?.trim() ?? ''
    if (inicial.length === 0) return
    if (consultaAutoProcesada.current === inicial) return
    consultaAutoProcesada.current = inicial
    void buscar(inicial)
  }, [abierta, consultaInicial, arranqueManual, arranqueRevision]) // buscar es estable respecto a la consulta forzada

  async function confirmarRevision() {
    if (revision === null) return
    if (rechazarSiIncompatible(revision.numeroDocumento)) {
      setFase('revision')
      return
    }
    setFase('guardando')
    const respuesta = await crearClienteFn({
      data: {
        tipoDocumento: revision.tipoDocumento,
        numeroDocumento: revision.numeroDocumento,
        denominacion: revision.denominacion,
        direccion: revision.direccion,
        ubigeo: revision.ubigeo,
        condicion: revision.condicion,
        consultadoEn: new Date().toISOString(),
      },
    })

    if (!respuesta.ok || respuesta.cliente === undefined) {
      setMensaje(respuesta.error?.mensaje ?? 'No se pudo guardar el cliente.')
      setFase('error')
      return
    }

    onClienteCreadoEnIndice({
      numeroDocumento: respuesta.cliente.numeroDocumento,
      denominacion: respuesta.cliente.denominacion,
    })
    onClienteElegido({
      tipoDocumento: revision.tipoDocumento,
      numeroDocumento: revision.numeroDocumento,
      denominacion: revision.denominacion,
      direccion: revision.direccion,
    })
    cerrar()
  }

  async function confirmarManual() {
    if (
      manual.numeroDocumento.trim().length < 8 ||
      manual.denominacion.trim().length === 0
    ) {
      setMensaje('Faltan el documento o la denominación.')
      return
    }
    if (rechazarSiIncompatible(manual.numeroDocumento)) {
      setFase('manual')
      return
    }
    setFase('guardando')

    if (editandoExistente) {
      const respuesta = await actualizarClienteFn({
        data: {
          tipoDocumento: manual.tipoDocumento,
          numeroDocumento: manual.numeroDocumento.trim(),
          denominacion: manual.denominacion.trim(),
          direccion: manual.direccion,
        },
      })
      if (!respuesta.ok || respuesta.cliente === undefined) {
        setMensaje(respuesta.error?.mensaje ?? 'No se pudo actualizar el cliente.')
        setFase('manual')
        return
      }
      onClienteCreadoEnIndice({
        numeroDocumento: respuesta.cliente.numeroDocumento,
        denominacion: respuesta.cliente.denominacion,
      })
      onClienteElegido({
        tipoDocumento:
          manual.tipoDocumento === 'RUC' || manual.tipoDocumento === 'DNI'
            ? manual.tipoDocumento
            : tipoPorDocumento(respuesta.cliente.numeroDocumento),
        numeroDocumento: respuesta.cliente.numeroDocumento,
        denominacion: respuesta.cliente.denominacion,
        direccion: manual.direccion,
      })
      cerrar()
      return
    }

    const respuesta = await crearClienteFn({
      data: {
        tipoDocumento: manual.tipoDocumento,
        numeroDocumento: manual.numeroDocumento.trim(),
        denominacion: manual.denominacion.trim(),
        direccion: manual.direccion,
      },
    })

    if (!respuesta.ok || respuesta.cliente === undefined) {
      setMensaje(respuesta.error?.mensaje ?? 'No se pudo guardar el cliente.')
      setFase('error')
      return
    }

    onClienteCreadoEnIndice({
      numeroDocumento: respuesta.cliente.numeroDocumento,
      denominacion: respuesta.cliente.denominacion,
    })
    onClienteElegido({
      tipoDocumento: manual.tipoDocumento,
      numeroDocumento: respuesta.cliente.numeroDocumento,
      denominacion: respuesta.cliente.denominacion,
      direccion: manual.direccion,
    })
    cerrar()
  }

  return (
    <Modal
      abierta={abierta}
      alCambiar={(abiertaAhora) => {
        if (!abiertaAhora) cerrar()
      }}
      titulo="Buscar o Agregar cliente"
      descripcion={
        modoDocumento === 'factura'
          ? 'Factura: solo clientes con RUC. Busca o completa los datos a mano.'
          : modoDocumento === 'boleta'
            ? 'Boleta: solo clientes con DNI. Busca o completa los datos a mano.'
            : 'Busca por RUC, DNI o razón social. Usa un resultado o edítalo antes de continuar.'
      }
      pie={
        <>
          <Boton variante="discreto" onClick={cerrar}>
            Cancelar
          </Boton>
          {fase === 'buscar' || fase === 'error' ? (
            <Boton variante="principal" onClick={() => void buscar()}>
              Buscar
            </Boton>
          ) : null}
          {fase === 'revision' ? (
            <Boton variante="principal" onClick={() => void confirmarRevision()}>
              Confirmar y usar
            </Boton>
          ) : null}
          {fase === 'manual' ? (
            <Boton variante="principal" onClick={() => void confirmarManual()}>
              Guardar y usar
            </Boton>
          ) : null}
          {fase === 'coincidencias' ? (
            <Boton variante="secundario" onClick={() => setFase('buscar')}>
              Otra búsqueda
            </Boton>
          ) : null}
          {fase === 'manual' && editandoExistente ? (
            <Boton
              variante="secundario"
              onClick={() => {
                setEditandoExistente(false)
                setFase('coincidencias')
              }}
            >
              Volver a resultados
            </Boton>
          ) : null}
        </>
      }
    >
      {(fase === 'buscar' || fase === 'error') && (
        <div className="flex flex-col gap-3">
          <div>
            <Etiqueta htmlFor="cliente-consulta">RUC, DNI o razón social</Etiqueta>
            <Campo
              id="cliente-consulta"
              className="mt-1"
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault()
                  void buscar()
                }
              }}
            />
          </div>
          {mensaje ? (
            <p className="text-cuerpo text-aviso" role="status">
              {mensaje}
            </p>
          ) : null}
        </div>
      )}

      {fase === 'coincidencias' && (
        <div className="flex flex-col gap-3">
          {mensaje ? (
            <p className="text-cuerpo text-aviso" role="status">
              {mensaje}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {coincidencias.map((cada) => {
              const compatible = clienteCompatibleConModo(
                cada.numeroDocumento,
                modoDocumento,
              )
              const motivo = compatible
                ? undefined
                : mensajeIncompatibilidadCliente(
                    cada.numeroDocumento,
                    modoDocumento,
                  )
              return (
                <li
                  key={cada.numeroDocumento}
                  className="flex items-stretch gap-2 rounded-2xl border border-borde px-3 py-2"
                >
                  <div className="min-w-0 flex-1 py-1">
                    <span className="block truncate text-cuerpo font-bold text-tinta">
                      {cada.denominacion}
                    </span>
                    <span className="font-mono text-etiqueta text-desvaida">
                      {cada.numeroDocumento}
                    </span>
                    {!compatible ? (
                      <span className="mt-0.5 block text-etiqueta text-aviso">
                        {motivo}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Boton
                      variante="principal"
                      className="px-4"
                      disabled={!compatible}
                      title={motivo}
                      onClick={() => void usarExistente(cada)}
                    >
                      Usar
                    </Boton>
                    <button
                      type="button"
                      className={[
                        'inline-flex size-11 shrink-0 items-center justify-center rounded-full border',
                        'border-borde bg-papel text-tinta transition-colors hover:bg-mesa',
                        'focus-visible:outline-none focus-visible:border-tinta',
                      ].join(' ')}
                      title="Editar cliente"
                      aria-label={`Editar ${cada.denominacion}`}
                      onClick={() => void editarExistente(cada)}
                    >
                      <Pencil className="size-5" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {fase === 'revision' && revision !== null && (
        <div className="flex flex-col gap-3">
          {mensaje ? (
            <p className="text-cuerpo text-aviso" role="status">
              {mensaje}
            </p>
          ) : null}
          <RevisionDeContribuyente datos={revision} />
        </div>
      )}

      {fase === 'manual' && (
        <div className="flex flex-col gap-3">
          {mensaje ? (
            <p className="text-cuerpo text-aviso" role="status">
              {mensaje}
            </p>
          ) : null}
          <FormularioManualDeCliente
            valor={manual}
            onCambiar={setManual}
            modo={editandoExistente ? 'edicion' : 'alta'}
            documentoBloqueado={editandoExistente}
            tiposPermitidos={tiposPermitidos}
          />
        </div>
      )}

      {fase === 'guardando' && (
        <p className="text-cuerpo text-desvaida">Un momento…</p>
      )}
    </Modal>
  )
}
