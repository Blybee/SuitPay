import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Modal } from '../../ui/componentes/Modal.tsx'
import { Boton, Campo, Etiqueta } from '../../ui/componentes/primitivas.tsx'
import { Selector } from '../../ui/componentes/Selector.tsx'
import type { Cotizacion } from '../cotizaciones/tipos.ts'
import type { PropuestaCrearVecino } from '../comandos/crear-vecino.ts'
import { telefonoEsValido } from '../../domain/vecinos/telefono.ts'
import { eliminarCotizacionVecino, persistirDatosDeVecino } from './datos.ts'
import { usarNotificaciones } from '../notificaciones/almacen.ts'

type Vista = 'nuevo' | 'todos' | 'editar'

/**
 * Alta / edición / listado de vecinos. El comando `/crear vecino` sigue
 * existiendo; este modal cubre el mismo alta con teléfono y el directorio.
 */
export function ModalDeVecino({
  abierta,
  onCerrar,
  vecinos,
  creando,
  onCrear,
  onRefrescar,
}: {
  readonly abierta: boolean
  readonly onCerrar: () => void
  readonly vecinos: readonly Cotizacion[]
  readonly creando: boolean
  readonly onCrear: (propuesta: PropuestaCrearVecino) => void
  readonly onRefrescar: () => void
}) {
  const [vista, setVista] = useState<Vista>('nuevo')
  const [alias, setAlias] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<'DNI' | 'RUC'>('DNI')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [editando, setEditando] = useState<Cotizacion | null>(null)
  const [pendienteBorrar, setPendienteBorrar] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function resetearAlta(): void {
    setAlias('')
    setTipoDocumento('DNI')
    setNumeroDocumento('')
    setTelefono('')
  }

  function alCambiar(abiertaSiguiente: boolean): void {
    if (!abiertaSiguiente) {
      setVista('nuevo')
      resetearAlta()
      setEditando(null)
      setPendienteBorrar(null)
      onCerrar()
    }
  }

  const documentoOk =
    tipoDocumento === 'RUC'
      ? /^\d{11}$/.test(numeroDocumento)
      : /^\d{8}$/.test(numeroDocumento)
  const telefonoOk = telefono.trim() === '' || telefonoEsValido(telefono)
  const altaLista =
    alias.trim() !== '' && documentoOk && telefonoOk && !creando

  return (
    <Modal
      abierta={abierta}
      alCambiar={alCambiar}
      titulo={
        vista === 'todos'
          ? 'Vecinos registrados'
          : vista === 'editar'
            ? 'Editar vecino'
            : 'Nuevo vecino'
      }
      descripcion={
        vista === 'nuevo'
          ? 'Confirma para crear la cotización del vecino. Sin confirmar no se escribe nada.'
          : undefined
      }
      cabeceraExtra={
        <Boton
          variante="discreto"
          className="min-h-9 px-3 text-etiqueta"
          onClick={() => {
            setVista(vista === 'todos' ? 'nuevo' : 'todos')
            setEditando(null)
            setPendienteBorrar(null)
          }}
        >
          {vista === 'todos' ? 'Nuevo' : 'Ver todos'}
        </Boton>
      }
      pie={
        vista === 'nuevo' ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="secundario" disabled={creando} onClick={() => alCambiar(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="principal"
              disabled={!altaLista}
              onClick={() => {
                onCrear({
                  alias: alias.trim(),
                  numeroDocumento,
                  tipoDocumento,
                  ...(telefono.trim() !== '' ? { telefono: telefono.trim() } : {}),
                })
              }}
            >
              {creando ? 'Creando…' : 'Confirmar'}
            </Boton>
          </div>
        ) : vista === 'editar' && editando !== null ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Boton
              variante="secundario"
              disabled={guardando}
              onClick={() => {
                setVista('todos')
                setEditando(null)
              }}
            >
              Volver
            </Boton>
            <Boton
              variante="principal"
              disabled={guardando || alias.trim() === '' || !telefonoOk}
              onClick={() => {
                void (async () => {
                  setGuardando(true)
                  const resultado = await persistirDatosDeVecino({
                    cotizacionId: editando.id,
                    alias,
                    telefono,
                  })
                  setGuardando(false)
                  if (!resultado.ok) {
                    usarNotificaciones.getState().mostrar({
                      tono: 'error',
                      mensaje: resultado.mensaje ?? 'No se pudo guardar.',
                    })
                    return
                  }
                  onRefrescar()
                  setVista('todos')
                  setEditando(null)
                  usarNotificaciones.getState().mostrar({
                    tono: 'exito',
                    mensaje: 'Datos del vecino actualizados.',
                  })
                })()
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        ) : undefined
      }
    >
      {vista === 'nuevo' ? (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Etiqueta htmlFor="vecino-alias">Alias</Etiqueta>
            <Campo
              id="vecino-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Selector
            etiqueta="Documento"
            valor={tipoDocumento}
            onCambiar={(valor) => {
              setTipoDocumento(valor)
              setNumeroDocumento('')
            }}
            opciones={[
              { valor: 'DNI', etiqueta: 'DNI' },
              { valor: 'RUC', etiqueta: 'RUC' },
            ]}
          />
          <div>
            <Etiqueta htmlFor="vecino-doc">{tipoDocumento}</Etiqueta>
            <Campo
              id="vecino-doc"
              inputMode="numeric"
              value={numeroDocumento}
              onChange={(e) =>
                setNumeroDocumento(e.target.value.replace(/\D/g, ''))
              }
              maxLength={tipoDocumento === 'RUC' ? 11 : 8}
            />
          </div>
          <div>
            <Etiqueta htmlFor="vecino-tel">Teléfono</Etiqueta>
            <Campo
              id="vecino-tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="987654321"
            />
            {!telefonoOk ? (
              <p className="mt-1 text-cuerpo text-aviso">
                Usa un celular peruano de 9 dígitos.
              </p>
            ) : (
              <p className="mt-1 text-etiqueta text-desvaida">
                Opcional. Sirve para abrir el chat de WhatsApp al capturar la lista.
              </p>
            )}
          </div>
        </form>
      ) : null}

      {vista === 'editar' && editando !== null ? (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Etiqueta htmlFor="vecino-edit-alias">Alias</Etiqueta>
            <Campo
              id="vecino-edit-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>
          <div>
            <Etiqueta htmlFor="vecino-edit-tel">Teléfono</Etiqueta>
            <Campo
              id="vecino-edit-tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
            {!telefonoOk ? (
              <p className="mt-1 text-cuerpo text-aviso">
                Usa un celular peruano de 9 dígitos.
              </p>
            ) : null}
          </div>
          <p className="font-mono text-etiqueta text-desvaida">
            {editando.cliente?.denominacion ?? 'Sin cliente'} ·{' '}
            {editando.cliente?.numeroDocumento}
          </p>
        </form>
      ) : null}

      {vista === 'todos' ? (
        vecinos.length === 0 ? (
          <p className="text-cuerpo text-desvaida">No hay vecinos registrados.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {vecinos.map((cada) => (
              <li
                key={cada.id}
                className="flex items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-tinta">
                    {cada.aliasVecino ?? `H${cada.numero}`}
                  </p>
                  <p className="font-mono text-etiqueta text-desvaida">
                    {cada.telefonoVecino ?? 'Sin teléfono'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${cada.aliasVecino ?? cada.numero}`}
                    className="flex size-11 items-center justify-center rounded-full hover:bg-mesa"
                    onClick={() => {
                      setEditando(cada)
                      setAlias(cada.aliasVecino ?? '')
                      setTelefono(cada.telefonoVecino ?? '')
                      setVista('editar')
                    }}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  {pendienteBorrar === cada.id ? (
                    <Boton
                      variante="peligro"
                      className="min-h-11 px-3 text-etiqueta"
                      onClick={() => {
                        void (async () => {
                          const resultado = await eliminarCotizacionVecino(cada.id)
                          setPendienteBorrar(null)
                          if (!resultado.ok) {
                            usarNotificaciones.getState().mostrar({
                              tono: 'error',
                              mensaje:
                                resultado.mensaje ?? 'No se pudo eliminar.',
                            })
                            return
                          }
                          onRefrescar()
                        })()
                      }}
                    >
                      Confirmar
                    </Boton>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Eliminar ${cada.aliasVecino ?? cada.numero}`}
                      className="flex size-11 items-center justify-center rounded-full text-desvaida hover:bg-mesa hover:text-aviso"
                      onClick={() => setPendienteBorrar(cada.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </Modal>
  )
}
