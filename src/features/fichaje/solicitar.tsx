import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { ZONA_HORARIA } from '../../domain/anulacion/ventana.ts'
import { solicitarEntradaFn } from './fichaje.funciones.ts'
import './fichaje.css'

const CLAVE_NOMBRE = 'suitpay.fichaje.nombre'

function reloj(instante: Date): {
  horas: string
  minutos: string
  segundos: string
} {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante)
  const leer = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '00'
  return {
    horas: leer('hour'),
    minutos: leer('minute'),
    segundos: leer('second'),
  }
}

export function PaginaSolicitarEntrada() {
  const [ahora, setAhora] = useState(() => new Date())
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviada, setEnviada] = useState<'nueva' | 'repetida' | null>(null)
  const idNombre = useId()
  const idError = useId()
  const piezas = reloj(ahora)

  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_NOMBRE)
    if (guardado !== null && guardado.trim().length > 0) {
      setNombre(guardado)
    }
  }, [])

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setOcupado(true)
    try {
      const respuesta = await solicitarEntradaFn({ data: { nombre } })
      if (!respuesta.ok) {
        setError(
          respuesta.error?.mensaje ?? 'No se pudo enviar. Inténtalo de nuevo.',
        )
        return
      }
      window.localStorage.setItem(CLAVE_NOMBRE, nombre.trim())
      setEnviada(respuesta.repetida === true ? 'repetida' : 'nueva')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="fichaje fichaje-publica">
      <div className="wrap app">
        <header className="top">
          <div className="brand">
            <div className="logo">F·</div>
            <div>
              <h1>Fichaje</h1>
              <p className="tag">Entrada</p>
            </div>
          </div>
          <div className="clockbox">
            <div className="clock">
              {piezas.horas}
              <i>:</i>
              {piezas.minutos}
              <i>:</i>
              {piezas.segundos}
            </div>
          </div>
        </header>
        <main>
          {enviada !== null ? (
            <section className="panel confirmacion">
              <p className="kick">Solicitud</p>
              <h2>
                {enviada === 'repetida' ? 'Ya estaba enviada' : 'Enviada'}
              </h2>
              <p className="sub">
                {enviada === 'repetida'
                  ? 'Ya hay una solicitud tuya en espera. El jefe la confirma y esa hora será tu entrada.'
                  : 'El jefe tiene que aprobarla. La hora de entrada es la de esa aprobación, no la de este envío.'}
              </p>
              <div className="form-acts">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setEnviada(null)}
                >
                  Enviar otra
                </button>
              </div>
            </section>
          ) : (
            <form className="panel" onSubmit={(evento) => void enviar(evento)}>
              <div className="panel-h">
                <span>Nueva solicitud</span>
                <span>Entrada</span>
              </div>
              <div className="form-cuerpo">
                <div className="field">
                  <label htmlFor={idNombre}>Nombre completo</label>
                  <input
                    id={idNombre}
                    type="text"
                    name="nombre"
                    autoComplete="name"
                    enterKeyHint="send"
                    required
                    minLength={3}
                    maxLength={80}
                    value={nombre}
                    disabled={ocupado}
                    aria-invalid={error !== null}
                    aria-describedby={error !== null ? idError : undefined}
                    onChange={(evento) => setNombre(evento.target.value)}
                  />
                </div>
                {error !== null ? (
                  <p className="alerta" id={idError} role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="form-acts">
                  <button
                    type="submit"
                    className="btn primary"
                    aria-busy={ocupado}
                    disabled={ocupado}
                  >
                    Enviar solicitud
                  </button>
                </div>
              </div>
            </form>
          )}
          <section className="panel instrucciones" aria-label="Instrucciones">
            <div className="panel-h">
              <span>Cómo se cuenta</span>
              <span>Lun–Sáb</span>
            </div>
            <ol>
              <li>
                <span>Hora de entrada</span>
                <b className="ok">10:00</b>
              </li>
              <li>
                <span>Tolerancia</span>
                <b className="warn">10:15</b>
              </li>
              <li>
                <span>Tardanza</span>
                <b className="bad">+10:15</b>
              </li>
              <li>
                <span>3 = 1 falta</span>
                <b className="bad">DESCUENTO</b>
              </li>
            </ol>
          </section>
        </main>
      </div>
    </div>
  )
}
