import { createFileRoute } from '@tanstack/react-router'

/**
 * La hoja de trabajo: la pantalla de venta.
 *
 * Andamio por ahora. Lo que va aquí —el buscador arriba, los renglones del
 * pedido y el total al pie— se construye en la fase de la hoja de trabajo, ya con
 * el dominio y los almacenes en su sitio.
 */
export const Route = createFileRoute('/')({
  component: HojaDeTrabajo,
})

function HojaDeTrabajo() {
  return (
    <div className="p-6">
      <h1 className="text-cabecera font-bold">Mostrador</h1>
      <p className="mt-2 text-cuerpo text-desvaida">
        Los cimientos están puestos. La hoja de trabajo se construye a
        continuación.
      </p>
    </div>
  )
}
