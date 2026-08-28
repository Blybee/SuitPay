# Índice de componentes UI

Antes de crear un control, busca aquí. Si ya existe, **reutilízalo**. Este
archivo es el inventario de superficies SuitPay (Soft-Pill), no un design
system genérico.

Convención: primitivas en `src/ui/componentes/primitivas.tsx`; el resto, un
archivo por componente en `src/ui/componentes/`. Features (`src/features/`)
solo cuando el control es de un flujo, no del sistema.

---

## Primitivas

| Componente | Archivo | Cuándo usarlo |
|------------|---------|----------------|
| `Boton` | `primitivas.tsx` | Toda acción. Variantes: `principal` · `secundario` · `peligro` · `discreto`. Cápsula, alto ≥ 44 px. |
| `Campo` | `primitivas.tsx` | Texto / número. `invalido` pinta borde aviso; `numerico` alinea a la derecha en mono. |
| `Etiqueta` | `primitivas.tsx` | Label mono uppercase de un campo. No la uses como título de sección. |
| `Casilla` | `primitivas.tsx` | Checkbox cápsula (Radix). |
| `Regla` | `primitivas.tsx` | Separador 1 px (`border`). |
| `Distintivo` | `primitivas.tsx` | Badge cápsula. Tonos: `aviso` · `sello` · `desvaida`. Nunca verde. |

---

## Navegación y shell

| Componente | Archivo | Cuándo usarlo |
|------------|---------|----------------|
| `BarraLateral` | `BarraLateral.tsx` | Nav de la app. Marca arriba, perfil + logout al pie. Móvil: popover. |
| `MarcaSuitPay` | `MarcaSuitPay.tsx` | Wordmark. Solo en sidebar / acceso. |
| `MigasDePan` | `MigasDePan.tsx` | Jerarquía. En admin viven en el **layout**, no en cada página. Hermanas = `select` (`features/administracion/migas.ts`). |
| `CabeceraAdmin` | `features/administracion/cabecera-admin.tsx` | H1 accesible (sr-only). Descripción opcional; no la pongas si el cuerpo ya lo dice. |
| `EncabezadoMigasAdmin` | `features/administracion/encabezado-migas.tsx` | Cabecera del layout admin. |
| `PestanasMostrador` | `PestanasMostrador.tsx` | Tabs Pedido / Cotizaciones / Vecinos / Lista. |
| `Tarjeta` | `Tarjeta.tsx` | Card de hub: título → icono grande → descripción. Con `to` es un `Link`. Grid: `repeat(auto-fit, minmax(16rem, 1fr))`. |

---

## Mostrador

| Componente | Archivo | Cuándo usarlo |
|------------|---------|----------------|
| `Entrada` | `Entrada.tsx` | Combobox de productos (escribir / voz / foto). |
| `LineaPedido` | `LineaPedido.tsx` | Fila del pedido: qty, precio, quitar. |
| `CabeceraDocumento` | `CabeceraDocumento.tsx` | Tipo, serie, cliente. |
| `PieTotal` | `PieTotal.tsx` | Total + emitir, anclado al pie. |
| `Selector` | `Selector.tsx` | `<select>` Soft-Pill (`appearance: base-select`). |
| `FiltrosDeCatalogo` | `FiltrosDeCatalogo.tsx` | Facetas marca / categoría sobre el espejo local. |
| `EtiquetaSinValor` | `EtiquetaSinValor.tsx` | «SIN VALOR TRIBUTARIO». Recibe el **tipo**, no un booleano. |
| `Sello` | `Sello.tsx` | Violeta sobre lo ya emitido (REGISTRADO / ACEPTADO). Nunca en el pedido en curso. |
| `RevisionCaptura` | `RevisionCaptura.tsx` | Contraste original vs propuesta (voz / foto). |

---

## Carga y revisión

| Componente | Archivo | Cuándo usarlo |
|------------|---------|----------------|
| `ZonaDeCarga` | `ZonaDeCarga.tsx` | Drop zone de un archivo (JSON / PDF). Título visible + file picker oculto. Slot `nota` para un callout. |
| `Nota` | `Nota.tsx` | Callout como papeletas de origen (formato + escritorio), pensado para vivir *dentro* de una drop zone. No es caja de info ni toast. |
| `GrillaRevision` | `features/catalogo/grilla-revision.tsx` | Revisión virtualizada. Conflictos en la fila (callout plano + filtro «Con problemas»). El balance de la carga vive en su cabecera, no en cards aparte. |

---

## Superficies y estado

| Componente | Archivo | Cuándo usarlo |
|------------|---------|----------------|
| `Modal` | `Modal.tsx` | `<dialog showModal()>`. Flujos que exigen foco atrapado. |
| `PapeletaContexto` | `PapeletaContexto.tsx` | Alias histórico de `Modal`. Los flujos nuevos importan `Modal`. |
| `BandaDegradacion` | `BandaDegradacion.tsx` | Aviso persistente cuando un servicio cae. No es un toast. |
| `GuardaSesion` | `features/sesion/GuardaSesion.tsx` | Protege rutas por rol. |

---

## Retroalimentación

| Componente | Archivo | Cuándo usarlo |
|------------|---------|----------------|
| `CapaDeToasts` | `CapaDeToasts.tsx` | Host en **top layer** (Popover API) para que el toast no quede detrás de un modal. |
| `usarNotificaciones` | `features/notificaciones/almacen.ts` | Puerta SuitPay → Sileo. Preferida frente a `sileo.*`. |

Cualquier éxito, error o aviso que el usuario deba ver aunque esté al final
del scroll. **No** uses un `<p role="alert">` fijo arriba de la página.

---

## Toasts con Sileo

SuitPay usa [`sileo`](https://sileo.aaryan.design/docs) para los toasts:
animación gooey/spring, estados semánticos y posición fija.

### Montaje

En `src/routes/__root.tsx` (una sola vez), dentro de `CapaDeToasts`:

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

```ts
import { usarNotificaciones } from '../features/notificaciones/almacen.ts'

usarNotificaciones.getState().mostrar({
  tono: 'error',
  mensaje: 'No se pudo crear la serie.',
})
```

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

Para promesa o botón de acción puedes usar `sileo` directo:

```ts
import { sileo } from 'sileo'

sileo.action({ title: '…', description: '…', button: { title: '…', onClick: () => {} } })
sileo.promise(promesa, { loading: {…}, success: {…}, error: {…} })
```

Selectores: `[data-sileo-title]`, `[data-sileo-description]`, `[data-sileo-badge]`, `[data-sileo-button]`.

Banco de prueba: `/administracion/` → «Prueba de toasts».

Nota Soft-Pill: el resto de la UI sigue sin verde de semáforo; el toast de
éxito de Sileo sí usa verde porque es el contrato del componente.

---

## Migas de administración

**Dónde:** encabezado del layout, no dentro del contenedor de cada página.

- Layout: `src/routes/administracion/route.tsx`
- Encabezado: `src/features/administracion/encabezado-migas.tsx`
- Componente: `src/ui/componentes/MigasDePan.tsx`
- Intro: `CabeceraAdmin` (H1 sr-only)

Si hay varias páginas en la misma capa, esa migaja es un **select**
(`src/features/administracion/migas.ts`).
