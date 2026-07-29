import { createFileRoute, Link } from '@tanstack/react-router'

/**
 * Inicio de administración: hub de funciones (catálogo, series, …).
 * El diseño se irá puliendo; por ahora solo agrupa entradas.
 */

export const Route = createFileRoute('/administracion/')({
  component: InicioAdministracion,
})

function InicioAdministracion() {
  return (
    <div className="flex min-h-full flex-col px-6 py-8">
      <h1 className="text-cabecera font-bold text-tinta">Inicio</h1>
      <p className="mt-2 max-w-xl text-cuerpo text-desvaida">
        Administración del local: catálogo, series, umbral y usuarios.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        <li>
          <Link
            to="/administracion/catalogo"
            className="block rounded-3xl border border-borde bg-papel p-6 shadow-sm transition hover:border-marca"
          >
            <p className="font-mono text-etiqueta uppercase text-desvaida">
              Catálogo
            </p>
            <p className="mt-2 text-cuerpo font-bold text-tinta">
              Importar productos desde el JSON de la tienda
            </p>
          </Link>
        </li>
        <li className="rounded-3xl border border-borde bg-papel p-6 shadow-sm opacity-60">
          <p className="font-mono text-etiqueta uppercase text-desvaida">
            Próximamente
          </p>
          <p className="mt-2 text-cuerpo text-tinta">
            Series, establecimientos, umbral de identificación y usuarios.
          </p>
        </li>
      </ul>
    </div>
  )
}
