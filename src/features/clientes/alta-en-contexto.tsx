import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import type { ClienteEnIndice } from '../../infra/local/catalogo.ts'
import type { ClienteDelPedido } from '../pedido/almacen.ts'
import { buscarCoincidenciasDeCliente } from './coincidencias.ts'
import {
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

type Fase =
  | 'buscar'
  | 'coincidencias'
  | 'revision'
  | 'manual'
  | 'guardando'
  | 'error'

/**
 * Alta / elección de cliente sin abandonar la venta (FR-022–FR-026).
 */
export function AltaClienteEnContexto({
  abierta,
  onCerrar,
  indiceDeClientes,
  onClienteElegido,
  onClienteCreadoEnIndice,
  consultaInicial = null,
  arranqueManual = null,
}: {
  readonly abierta: boolean
  readonly onCerrar: () => void
  readonly indiceDeClientes: readonly ClienteEnIndice[]
  readonly onClienteElegido: (cliente: ClienteDelPedido) => void
  readonly onClienteCreadoEnIndice: (entrada: ClienteEnIndice) => void
  /** Si llega al abrir (p. ej. desde el RUC/DNI inline), se busca sola. */
  readonly consultaInicial?: string | null
  /**
   * Abre directo en alta manual (p. ej. padrón caído tras morph Agregar).
   * Evita reconsultar un host que ya falló.
   */
  readonly arranqueManual?: ArranqueManualDeCliente | null
}) {
  const [fase, setFase] = useState<Fase>('buscar')
  const [consulta, setConsulta] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<'DNI' | 'RUC'>('RUC')
  const [coincidencias, setCoincidencias] = useState<readonly ClienteEnIndice[]>(
    [],
  )
  const [revision, setRevision] = useState<DatosDeContribuyenteParaRevision | null>(
    null,
  )
  const [manual, setManual] = useState<DatosManualesDeCliente>({
    tipoDocumento: 'RUC',
    numeroDocumento: '',
    denominacion: '',
  })
  const [mensaje, setMensaje] = useState<string | null>(null)
  const consultaAutoProcesada = useRef<string | null>(null)
  const manualAutoProcesado = useRef<string | null>(null)

  function reiniciar() {
    setFase('buscar')
    setConsulta('')
    setCoincidencias([])
    setRevision(null)
    setMensaje(null)
    setManual({ tipoDocumento: 'RUC', numeroDocumento: '', denominacion: '' })
    consultaAutoProcesada.current = null
    manualAutoProcesado.current = null
  }

  function cerrar() {
    reiniciar()
    onCerrar()
  }

  function elegirExistente(entrada: ClienteEnIndice) {
    onClienteElegido({
      tipoDocumento: tipoDocumento,
      numeroDocumento: entrada.numeroDocumento,
      denominacion: entrada.denominacion,
    })
    cerrar()
  }

  async function buscar(consultaForzada?: string) {
    setMensaje(null)
    const texto = (consultaForzada ?? consulta).trim()
    if (texto.length === 0) return
    if (consultaForzada !== undefined) setConsulta(texto)

    const locales = buscarCoincidenciasDeCliente(texto, indiceDeClientes)
    if (locales.length > 0 && !/^\d{8,11}$/.test(texto)) {
      setCoincidencias(locales)
      setFase('coincidencias')
      return
    }

    if (/^\d{8,11}$/.test(texto)) {
      const tipo: 'DNI' | 'RUC' = texto.length === 11 ? 'RUC' : 'DNI'
      setTipoDocumento(tipo)

      const existente = await leerClientePorDocumento(texto)
      if (existente !== null) {
        onClienteElegido({
          tipoDocumento: existente.tipoDocumento,
          numeroDocumento: existente.numeroDocumento,
          denominacion: existente.denominacion,
          direccion: existente.direccion,
        })
        cerrar()
        return
      }

      setFase('guardando')
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
        return
      }
    }

    if (locales.length > 0) {
      setCoincidencias(locales)
      setFase('coincidencias')
      return
    }

    setMensaje('Escribe un RUC/DNI o parte de la razón social.')
    setFase('error')
  }

  useEffect(() => {
    if (!abierta) {
      consultaAutoProcesada.current = null
      manualAutoProcesado.current = null
      return
    }

    if (arranqueManual !== null && arranqueManual !== undefined) {
      const clave = `${arranqueManual.tipoDocumento}:${arranqueManual.numeroDocumento}`
      if (manualAutoProcesado.current === clave) return
      manualAutoProcesado.current = clave
      setTipoDocumento(arranqueManual.tipoDocumento)
      setConsulta(arranqueManual.numeroDocumento)
      setManual({
        tipoDocumento: arranqueManual.tipoDocumento,
        numeroDocumento: arranqueManual.numeroDocumento,
        denominacion: '',
      })
      setMensaje(arranqueManual.mensaje ?? mensajeDeConsultaIndisponible())
      setFase('manual')
      return
    }

    const inicial = consultaInicial?.trim() ?? ''
    if (inicial.length === 0) return
    if (consultaAutoProcesada.current === inicial) return
    consultaAutoProcesada.current = inicial
    void buscar(inicial)
  }, [abierta, consultaInicial, arranqueManual]) // buscar es estable respecto a la consulta forzada

  async function confirmarRevision() {
    if (revision === null) return
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
    setFase('guardando')
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
      titulo="Agregar cliente"
      descripcion="Cliente nuevo: busca por razón social o completa los datos a mano."
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
        <ul className="flex flex-col gap-2">
          {coincidencias.map((cada) => (
            <li key={cada.numeroDocumento}>
              <button
                type="button"
                className="w-full rounded-2xl border border-borde px-4 py-3 text-left hover:border-tinta focus-visible:outline-none focus-visible:border-tinta"
                onClick={() => elegirExistente(cada)}
              >
                <span className="block text-cuerpo font-bold text-tinta">
                  {cada.denominacion}
                </span>
                <span className="font-mono text-etiqueta text-desvaida">
                  {cada.numeroDocumento}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {fase === 'revision' && revision !== null && (
        <RevisionDeContribuyente datos={revision} />
      )}

      {fase === 'manual' && (
        <div className="flex flex-col gap-3">
          {mensaje ? (
            <p className="text-cuerpo text-aviso" role="status">
              {mensaje}
            </p>
          ) : null}
          <FormularioManualDeCliente valor={manual} onCambiar={setManual} />
        </div>
      )}

      {fase === 'guardando' && (
        <p className="text-cuerpo text-desvaida">Un momento…</p>
      )}
    </Modal>
  )
}
