---
name: SuitPay
description: Mostrador moderno y suave — superficies blancas sobre gris claro, controles en cápsula, el comprobante es lo que sale de aquí, no lo que se ve aquí.
---

<!-- SEED: pivote Modern Soft-Pill acordado en volcado 5 (2026-07-29). Sustituye por completo el norte brutalista / papel cálido / radio cero. -->

# Design System: SuitPay

## Overview

**Creative North Star: "Modern Soft-Pill"**

La pantalla es la herramienta de trabajo del vendedor, no el comprobante. Ahí se anota el pedido, se negocia el precio, se corrige lo mal leído y se decide qué documento emitir. El comprobante es lo que **sale** de esta superficie: lo compone el proveedor de emisión con el formato que exige SUNAT. Son dos objetos distintos y el sistema nunca los confunde.

Esa distinción sigue siendo la decisión de diseño más importante. Una dirección previa hizo que la pantalla pareciese un documento impreso; en facturación es peligrosa: una nota de venta y el documento interno de contingencia deben distinguirse **sin margen de duda** de una factura real.

El material visual cambia respecto del seed brutalista. Se abandona el papel cálido, la mesa kraft, el radio cero y las sombras sólidas. El sistema adopta superficies suaves: blanco sobre gris claro, controles en cápsula, tarjetas con radios amplios, separación por contraste de color y elevación natural solo cuando aporta.

Lo que se conserva del mundo anterior es la semántica de estado (qué hay / qué no es definitivo / qué quedó validado), la tipografía pensada para vista cansada, la densidad del pedido y la regla del sello: **si tiene sello, existe ante SUNAT**.

**Key Characteristics:**

- Shell con sidebar (marca, navegación, perfil al pie) y área de trabajo a todo el ancho.
- Controles interactivos en cápsula (`rounded-full`); contenedores mayores con radios amplios (`rounded-2xl` / `rounded-3xl`).
- Fondos en capas de gris claro y blanco; sin papel amarillento.
- Bordes sutiles o ninguno; sombras solo `shadow-sm` / `shadow-md`.
- Tres tintas semánticas escasas; **nunca verde**.
- Claro siempre. No hay modo oscuro.

## Colors

Paleta de trabajo sobre neutros fríos. La mayoría de la superficie es gris de aplicación y blanco de panel; el rojo y el violeta siguen siendo escasos.

### Primary

- **Tinta** (`#1A1714`): negro cálido para contenido. Dice **qué hay**.

### Secondary

- **Rojo de aviso** (`#C2321C`): dice **qué no es definitivo o qué está mal**. Texto pendiente de revisión, venta en espera, ANULADO, degradación, motivo de bloqueo. Nunca para celebrar un éxito.

### Tertiary

- **Violeta de sello** (`#4C3F91`): dice **qué quedó validado**. Solo sobre documentos ya emitidos.

### Neutral

- **Lienzo** (`#F9FAFB` / `gray-50`): fondo de la aplicación.
- **Lienzo profundo** (`#F3F4F6` / `gray-100`): capas o regiones secundarias.
- **Superficie** (`#FFFFFF`): paneles, tarjetas, sidebar, campos sobre el lienzo.
- **Borde sutil** (`#E5E7EB` / `gray-200`): cuando hace falta contorno.
- **Tinta desvaída** (`#6B7280` / `gray-500`): etiquetas secundarias, texto tachado, hints.

### Named Rules

**La Regla de las Tres Tintas.** Negro dice qué hay, rojo qué no es definitivo o qué está mal, violeta qué quedó validado. Un color decorativo es un error.

**No existe el verde.** Rojo/verde es un mal par para deficiencia rojo-verde; “no definitivo” y “validado” no pueden confundirse. Un estado positivo se marca con el sello.

**La Regla del Color Escaso.** Rojo y violeta juntos no ocupan más del 10% de ninguna pantalla.

**La Regla de la Redundancia.** Ningún estado se distingue únicamente por color.

**La Regla del Contraste Suave.** La separación de regiones se da por contraste de color (blanco sobre gris), no por bordes gruesos ni sombras brutales.

## Typography

**Body Font:** Atkinson Hyperlegible (fallback a la pila del sistema)  
**Números y códigos:** compañero monoespaciado de Atkinson Hyperlegible (o Martian Mono si no estuviera disponible).

Diseñada para baja visión; el mostrador se lee de pie y a distancia. Sin tipografía de display: el “display” lo cumple el total.

### Hierarchy

- **Total** (peso alto, mayor tamaño): importe a cobrar.
- **Línea de pedido** (números monoespaciados, tamaño generoso).
- **Cabecera de documento / tabs** (peso alto, tamaño medio).
- **Etiqueta** (pequeña, tracking abierto): campos y columnas; tinta desvaída.
- **Aviso** (peso alto): degradación y estados; rojo de aviso.

### Named Rules

**La Regla de los Dígitos Tabulares.** Todo número comparable va en cifras tabulares y alineado a la derecha.

**La Regla del Ancho Útil.** El área de trabajo usa el espacio disponible junto al sidebar; no se centra una columna estrecha sobre un “marco” decorativo.

## Layout

**Shell.** Sidebar a la izquierda: marca **SuitPay** arriba; ítems de navegación (Inicio, Configuración por ahora); perfil de usuario + logout al **pie**. El contenido principal ocupa el resto del viewport a todo el ancho.

**Mostrador.** Tabs internos: Pedido | Cotizaciones | Vecinos | Lista. Bajo los tabs, la entrada (escribir / dictar / fotografiar) y el pedido; el total y emitir anclados al pie del área de trabajo.

**Densidad.** Catorce líneas de pedido deben caber en un monitor de escritorio. La suavidad de forma no justifica aire vacío que empuje el pedido fuera de vista.

**Cabecera de documento.** Tipo (default Nota de Venta), serie y cliente permanecen visibles.

**Comportamiento adaptable.** En móvil el sidebar puede colapsar a un patrón compacto; la jerarquía vertical (entrada arriba, total abajo) se mantiene.

## Elevation & Depth

Los componentes deben parecer **suaves**. Separación por contraste: `bg-white` sobre `bg-gray-50` / `bg-gray-100`.

- Si se requiere borde: `border border-gray-200` únicamente. **Prohibido** `border-2`, `border-4`, `border-black`.
- Si se requiere sombra: `shadow-sm` o `shadow-md` con opacidad baja. **Prohibido** sombras sólidas brutales (`shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]` y equivalentes).
- La papeleta de contexto puede usar `shadow-md` por flotar de verdad; no introduce un segundo lenguaje de elevación.

### Named Rules

**La Regla de la Elevación Natural.** Solo flota lo que está encima (modales / papeleta). El resto es plano sobre capas de color.

## Shapes

**PURGAR:** cualquier uso de `rounded-none`, `rounded-sm`, o esquinas afiladas como carácter del sistema.

**NUEVA REGLA — Cápsulas:** todos los botones, badges y controles interactivos son tipo píldora: `rounded-full` (radio 9999px).

**NUEVA REGLA — Contenedores:** tarjetas y contenedores mayores usan radios amplios pero no completos: `rounded-2xl` o `rounded-3xl`.

Campos de texto e inputs siguen la misma familia suave (cápsula o radio amplio coherente con el control); nunca esquinas a cero.

El sello sobre lo emitido puede conservar carácter propio (ligera rotación); no justifica volver al radio cero del resto de la UI.

## Do's and Don'ts

### Do:

- **Do** mantener la herramienta visiblemente distinta de un comprobante.
- **Do** usar sidebar con marca arriba y perfil+logout abajo.
- **Do** llenar el área de trabajo a todo el ancho útil; capas gris/blanco.
- **Do** poner controles interactivos en `rounded-full` y paneles en `rounded-2xl` / `rounded-3xl`.
- **Do** separar regiones con contraste de color; bordes solo `border-gray-200` si hacen falta.
- **Do** alinear a la derecha y en cifras tabulares todo número comparable.
- **Do** expresar una corrección con original tachado y propuesta limpia debajo.
- **Do** reservar el sello violeta para lo ya emitido.
- **Do** declarar en rojo, junto al tipo de documento, todo documento sin valor tributario.
- **Do** acompañar todo estado con una segunda señal además del color.
- **Do** mostrar degradación como banda persistente, no como toast que desaparece.

### Don't:

- **Don't** hacer que la pantalla parezca un comprobante impreso.
- **Don't** usar verde.
- **Don't** usar `rounded-none`, `rounded-sm`, ni esquinas afiladas como lenguaje visual.
- **Don't** usar `border-2`, `border-4`, `border-black`, ni sombras sólidas brutales.
- **Don't** volver al fondo papel/mesa amarillento (`#F7F4EC` / `#DED7C7`) como lienzo de la app.
- **Don't** centrar el contenido en una columna estrecha decorativa dejando “mesa” a los lados.
- **Don't** poner el perfil/logout arriba del sidebar (queda al pie).
- **Don't** ofrecer modo oscuro.
- **Don't** pedir gestos elaborados para operaciones que se repiten cien veces al día.
- **Don't** comunicar nada importante solo con sonido.
- **Don't** usar la palabra "eliminar" referida a un comprobante emitido.
