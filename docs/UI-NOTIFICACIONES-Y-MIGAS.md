# UI: notificaciones isla y migas de pan

## NotificacionIsla (toast Dynamic Island)

**Cuándo usarla:** cualquier éxito, error o aviso informativo que el usuario deba ver aunque esté al final del scroll (admin, formularios largos, acciones async). **No** uses un `<p role="alert">` fijo arriba de la página para eso.

**Dónde vive:**

- Store: `src/features/notificaciones/almacen.ts` → `usarNotificaciones().mostrar({ tono, titulo?, mensaje })`
- Host global: `src/ui/componentes/NotificacionIsla.tsx` montado en `__root.tsx`
- Estilos: cápsula superior centrada, morph (escala/opacidad), `popover="manual"` cuando el navegador lo soporta

**Tonos:** `exito` | `error` | `info`

**Ejemplo:**

```ts
import { usarNotificaciones } from '../features/notificaciones/almacen.ts'

usarNotificaciones.getState().mostrar({
  tono: 'error',
  mensaje: 'No se pudo crear la serie.',
})
```

Auto-cierre ~4s (error un poco más). Botón cerrar explícito. Respeta `prefers-reduced-motion`.

---

## MigasDePan (breadcrumbs)

**Cuándo usarla:** pantallas internas con jerarquía (p. ej. Administración → Series). Orienta al usuario y permite volver.

**Dónde (admin):** en el **encabezado del layout**, no dentro del contenedor de contenido (`max-w-*` / `px-6` de cada página). Así no saltan de ancho entre Series y Catálogo.

- Layout: `src/routes/administracion/route.tsx`
- Encabezado: `src/features/administracion/encabezado-migas.tsx`
- Componente: `src/ui/componentes/MigasDePan.tsx`
- Intro de página (solo descripción + H1 `sr-only`): `CabeceraAdmin`

**Regla de capa con hermanas:** si en el mismo nivel hay varias páginas (Catálogo / Series / Usuarios / Parámetros), esa migaja MUST ser un **select** (chevron) para cambiar sin volver al hub.

Constante compartida de hermanas admin: `src/features/administracion/migas.ts`.

No montes `MigasDePan` otra vez dentro de `catalogo.tsx` / `series.tsx` / etc.
