# Implementation Plan: Mostrador asistido — primera entrega de SuitPay

**Branch**: `001-mostrador-asistido` | **Date**: 2026-07-28 | **Updated**: 2026-07-29 (volcado 5) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mostrador-asistido/spec.md`

## Summary

Aplicación web para navegador de escritorio y móvil que permite a 5 vendedores concurrentes armar un pedido —escribiéndolo, dictándolo o fotografiando una guía manual— y documentarlo como boleta, factura o nota de venta (default Nota de Venta), delegando la emisión electrónica en un proveedor externo sustituible. Shell con sidebar (Inicio, Configuración; perfil al pie); mostrador full-bleed con tabs; dirección visual Modern Soft-Pill (`DESIGN.md`).

El enfoque técnico se apoya en tres decisiones que atraviesan todo el diseño. La primera es que **existe un backend obligatorio**: ni el token del proveedor de emisión ni las claves del servicio de asistencia pueden vivir en el navegador, y la garantía de no emitir duplicados exige un árbitro con autoridad. La segunda es que **el catálogo viaja completo al cliente en un solo documento**, lo que hace la búsqueda instantánea, local e independiente de servicios externos, al coste de una lectura por sesión. La tercera es que **el comprobante y su clave de idempotencia son el mismo documento**, creado antes de invocar al proveedor, lo que convierte la garantía del principio II en una propiedad estructural en lugar de una comprobación añadida.

## Technical Context

**Language/Version**: TypeScript en cliente y servidor. Las versiones exactas se fijan contra las estables vigentes al andamiar; no se anticipan aquí para no dejar números que envejezcan mal.

**Primary Dependencies**

| Área | Elección | Por qué |
|------|----------|---------|
| Framework | **TanStack Start** | Decisión del autor. Aporta además el servidor donde viven los secretos, lo que elimina el proyecto de funciones separado. |
| Enrutado | **TanStack Router** | Decisión del autor. Enrutado por archivos con tipos verificados. |
| Construcción | **Vite** | Base de Start. |
| Despliegue | **Firebase App Hosting** (servidor) + site Hosting **`suitpay`** en el proyecto **`blayblocklabs-antrax`** | App Hosting vía adaptador Nitro para funciones de servidor; site `suitpay` declarado para el hosting del producto. Ver riesgo Nitro en `research.md`, decisión 1b. Secretos fuera del repo. |
| Datos remotos | **TanStack Query** | Misma familia, integración directa con Start. Da caché por sesión, revalidación y estados de carga sin inventar nada. |
| Formularios | **TanStack Form** | Coherencia con el resto y validación compartida con el dominio. |
| Validación | **Zod** | Un único esquema por operación, usado en el validador de la función de servidor y en el formulario. Es lo que hace que la regla "manda el servidor" no sea un eslogan. |
| Estado del pedido | **Zustand**, persistido en IndexedDB | El pedido en curso se toca desde la búsqueda, el dictado, la fotografía y la edición de precio. Un almacén pequeño y explícito es más honesto que propagarlo por props. |
| Persistencia local | **idb** | Envoltorio mínimo sobre IndexedDB. Dexie sobra para dos almacenes. |
| Búsqueda difusa | **Fuse.js** | Decisión del autor. Corre en el cliente sobre el catálogo en caché. |
| Estilos | **Tailwind CSS** | Densidad y consistencia sin salir del marcado, que es lo que pide una interfaz de mostrador. |
| Componentes | Primitivas **Radix UI** con estilo propio | Accesibilidad y comportamiento de diálogos, listas y menús resueltos; la apariencia es nuestra. Ver `design.md`. |
| Iconos | **Lucide** | |
| Fechas y zona horaria | Utilidad propia sobre `Intl` fijada a **America/Lima** | No es un detalle: la ventana de anulación es "el mismo día" y calcularla en UTC haría inanulable una venta de las 7 de la tarde a los pocos minutos. |
| Firebase | Authentication, Cloud Firestore, Cloud Storage; Admin SDK en el servidor. **Sin App Check** en esta entrega | |
| Tareas periódicas | **Ninguna** (decisión 10) | Reintento manual + consulta bajo demanda; sin Cloud Scheduler. |

**Storage**: Cloud Firestore **edición Standard**, en el proyecto Firebase **`blayblocklabs-antrax`** (independiente del de la tienda virtual a efectos de producto SuitPay). Cloud Storage para los medios originales de las capturas. IndexedDB en el navegador para el pedido en curso y el espejo del catálogo.

**Testing**: **Vitest** para el dominio (cálculo de totales, validaciones, ventana de anulación, coincidencia difusa) y para las funciones de servidor con el proveedor simulado; **Testing Library** para componentes; **Firebase Emulator Suite** para las reglas de seguridad y la integración con Firestore; **Playwright** para el flujo de venta de extremo a extremo. Las pruebas de reintento, respuesta ausente y fallo del proveedor son obligatorias por la constitución, no opcionales.

**Target Platform**: navegadores modernos de escritorio y móvil. Sin aplicación nativa.

**Project Type**: aplicación web con backend serverless (frontend + funciones).

**Performance Goals**: la búsqueda de productos responde sin latencia perceptible por ser local; una venta de hasta 5 líneas se completa en menos de 2 minutos (SC-002); el arranque de la aplicación no espera por la red cuando hay catálogo en caché.

**Constraints**: ningún secreto en el cliente; la búsqueda de productos no depende de servicios externos (FR-007); el pedido en curso sobrevive a la pérdida de conexión (FR-015); ningún dato identificatorio de clientes llega al servicio de asistencia (FR-045, principio IV); el cliente no puede escribir comprobantes directamente en la base de datos.

**Scale/Scope**: 5 vendedores concurrentes, ~500 productos, un local, volumen diario modesto que cabe con holgura en la cuota gratuita de Firestore. 9 historias de usuario, 57 requisitos funcionales.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Puertas derivadas de `.specify/memory/constitution.md` v1.0.0.

| # | Puerta | Verificación | Estado |
|---|--------|--------------|--------|
| I | Aprobación humana indelegable (NO NEGOCIABLE) | La emisión solo ocurre por una función invocada explícitamente desde una acción de confirmación, con el identificador del vendedor tomado del token de sesión y no de la petición. Las capturas asistidas escriben propuestas, nunca comprobantes. Las instrucciones en lenguaje natural se resuelven contra un catálogo cerrado de operaciones de solo lectura. | **pass** |
| II | Ninguna venta se documenta dos veces (NO NEGOCIABLE) | El comprobante y su clave de idempotencia son el mismo documento, creado en una transacción antes de invocar al proveedor. Un segundo intento con la misma clave encuentra el documento existente y devuelve su resultado. El estado `indeterminado` impide el reintento a ciegas; la resolución es **consulta bajo demanda**, no un job. | **pass** |
| III | Proveedor de emisión sustituible | Toda interacción con el proveedor vive en un único módulo del backend detrás de una interfaz propia. El modelo de datos guarda referencias del proveedor en un objeto aislado y nunca usa sus nombres de campo como propios. El cliente no conoce al proveedor. | **pass** |
| IV | Datos de clientes fuera de los servicios de IA (NO NEGOCIABLE) | Todo el tráfico hacia el servicio de asistencia pasa por una única función del backend, que actúa como punto de estrangulamiento auditable. La identidad del cliente se resuelve en el cliente y en el backend, nunca en el modelo. | **pass** |
| V | El mostrador no se detiene | La búsqueda es local sobre el catálogo en caché. El pedido en curso vive en IndexedDB. La indisponibilidad del proveedor deriva en venta en espera con documento interno. La degradación se expone como estado explícito en la interfaz. | **pass** |
| VI | Lo que no se mide no se declara mejorado | El plan no afirma ninguna mejora. Las líneas base son una tarea previa a la puesta en marcha, ajena a la implementación. | **pass** |
| — | Restricciones del dominio | Los documentos internos son de un tipo distinto y no consumen series reguladas. La anulación es un cambio de estado con motivo y autor, nunca un borrado. Cada consumo de correlativo se registra, incluidos los fallidos. El desglose del impuesto se delega enviando el precio con impuesto incluido. | **pass** |
| — | Disciplina de desarrollo | Las pruebas de reintento, respuesta ausente y fallo del proveedor están declaradas como obligatorias. La integración se ejercita contra el entorno de demostración del proveedor. El alcance excluido en `concept.md` no aparece en este plan. | **pass** |

**Resultado: las ocho puertas pasan.** No hay violaciones que justificar, por lo que la tabla de Complexity Tracking queda vacía. La puerta II merece una nota: pasa porque el diseño incluye una estrategia de reconciliación que funciona incluso si el proveedor no acepta un número de comprobante explícito. Ver `research.md`, decisión 4.

### Reevaluación posterior al diseño de la Fase 1

Las ocho puertas siguen pasando, y el diseño las refuerza en tres puntos que antes eran solo intención:

**La puerta II se volvió estructural.** Al hacer que el comprobante y la clave de idempotencia sean el mismo documento (`data-model.md`), la garantía deja de depender de que alguien recuerde comprobarla en cada ruta: no existe forma de emitir sin haber reclamado antes el documento. La clasificación de fallos en `indeterminado`, `indisponible` y `rechazo_definitivo` de `contracts/proveedor-emision.md` es lo que impide el reintento a ciegas, y el escenario V3 de `quickstart.md` la ejercita en su variante peligrosa.

**La puerta II descubrió un hueco que se cerró.** La clave de idempotencia protege contra la doble pulsación y el reintento, pero **no** contra dos dispositivos con la misma cotización abierta, porque cada uno genera una clave distinta. El diseño lo resuelve marcando la cotización como convertida en la misma transacción que crea el comprobante, y el escenario V4 lo verifica.

**Las puertas I y V ganaron un guardián explícito.** `contracts/firestore-rules.md` prohíbe al cliente escribir comprobantes y series bajo cualquier rol. Sin esa prohibición, todo lo anterior sería una convención voluntaria del cliente en lugar de una propiedad del sistema.

Dos verificaciones quedaron formuladas como comprobaciones ejecutables en lugar de buenas intenciones: la del principio III se reduce a buscar el nombre del proveedor en el repositorio y comprobar que no aparece fuera de su módulo frontera; la del principio IV, a inspeccionar el payload de la única función que habla con el servicio de asistencia.

### Reevaluación tras enmienda volcado 5 (2026-07-29)

Las ocho puertas siguen pasando. Cambios de superficie (sidebar, Soft-Pill, tabs, full-bleed) y de origen del correlativo (`numeroInicial`) no debilitan I–VI. La puerta II se refuerza al explicitar que el contador se alinea al número inicial de la serie antes de reclamar. La implementación del pivote visual y del shell queda documentada en `design.md` / `DESIGN.md` y se descompone en tareas nuevas; **no se ha ejecutado código de producto en esta enmienda**.

## Project Structure

### Documentation (this feature)

```text
specs/001-mostrador-asistido/
├── plan.md              # Este archivo
├── spec.md              # Especificación (entrada)
├── research.md          # Fase 0: decisiones técnicas con su justificación
├── data-model.md        # Fase 1: colecciones, documentos y transiciones de estado
├── quickstart.md        # Fase 1: guía de validación ejecutable
├── design.md            # Fase 1: interfaz, componentes y sistema de diseño
├── contracts/
│   ├── functions.md     # Contrato de las funciones de servidor y las tareas programadas
│   ├── firestore-rules.md  # Contrato de acceso a datos
│   └── proveedor-emision.md # Contrato de la frontera del proveedor
└── checklists/
    └── requirements.md  # Validación de la especificación
```

### Source Code (repository root)

```text
src/
├── routes/                   # Enrutado por archivos de TanStack Router
│   ├── __root.tsx            # Shell: sidebar (SuitPay, nav, perfil al pie) + outlet
│   ├── index.tsx             # Mostrador (Inicio) con tabs Pedido|Cotizaciones|Vecinos|Lista
│   ├── configuracion/        # Ítem del sidebar (alcance por rol TBD)
│   ├── comprobantes/         # Consulta y anulación
│   ├── cotizaciones/         # También alcanzable vía tab Cotizaciones
│   ├── administracion/       # Catálogo, series (con numeroInicial), usuarios, parámetros
│   └── api/                  # Sin jobs (Scheduler fuera de diseño; decisión 10)
│
├── server/                   # SOLO servidor. Nada de aquí llega al navegador.
│   ├── emision/              # Emitir, anular, consultar estado bajo demanda
│   ├── proveedor/            # Frontera del proveedor (ÚNICO módulo que lo conoce)
│   ├── asistencia/           # Punto único de salida hacia el servicio de IA
│   ├── contribuyentes/       # Consulta de RUC y DNI
│   ├── catalogo/             # Importación y publicación
│   ├── auth/                 # Verificación de sesión y rol (sin App Check)
│   └── firebase/             # Admin SDK
│
├── domain/                   # Puro, sin dependencias. Compartido por ambos lados.
│   ├── totales/              # Cálculo de importes
│   ├── documentos/           # Tipos de documento y sus reglas
│   ├── anulacion/            # Ventana temporal en zona horaria de Lima
│   ├── busqueda/             # Coincidencia aproximada
│   └── esquemas/             # Esquemas de validación compartidos
│
├── features/                 # Cliente, por capacidad
│   ├── catalogo/             # Espejo local y búsqueda
│   ├── pedido/               # Almacén del pedido en curso
│   ├── clientes/             # Alta en contexto y coincidencias
│   ├── emision/              # Confirmación, estados, salida impresa
│   ├── cotizaciones/
│   ├── captura/              # Audio, fotografía, revisión contrastada
│   ├── comandos/             # Instrucciones de consulta
│   └── degradacion/          # Detección y exposición del estado degradado
│
├── ui/                       # Sistema de diseño. Ver design.md
│   ├── tokens/
│   └── componentes/
│
└── infra/                    # Firestore desde el cliente, IndexedDB

firestore.rules               # Reglas de acceso
firestore.indexes.json        # Índices compuestos
storage.rules                 # Acceso a los medios de captura
apphosting.yaml               # Configuración de despliegue y secretos

tests/
├── e2e/                      # Playwright: flujo de venta
└── emulador/                 # Reglas de seguridad e integración con Firestore
```

**Structure Decision**: un único artefacto desplegable en lugar de dos. Al adoptar TanStack Start, el servidor que el framework ya trae absorbe el papel que en el plan inicial correspondía a un proyecto separado de Cloud Functions. La consecuencia práctica es un despliegue, una configuración de secretos y un solo lugar donde vive el dominio.

El backend sigue siendo obligatorio por las mismas tres razones de antes, que no dependen de cómo se implemente: los secretos del proveedor y del servicio de asistencia no pueden residir en el navegador, la integridad del correlativo y de la clave de idempotencia exige un árbitro con autoridad, y el principio IV es mucho más fácil de garantizar y auditar con un único punto de salida hacia el servicio de asistencia.

Tres fronteras de este árbol son deliberadas y conviene no erosionarlas:

`src/server/` no debe ser importado nunca desde el cliente. Es donde viven los secretos y el privilegio administrativo. La disciplina de que todo lo de ahí se alcance solo a través de funciones de servidor es lo que sostiene el resto.

`src/domain/` es puro y no importa nada de Firebase, de React ni del framework. Existe para que las reglas de cálculo y validación sean literalmente el mismo código en ambos lados: el cliente las usa para mostrar totales al instante, el servidor como fuente de verdad al emitir. Cuando discrepen, manda el servidor, y eso solo es creíble si el código es el mismo.

`src/server/proveedor/` es el único lugar del sistema que conoce al proveedor de emisión, tal como exige el principio III. La comprobación es buscar su nombre en el repositorio y no encontrarlo fuera de ahí.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sin violaciones. Las ocho puertas de la verificación constitucional pasan y esta tabla queda deliberadamente vacía.
