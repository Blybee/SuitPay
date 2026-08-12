# Términos de arte (Find the right terms)

Glosario vivo para prompts y diseño en SuitPay. Usa el **término preciso** en lugar de re-explicar con palabras vagas: el modelo (y el equipo) ya conocen el concepto.

**Para agentes:** cuando una solicitud o PR introduzca un concepto estable, **añádelo aquí** (término, significado breve, dónde vive en el repo, ejemplo de prompt).

| Término | Significado | Dónde en SuitPay | Ejemplo de prompt |
|---------|-------------|------------------|-------------------|
| **Dry-run / validar** | Interpretar y mostrar resumen/conflictos/diff **sin escribir** la fuente de verdad | `importarCatalogo` modo `validar`; admin catálogo | «Haz dry-run del PDF antes de publicar» |
| **Publicar (catálogo)** | Una sola escritura de `catalogo/actual` + `version++` tras confirmación admin | `importarCatalogo` modo `publicar` | «Publicar solo si no hay conflictos bloqueantes» |
| **Conflicto bloqueante** | Problema que impide publicar (p. ej. código duplicado); el sistema **no** lo “arregla” solo | `conflictos.ts`, FR-010 | «Marca unidad desconocida como conflicto, no inventes NIU» |
| **Diff de catálogo** | Nuevos / cambiados / desaparecidos vs lo ya publicado | `diferencias.ts`, FR-011 | «Muéstrame el diff antes de confirmar» |
| **Documento único de catálogo** | Todos los productos en **un** doc Firestore (`productos[]`), no 1 doc/producto | `catalogo/actual`, decisión 2 | «No fragmentes por producto; sigue el documento único» |
| **Parseo determinista** | Extracción tabular por reglas/coordenadas, reproducible en CI; **no** LLM | `lector-documento.ts` + `unpdf`, decisión 13 | «Parsea el PDF con unpdf, sin structured output de modelo» |
| **Structured output (LLM)** | Respuesta del modelo acotada a un esquema (p. ej. Zod); aquí **rechazado** para precios/códigos | Constitución IV permite productos a IA; decisión 13 lo descarta para tablas | «No uses LLM structured output para la lista de precios» |
| **Céntimos** | Enteros de moneda (S/ 12.50 → `1250`); evita floats | `Producto.precio`, dominio | «Guarda el precio en céntimos» |
| **Unidad SUNAT** | Código de unidad de medida (`NIU`, `BX`, …) en el producto | `Producto.unidad`, conflictos | «Mapea UND→NIU; el resto conflicto» |
| **Marca (preview)** | Metadato efímero de `LINEA:` en la grilla de importación PDF; no campo persistido aparte | Spec US2 / FR-009b | «Autoselecciona por marca LINEA y elimina» |
| **Inline edit** | Editar celdas en la grilla sin abrir otro formulario | Pantalla catálogo (T078d) | «Edición inline de código y precio en la grilla» |
| **Virtualización** | Renderizar solo filas visibles de listas largas (~3000) | Grilla admin PDF | «Virtualiza la grilla de importación» |
| **Multi-select** | Varias filas/opciones marcadas antes de una acción en lote | `Entrada` sugerencias + `Casilla` | «Multi-select en sugerencias con Agregar X» |
| **Bulk action** | Una acción sobre la selección (agregar/eliminar N) | Entrada; grilla catálogo | «Bulk delete de la marca seleccionada» |
| **Listbox / combobox** | Patrón a11y: input + lista de opciones (`role`, `aria-activedescendant`) | `Entrada.tsx` | «Mantén el combobox; Space marca casilla, Enter elige uno» |
| **Hamburger / disclosure nav** | Botón menú que revela navegación; light-dismiss | `BarraLateral` móvil + Popover API | «Hamburger centrado con popover auto» |
| **Popover API** | Top layer no modal; Esc / clic fuera cierran (`popover="auto"`) | Menú móvil; toasts (`manual`) | «Usa popover auto para el menú, no un Sheet Radix» |
| **Soft-Pill** | Lenguaje visual: cápsulas `rounded-full`, paneles suaves, sin brutalismo | `DESIGN.md`, tokens | «Respeta Soft-Pill; sin rounded-none» |
| **Idempotencia de emisión** | Misma intención de venta → un solo comprobante; clave = id del doc | Principio II, `emitir` | «No reintentes a ciegas; respeta indeterminado» |
| **Frontera del proveedor** | Único módulo que conoce al emisor externo; el resto usa vocabulario SuitPay | `src/server/proveedor/`, principio III | «No filtres nombres del proveedor fuera de la frontera» |
| **Indeterminado** | No se sabe si la emisión ocurrió; **prohibido** reintentar emitir | Estados de comprobante, decisión 10 | «Ante timeout clasifica indeterminado y ofrece reconciliar» |
| **Server function** | RPC TanStack Start (`createServerFn`) con auth/rol en servidor | `*.funciones.ts` | «Añade una server function solo-admin para interpretar el PDF» |
| **Espejo IndexedDB** | Copia local del catálogo/sesión para búsqueda offline | `infra/local`, principio V | «La búsqueda debe ir contra el espejo, no a la red» |
| **Return focus to search** | Tras confirmar un campo secundario (cantidad/precio), devolver el foco al buscador principal para el siguiente producto; no robar el Tab entre campos de la misma línea | `LineaPedido` → `Entrada.enfocar` (`MangoDeEntrada`) | «Return focus to search al confirmar cantidad/precio con Enter» |
| **Invoker (Popover)** | Botón ligado con `popoverTarget` / `popoverTargetAction`; evita la carrera light-dismiss + `togglePopover` en el mismo clic | `BarraLateral` menú móvil | «El hamburger debe ser invoker del popover, no onClick + toggle» |

## Cómo ampliar

1. Nombre canónico en **negrita** en la primera columna (inglés o español según se use en el código/spec).
2. Una frase de significado; evita tutoriales.
3. Ruta o artefacto real.
4. Un prompt corto que el dueño del producto pueda copiar.
