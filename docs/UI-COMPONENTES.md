# Índice de componentes UI

Antes de crear un control, busca aquí. Si ya existe, **reutilízalo**. Este
archivo es el inventario de superficies SuitPay (Soft-Pill), no un design
system genérico.

Convención: primitivas en `src/ui/componentes/primitivas.tsx`; el resto, un
archivo por componente en `src/ui/componentes/`. Features (`src/features/`)
solo cuando el control es de un flujo, no del sistema.

---

## Primitivas

| Componente   | Archivo          | Cuándo usarlo                                                                                                                                                  |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Boton`      | `primitivas.tsx` | Toda acción con texto. Variantes: `principal` · `secundario` · `peligro` · `discreto`. Cápsula con borde siempre visible, alto ≥ 44 px. No cubre icon buttons. |
| `Campo`      | `primitivas.tsx` | Texto / número. Variantes `formulario` y `en-linea`; alineación semántica con `alineacion` o `numerico`.                                                       |
| `CampoArea`  | `primitivas.tsx` | Mismo aspecto que `Campo`, en `<textarea>`. Para nombres que deben verse completos (columna Descripción).                                                      |
| `Etiqueta`   | `primitivas.tsx` | Label mono uppercase de un campo. No la uses como título de sección.                                                                                           |
| `Casilla`    | `primitivas.tsx` | Checkbox cápsula (Radix).                                                                                                                                      |
| `Regla`      | `primitivas.tsx` | Separador 1 px (`border`).                                                                                                                                     |
| `Distintivo` | `primitivas.tsx` | Badge cápsula. Tonos: `aviso` · `sello` · `desvaida`. Nunca verde.                                                                                             |

---

## Navegación y shell

| Componente             | Archivo                                        | Cuándo usarlo                                                                                                            |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `BarraLateral`         | `BarraLateral.tsx`                             | Nav de la app. Marca arriba, perfil + logout al pie. Móvil: popover.                                                     |
| `MarcaSuitPay`         | `MarcaSuitPay.tsx`                             | Wordmark. Solo en sidebar / acceso.                                                                                      |
| `MigasDePan`           | `MigasDePan.tsx`                               | Jerarquía. En admin viven en el **layout**, no en cada página. Hermanas = `select` (`features/administracion/migas.ts`). |
| `CabeceraAdmin`        | `features/administracion/cabecera-admin.tsx`   | H1 accesible (sr-only). Descripción opcional; no la pongas si el cuerpo ya lo dice.                                      |
| `EncabezadoMigasAdmin` | `features/administracion/encabezado-migas.tsx` | Cabecera del layout admin.                                                                                               |
| `PestanasMostrador`    | `PestanasMostrador.tsx`                        | Tabs Pedido / Cotizaciones / Vecinos / Lista.                                                                            |
| `Tarjeta`              | `Tarjeta.tsx`                                  | Card de hub: título → icono grande → descripción. Con `to` es un `Link`. Grid: `repeat(auto-fit, minmax(16rem, 1fr))`.   |

---

## Mostrador

| Componente          | Archivo                 | Cuándo usarlo                                                                                                                     |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Entrada`           | `Entrada.tsx`           | Combobox de productos (escribir / voz / foto).                                                                                    |
| `LineaPedido`       | `LineaPedido.tsx`       | Fila del pedido: qty, precio, quitar. Producto ya presente: shimmer + `scrollIntoView` nearest. Producto nuevo: foco en cantidad. |
| `CabeceraDocumento` | `CabeceraDocumento.tsx` | Tipo, serie, cliente. Incluye modos UX «Bol + Guía R» / «Fact + Guía R» (no son tipos fiscales). |
| `PieTotal`          | `PieTotal.tsx`          | Total + emitir, anclado al pie.                                                                                                   |
| `Selector`          | `Selector.tsx`          | Select personalizado Soft-Pill (Radix): trigger, listbox en portal, teclado y foco gestionados. No uses `<select>` nativo.        |
| Facetas de catálogo | `grilla-revision.tsx` | Marca / categoría en **administración** (importación y lista maestra). No en el mostrador. |
| `EtiquetaSinValor`  | `EtiquetaSinValor.tsx`  | «SIN VALOR TRIBUTARIO». Recibe el **tipo**, no un booleano.                                                                       |
| `Sello`             | `Sello.tsx`             | Violeta sobre lo ya emitido (REGISTRADO / ACEPTADO). Nunca en el pedido en curso.                                                 |
| `RevisionCaptura`   | `RevisionCaptura.tsx`   | Contraste original vs propuesta (voz / foto).                                                                                     |

El mostrador (`src/routes/index.tsx`) ocupa `h-full overflow-hidden`. Cada
pestaña entra en `CuerpoPestana`: Pedido, Vecinos y Lista recortan el slot
(`overflow-hidden`) y el scroll vive **solo** en la lista o tabla
(`min-h-0 flex-1 overflow-y-auto`). Cotizaciones usa el modo `pagina`: el
panel entero es el scrollport, para que al desplegar Cotizar (zona de carga)
el contenido no quede recortado. No añadas `min-h-full` ni un segundo
`overflow-auto` en el `main`: eso produce desbordamiento anidado y un hueco
bajo el pie.

Si el combobox elige un producto **ya** en el pedido: toast + shimmer **solo
en el texto** (`t-shimmer`) y un anillo de resalte en la fila
(`t-resalte-fila`: outline interior sello, sin mover el layout). Ambos
duran los tres barridos y se retiran juntos. Reduced motion deja texto y
anillo en sello un instante. `scrollIntoView({ block: 'nearest' })` si la
fila está fuera del contenedor. Si es **nuevo**: foco y selección en
Cantidad. No pongas el shimmer en la fila ni en un overlay.

---

## Botones con texto

Todos los botones con texto usan `Boton`. Cambiar
`ESTILOS_DE_BOTON` en `primitivas.tsx` actualiza cada uso del repositorio: los
agentes no deben reconstruir bordes, hover, foco, pulsación ni disabled en cada
feature.

Los cuatro tipos permitidos —sin incluir icon buttons— son:

| Variante     | Uso concreto                                                                                                                                  | Apariencia                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `principal`  | Acción que completa el objetivo de la región: Publicar, Guardar, Emitir, Crear. Normalmente una por grupo.                                    | Fondo tinta, borde tinta.                    |
| `secundario` | Acción normal que acompaña a la principal: Cambiar, Cancelar, Seleccionar. Es la variante por defecto.                                        | Fondo papel, borde sutil.                    |
| `peligro`    | Acción destructiva o de alto riesgo: Quitar, Desactivar, Anular.                                                                              | Texto y borde de aviso; se rellena al hover. |
| `discreto`   | Acción de baja prioridad que todavía debe reconocerse como botón: cerrar una ayuda o retirar un archivo sin competir con la acción principal. | Fondo papel, borde sutil y texto desvaído.   |

El tamaño es independiente de la variante: `tamano="normal"` es el predeterminado
y `tamano="grande"` se reserva para el CTA persistente del pie (`Emitir` /
`Guardar`). Ambos heredan la apariencia de `principal`.

Reglas:

- El borde existe también en reposo; nunca aparece recién en hover.
- Hover eleva 2 px; press baja 1 px. Foco usa borde tinta y anillo suave.
- Disabled conserva forma y borde, elimina elevación y no responde al movimiento.
- `prefers-reduced-motion: reduce` elimina desplazamientos y transiciones.
- `className` solo ajusta layout (`w-full`, `shrink-0`, etc.); no redefine la
  variante localmente.
- Los botones que solo contienen un icono son controles distintos y quedan fuera
  de estas cuatro variantes.

---

## Campos de texto y edición en línea

Para campos estándar o editables en línea, reutiliza `Campo`; no reconstruyas
fondo, borde, foco o estados dentro de una tabla. Sus dos variantes responden a
contextos distintos:

| Variante     | Uso                                                                         | Apariencia                                                                                                             |
| ------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `formulario` | Formularios, filtros y datos que se completan como una tarea independiente. | Cápsula blanca, borde visible y sombra mínima.                                                                         |
| `en-linea`   | Valores editables dentro de filas del pedido o de una grilla.               | Rectángulo suave `rounded-xl`, fondo `mesa` y borde transparente; evita que cada celda parezca un botón o una burbuja. |

La variante `en-linea` conserva 44 px de alto mínimo. En descripciones largas
de la grilla de catálogo usa `CampoArea`: envuelve el texto y crece. Un
`<input>` no parte líneas. En reposo el fondo suave permite
reconocer que el dato es editable sin llenar la tabla de contornos. Hover aclara
la superficie y revela el borde; el foco añade borde tinta, anillo y sombra
suave. `invalido` combina fondo de aviso y borde de aviso, por lo que el error no
depende solo del color del texto. Todo cambio usa `duration-rapida` y
`ease-salida`; reduced motion elimina la transición.

Usa `superficie="mesa"` (predeterminada) dentro de filas blancas y
`superficie="papel"` cuando la fila ya vive sobre `mesa`, como en el pedido. La
superficie debe contrastar con su contexto; no elijas una globalmente para todas
las tablas.

La alineación comunica el tipo de dato:

- texto variable (`descripción`, `marca`, códigos largos): izquierda;
- valor categórico muy corto (`unidad`): centro;
- cantidades, precios e importes comparables: derecha con `numerico`, fuente
  monoespaciada y cifras tabulares. No centres precios aunque sean cortos: la
  columna debe poder compararse por magnitud.

```tsx
<Campo
  variante="en-linea"
  numerico
  value={precio}
  aria-label={`Precio de ${producto}`}
/>
```

Usa `alineacion="centro"` solo para datos cortos y homogéneos. En grillas sin
`label` visible, cada campo necesita un nombre accesible específico mediante
`aria-label`. `className` puede ajustar tipografía o casing, pero no recrear la
superficie interactiva.

---

## Selector personalizado

`Selector` reemplaza todos los `<select>` nativos. Está construido con
`@radix-ui/react-select`; por eso el trigger y el dropdown conservan semántica de
combobox/listbox, navegación por flechas, búsqueda por escritura, foco,
selección con Enter/Espacio y cierre con Escape.

```tsx
<Selector
  etiqueta="Marca"
  disposicion="columna"
  valor={marca}
  onCambiar={setMarca}
  opciones={[
    { valor: '', etiqueta: 'Todas' },
    { valor: 'ACME', etiqueta: 'ACME' },
  ]}
/>
```

| Prop                    | Uso                                                        |
| ----------------------- | ---------------------------------------------------------- |
| `etiqueta`              | Nombre accesible obligatorio.                              |
| `ocultarEtiqueta`       | Oculta el label visual, pero conserva `aria-label`.        |
| `disposicion`           | `fila` por defecto; `columna` para formularios.            |
| `variante="campo"`      | Control estándar, ancho completo.                          |
| `variante="compacto"`   | Barras densas y pie del mostrador.                         |
| `variante="miga"`       | Navegación entre páginas hermanas; no usar en formularios. |
| `opciones`              | `{ valor, etiqueta, deshabilitada? }[]`.                   |
| `disabled` / `required` | Estados gestionados por la primitiva.                      |

El dropdown vive en un portal, iguala como mínimo el ancho del trigger, limita su
altura al espacio disponible y permite scroll. La opción activa combina fondo,
peso e icono de check: nunca depende solo del color. La entrada y salida usan
los tokens `duration-media`, `duration-rapida` y `ease-salida`; reduced motion
desactiva la animación.

No uses:

- `<select>` nativo ni `appearance: base-select`;
- un popover manual para simular selección;
- clases locales para volver a diseñar trigger u opciones;
- una lista de opciones sin `etiqueta` legible.

---

## Carga y revisión

| Componente       | Archivo                                 | Cuándo usarlo                                                                                                                                          |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ZonaDeCarga`    | `ZonaDeCarga.tsx`                       | Drop zone de un archivo (JSON / PDF). Título visible + file picker oculto. Slot `nota` para un callout.                                                |
| `Nota`           | `Nota.tsx`                              | Callout como papeletas de origen (formato + escritorio), pensado para vivir _dentro_ de una drop zone. No es caja de info ni toast.                    |
| `GrillaRevision` | `features/catalogo/grilla-revision.tsx` | Lista maestra y revisión de lote (`modo`). Facetas, categorías, baja lógica (`activo: false`) y tacho (borrado de la lista; persiste al Guardar). IconButton de cantidad orientativa en maestro; el panel vive fuera de la fila y la página hace `scrollIntoView` al abrirlo. Virtualizada con overscan. |
| `PanelCantidad`  | `features/inventario/panel-cantidad.tsx` | Popover perezoso (`getDoc` al abrir). Cifra orientativa; jefe lee, admin escribe. Nunca «stock real». |

---

## Superficies y estado

| Componente         | Archivo                            | Cuándo usarlo                                                   |
| ------------------ | ---------------------------------- | --------------------------------------------------------------- |
| `Modal`            | `Modal.tsx`                        | `<dialog showModal()>`. Flujos que exigen foco atrapado.        |
| `PapeletaContexto` | `PapeletaContexto.tsx`             | Alias histórico de `Modal`. Los flujos nuevos importan `Modal`. |
| `BandaDegradacion` | `BandaDegradacion.tsx`             | Aviso persistente cuando un servicio cae. No es un toast.       |
| `GuardaSesion`     | `features/sesion/GuardaSesion.tsx` | Protege rutas por rol.                                          |

---

## Retroalimentación

| Componente           | Archivo                              | Cuándo usarlo                                                                      |
| -------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `CapaDeToasts`       | `CapaDeToasts.tsx`                   | Host en **top layer** (Popover API) para que el toast no quede detrás de un modal. |
| `usarNotificaciones` | `features/notificaciones/almacen.ts` | Puerta SuitPay → Sileo. Preferida frente a `sileo.*`.                              |

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

;<CapaDeToasts>
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

| Prop             | Valor en SuitPay                                       |
| ---------------- | ------------------------------------------------------ |
| `position`       | `"top-right"`                                          |
| `theme`          | `"dark"`                                               |
| `options.fill`   | `"#171717"` (fondo SVG oscuro)                         |
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

| Campo SuitPay   | Sileo                                      |
| --------------- | ------------------------------------------ |
| `tono: 'exito'` | `sileo.success` (verde)                    |
| `tono: 'error'` | `sileo.error` (rojo)                       |
| `tono: 'info'`  | `sileo.info` (azul)                        |
| `titulo`        | `title` (si falta → Éxito / Error / Info)  |
| `mensaje`       | `description`                              |
| `duracionMs`    | `duration` (`0` → `null`, sin auto-cierre) |

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
