# Diseño de la superficie — Mostrador asistido

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28  
**Enmienda**: 2026-07-29 (volcado 5 — Modern Soft-Pill, sidebar, tabs, full-bleed)  
**Modo de visitante**: Operate — el vendedor viene a completar una tarea, no a decidir ni a leer.  
**Sistema visual durable**: [`DESIGN.md`](../../DESIGN.md) · **Verdad de producto**: [`PRODUCT.md`](../../PRODUCT.md)

---

## Contrato de dirección

**THESIS** — Una herramienta de venta, no un comprobante. Shell con sidebar; el mostrador ocupa todo el ancho útil con tabs internos. Se escribe arriba, el pedido crece en el medio, el total espera abajo. Rechaza el tablero de métricas y rechaza hacer que la pantalla parezca el documento que emite.

**OWN-WORLD** — Modern Soft-Pill: superficies blancas sobre lienzo gris claro, controles en cápsula (`rounded-full`), paneles con radios amplios (`rounded-2xl` / `rounded-3xl`), bordes sutiles o ninguno, sombras naturales (`shadow-sm` / `shadow-md`). Tres tintas semánticas: negro dice qué hay, rojo qué no es definitivo, violeta de sello qué quedó validado. Atkinson Hyperlegible a gran tamaño; cifras tabulares.

**STORY** — El vendedor abre en el mostrador (tab Pedido, tipo Nota de Venta por defecto), teclea o dicta, ve la lista crecer mientras habla con el cliente, comprueba el total sin buscarlo y emite con una pulsación.

**FIRST VIEWPORT** — Sidebar a la izquierda (marca SuitPay arriba; Inicio y Configuración; perfil + logout al pie). A la derecha, el área de trabajo a todo el ancho: tabs Pedido | Cotizaciones | Vecinos | Lista; bajo el tab activo, entrada con foco; cabecera de documento; pedido denso; pie del total con EMITIR.

**FORM** — Soft-Pill de trabajo. Sustituye el contrato anterior (papel cálido / mesa kraft / radio cero / sin barra lateral) por enmienda del volcado 5. Se conserva la lección crítica: la UI no debe parecer un comprobante.

---

## Composición aprobada

### Obsoleta (2026-07-28)

Aprobada el 2026-07-28 sobre tres composiciones. **Queda inválida** tras el pivote Soft-Pill y el shell con sidebar. No implementar contra estos renders.

| Render | Aportaba (histórico) | Estado |
|--------|----------------------|--------|
| [`comp-1-barra-completa.png`](assets/comp-1-barra-completa.png) | Topología barra completa + columna de papel | **Obsoleto** |
| [`comp-2-columna-unica.png`](assets/comp-2-columna-unica.png) | Densidad y etiqueta SIN VALOR TRIBUTARIO | **Obsoleto** (conservar la lección de densidad y la etiqueta) |
| [`comp-3-revision.png`](assets/comp-3-revision.png) | Revisión contrastada y papeleta | **Obsoleto** (conservar la gramática de corrección) |

**Antes de implementar el pivote visual** se requiere una nueva composición aprobada que muestre: sidebar + tabs + Soft-Pill + full-bleed. Hasta entonces, este documento y `DESIGN.md` mandan sobre los PNG.

### Lo que sobrevive de la exploración previa

- Corrección contrastada (original tachado + propuesta limpia).
- Total anclado al pie (no viaja con el scroll del pedido).
- Entrada arriba, emit abajo (separación espacial).
- Emitir = botón que se deshabilita al pulsar (sin gestos elaborados).
- Etiqueta **SIN VALOR TRIBUTARIO** junto al tipo cuando aplica.
- Densidad: catorce líneas visibles en escritorio.

---

## Por qué esta forma, y qué se aprendió por el camino

La primera dirección hacía que la pantalla entera fuese una cinta de comprobante. Se descartó por confundir interfaz y documento.

Se conservó un tiempo el material “papel cálido / radio cero / sin sidebar”. El volcado 5 pivota a Soft-Pill y pide sidebar, tabs y full-bleed: el material cambia; la distinción herramienta ≠ comprobante no.

**El total no puede viajar con el contenido.** Anclado al pie del área de trabajo.

**El gesto elaborado sobraba.** Idempotencia invisible; botón que se deshabilita.

**Perfil al pie del sidebar.** Reduce logout accidental; marca y nav quedan arriba.

---

## Inventario de pantallas

| Superficie | Historias | Papel |
|-----------|-----------|-------|
| **El mostrador** (Inicio) | US1, US3, US5, US6, US7, US8, US9 | Área principal con tabs Pedido \| Cotizaciones \| Vecinos \| Lista. |
| **Configuración** | US2 (+ series/usuarios/parámetros) | Ítem del sidebar. Alcance por rol: [NEEDS CLARIFICATION en intake — ¿solo admin?]. |
| **Comprobantes** | US4 | Consultar lo emitido y anular dentro del día. Única superficie del sello. Acceso por comando o aviso de emisión. |

La aplicación abre en **Inicio → tab Pedido**, con tipo de documento **Nota de Venta** y la entrada enfocada.

El significado exacto del tab **Lista** queda abierto en el intake (volcado 5).

---

## Jerarquía del shell y del mostrador

**Shell**

1. **Sidebar.** Marca SuitPay (arriba) → nav (Inicio, Configuración) → perfil + logout (abajo).
2. **Área de trabajo.** Resto del viewport, fondo lienzo gris; paneles blancos suaves.

**Mostrador (tab Pedido — 90% del uso)**

1. **Tabs.** Pedido | Cotizaciones | Vecinos | Lista.
2. **La entrada.** Campo ancho con micrófono y cámara; acepta producto, comando `/`, dictado y foto. Foco al abrir.
3. **Banda de degradación.** Bajo la entrada cuando algo está caído; no desaparece sola.
4. **Cabecera fija de documento.** Tipo (default Nota de Venta), serie, cliente. Cambio de tipo no destruye el pedido.
5. **Distintivo de documento interno.** Etiqueta **SIN VALOR TRIBUTARIO** (cápsula o badge suave en rojo) junto al tipo cuando aplica.
6. **El pedido.** Líneas densas; precio editable inline; scroll interno entre cabecera y pie.
7. **El pie del total.** Recuento, medio de pago, total grande, EMITIR a la derecha.

Lo que deliberadamente **no** está: métricas, gráficos, contadores del día, avatares decorativos.

---

## Componentes

### Sidebar (`BarraLateral`)
Marca, nav, perfil al pie. Controles en cápsula. Superficie blanca sobre lienzo.

### Entrada (`Entrada`)
Un campo, tres alimentaciones. Sugerencias locales; modo comando con `/`. Objetivos generosos. Estados: reposo, sugiriendo, comando, grabando, procesando, asistencia caída.

### Tabs del mostrador (`PestanasMostrador`)
Pedido | Cotizaciones | Vecinos | Lista. Cápsulas o subrayado suave; el tab activo contraste claro.

### Región del pedido (`Pedido`)
Panel blanco a todo el ancho útil del área de trabajo (`rounded-2xl` / `3xl` si es contenedor). Estados: vacía, con líneas, en revisión, emitida.

### Línea de pedido (`LineaPedido`)
Igual semántica que antes; formas Soft-Pill en controles editables.

### Pie del total (`PieTotal`)
Total, medio de pago, emitir en cápsula. Motivo de bloqueo en rojo bajo el botón.

### Revisión contrastada (`RevisionCaptura`)
Sin cambio de gramática: tachado + propuesta; mismas columnas al aprobar.

### Papeleta de contexto (`PapeletaContexto`)
Modal suave (`rounded-2xl` + `shadow-md`). Única elevación fuerte. Nunca decisión irreversible.

### Sello (`Sello`)
Solo sobre emitidos. Regla literal: si tiene sello, existe ante SUNAT.

### Marca de estado / Banda / Cabecera
Misma semántica; sin bordes gruesos ni radio cero.

---

## Estados que el diseño debe cubrir

| Estado | Cómo se ve |
|--------|-----------|
| **Pedido vacío** | Panel con cabeceras de columna y entrada enfocada. Sin bienvenida. |
| **Sin conexión** | Banda roja; búsqueda local sigue. |
| **Asistencia caída** | Micrófono/cámara inertes con motivo; escribir sigue siendo la vía. |
| **Proveedor caído** | Etiqueta del botón anticipa venta en espera / documento interno. |
| **Emisión en vuelo** | Botón deshabilitado; sin segunda pulsación. |
| **Emisión indeterminada** | Sin reintentar a ciegas; mensaje de qué hacer con el cliente. |
| **Requiere intervención** | Rojo persistente + vía de escalado. |
| **Serie no configurada** | Botón inhabilitado con texto exacto de qué falta. |
| **Cliente exigido por umbral** | Cabecera en rojo; motivo visible. |
| **Cotización ya convertida** | Papeleta con el comprobante resultante. |
| **Fotografía ilegible** | Revisión vacía + reintentar; foto conservada. |
| **Fuera de ventana de anulación** | Solo nota de crédito; no botón que fallará. |
| **Sesión inválida** | Reautenticar sin perder el pedido local. |

---

## Movimiento

Poco y con propósito. Línea nueva casi inmediata. Sello sin deslizamiento. Botón de emitir sin transición decorativa. Con `prefers-reduced-motion`, sin transición.

---

## Accesibilidad de esta superficie

- Objetivos generosos (de pie).
- Venta completa solo con teclado.
- Nada crítico solo en hover.
- Estados con segunda señal además del color.
- Nada crítico solo sonoro.
- Contraste alto sobre lienzo claro (gris/blanco), luz de día.

---

## Decisiones que un implementador no debe inventar

- **La pantalla no imita un comprobante.**
- **El sello solo toca lo ya emitido.**
- **El verde no existe.**
- **Soft-Pill obligatorio:** cápsulas en controles; radios amplios en paneles; sin `rounded-none` / `rounded-sm` como carácter.
- **Sin bordes gruesos ni sombras brutales.**
- **Sin papel/mesa amarillentos** como fondo de app.
- **Hay sidebar** con marca arriba y perfil+logout abajo.
- **Contenido a todo el ancho** del área de trabajo.
- **Tabs** Pedido | Cotizaciones | Vecinos | Lista en el mostrador.
- **Default de tipo:** Nota de Venta.
- **No hay modo oscuro.**
- **Entrada arriba, total abajo.**
- **Etiqueta SIN VALOR TRIBUTARIO** cuando no hay valor tributario.
- **Emitir es un botón** deshabilitado al pulsar.
- **La palabra "eliminar"** no aparece referida a un comprobante emitido.
- **Ventana de anulación** en zona horaria `America/Lima`.
- **No implementar contra los PNG obsoletos** sin nueva aprobación visual.

## Decisiones que siguen abiertas

- Nueva composición Soft-Pill + sidebar + tabs (aprobación visual).
- Significado del tab **Lista**.
- Quién entra a **Configuración** (solo admin vs también vendedor).
- Valores exactos de espaciado del shell: se fijan en la primera implementación Soft-Pill y se recogen luego en `DESIGN.md`.
- Maquetación de `formato_pdf: ticket` en impresora de rollo.
