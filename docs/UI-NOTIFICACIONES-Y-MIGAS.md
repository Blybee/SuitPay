# UI: notificaciones (Sileo) y migas de pan

## Toasts con Sileo

SuitPay usa [`sileo`](https://sileo.aaryan.design/docs) para los toasts: animación gooey/spring, estados semánticos y posición fija.

### Montaje

En `src/routes/__root.tsx` (una sola vez), dentro de `CapaDeToasts` para que
los toasts vivan en la **top layer** (Popover API) y no queden detrás del
backdrop de un `<dialog showModal()>`:

```tsx
import { Toaster } from 'sileo'
import { CapaDeToasts } from '../ui/componentes/CapaDeToasts.tsx'

<CapaDeToasts>
  <Toaster
    position="top-right"
    theme="dark"
    options={{
      fill: '#171717',
      styles: {
        title: 'text-white!',
        description: 'text-white/75!',
        badge: 'bg-white/10!',
        button: 'bg-white/10! hover:bg-white/15!',
      },
    }}
  />
</CapaDeToasts>
```

Estilos globales: `@import 'sileo/styles.css'` en `src/styles.css`.

| Prop | Valor en SuitPay |
|------|------------------|
| `position` | `"top-right"` |
| `theme` | `"dark"` |
| `options.fill` | `"#171717"` (fondo SVG oscuro) |
| `options.styles` | Título/descripción en blanco (contraste sobre el fill) |

Sin `fill` oscuro, Sileo deja el fondo en blanco aunque `theme` sea `"dark"`.

### API SuitPay (preferida)

No llames `sileo.*` desde pantallas. Usa la puerta del proyecto para mantener vocabulario y duraciones:

```ts
import { usarNotificaciones } from '../features/notificaciones/almacen.ts'
// o: import { mostrarNotificacion } from '…'

usarNotificaciones.getState().mostrar({
  tono: 'error',
  mensaje: 'No se pudo crear la serie.',
})

usarNotificaciones.getState().mostrar({
  tono: 'exito',
  titulo: 'Catálogo publicado',
  mensaje: 'La versión 12 ya está disponible en los puestos.',
})
```

Archivo: `src/features/notificaciones/almacen.ts`.

| Campo SuitPay | Sileo |
|---------------|--------|
| `tono: 'exito'` | `sileo.success` (verde) |
| `tono: 'error'` | `sileo.error` (rojo) |
| `tono: 'info'` | `sileo.info` (azul) |
| `titulo` | `title` (si falta → Éxito / Error / Info) |
| `mensaje` | `description` |
| `duracionMs` | `duration` (`0` → `null`, sin auto-cierre) |

Duraciones por omisión: éxito 3,5 s · info 4,5 s · error 6 s.

También: `descartar(id)`, `limpiar()` → `sileo.dismiss` / `sileo.clear`.

### API Sileo (referencia)

Para casos especiales (promesa, botón de acción) puedes usar `sileo` directo:

```ts
import { sileo } from 'sileo'

sileo.success({ title: '…', description: '…' })
sileo.error({ title: '…', description: '…' })
sileo.warning({ title: '…', description: '…' })
sileo.info({ title: '…', description: '…' })
sileo.action({ title: '…', description: '…', button: { title: '…', onClick: () => {} } })
sileo.promise(promesa, { loading: {…}, success: {…}, error: {…} })
sileo.dismiss(id)
sileo.clear() // o sileo.clear('top-right')
```

Selectores útiles para estilos: `[data-sileo-title]`, `[data-sileo-description]`, `[data-sileo-badge]`, `[data-sileo-button]`.

### Banco de prueba

`/administracion/` → sección «Prueba de toasts» (Éxito / Error / Info / Con título).

### Cuándo usarlo

Cualquier éxito, error o aviso que el usuario deba ver aunque esté al final del scroll. **No** uses un `<p role="alert">` fijo arriba de la página para eso.

Nota Soft-Pill: el resto de la UI sigue sin verde de semáforo; el toast de éxito de Sileo sí usa verde porque es el contrato del componente.

---

## MigasDePan (breadcrumbs)

**Cuándo usarla:** pantallas internas con jerarquía (p. ej. Administración → Series).

**Dónde (admin):** en el **encabezado del layout**, no dentro del contenedor de contenido de cada página.

- Layout: `src/routes/administracion/route.tsx`
- Encabezado: `src/features/administracion/encabezado-migas.tsx`
- Componente: `src/ui/componentes/MigasDePan.tsx`
- Intro de página: `CabeceraAdmin`

**Hermanas:** si hay varias páginas en la misma capa, esa migaja es un **select** (`src/features/administracion/migas.ts`).
