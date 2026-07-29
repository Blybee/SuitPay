# Contrato — Reglas de acceso a datos

**Feature**: 001-mostrador-asistido | **Fecha**: 2026-07-28

Define quién puede leer y escribir cada colección. Es el contrato que sostiene todo lo demás: sin él, la garantía de no emitir duplicados y la integridad del correlativo serían promesas del cliente en lugar de propiedades del sistema.

## Premisas

**El rol vive en las reivindicaciones del token**, no en un documento consultable. Así las reglas lo evalúan sin lecturas adicionales, lo que además evita que cada comprobación de permiso se facture.

**El backend escribe con privilegios administrativos** y por tanto no está sujeto a estas reglas. Eso es precisamente lo que las hace útiles: todo lo que aquí se prohíbe al cliente solo puede ocurrir a través de una función, donde hay validación, transacción y traza.

**Regla por defecto: negar.** Cualquier colección no enumerada aquí es inaccesible desde el cliente.

## Matriz de acceso

| Colección | Vendedor | Administrador | Jefe | Notas |
|-----------|----------|---------------|------|-------|
| `catalogo/actual` | leer | leer | leer | Escribir solo el backend, al publicar. |
| `indices/clientes` | leer | leer | leer | Escribir solo el backend. |
| `config/parametros` | leer | leer | leer | Escribir solo el backend. |
| `clientes/{id}` | leer, crear | leer, crear, editar | leer | El vendedor crea pero no edita: corregir los datos de un cliente ya registrado es una operación administrativa. |
| `comprobantes/{id}` | **leer** | **leer** | **leer** | **Ningún rol escribe. Nunca.** Solo el backend. |
| `series/{id}` | leer las propias | leer, editar | leer | El contador solo lo toca el backend, en transacción. |
| `cotizaciones/{id}` | leer, crear, editar las pendientes | leer, crear, editar | leer | El paso a `convertida` solo lo hace el backend. |
| `capturas/{id}` | leer, crear las propias | leer | — | El estado y las propuestas los escribe el backend. |
| `usuarios/{uid}` | leer el propio | leer, crear, editar | leer | El rol solo lo asigna el administrador, y se propaga al token. |

## Restricciones que las reglas deben imponer explícitamente

**Sobre comprobantes.** Prohibido crear, modificar y borrar desde el cliente, sin excepción y para todos los roles. Es la restricción más importante del sistema. Si un cliente pudiera escribir aquí, podría inventar un número, declarar `aceptado` un documento que nunca se emitió, o saltarse el correlativo. Toda la máquina de estados perdería sentido.

**Sobre el borrado.** Ninguna regla concede borrado en ninguna colección. La anulación es un cambio de estado y la ejecuta el backend. No existe camino para eliminar un comprobante, ni desde el cliente ni desde una función.

**Sobre las cotizaciones.** El vendedor puede editar una cotización mientras esté `pendiente`, pero no puede escribir el campo de estado ni el del comprobante resultante. Así se impide marcar una cotización como convertida sin que haya nacido un comprobante, que sería la forma de burlar la protección contra la doble conversión.

**Sobre las series.** El cliente puede leer su serie para saber si la tiene configurada, pero no puede tocar el contador. Escribirlo desde el cliente permitiría reservar o repetir numeración.

**Sobre los usuarios.** Un vendedor solo lee su propio documento y no puede modificar su rol ni reactivarse. La desactivación tiene que ser efectiva (FR-003).

**Sobre los medios de captura.** En Cloud Storage, cada vendedor escribe solo bajo su propio prefijo y no lee los medios de otros. Los originales de audio e imagen contienen la voz del vendedor y, potencialmente, nombres de clientes escritos en papel.

## Validaciones de forma en las reglas

Las reglas comprueban forma, no lógica de negocio. La lógica vive en las funciones, donde puede validarse en serio.

- Al crear un cliente: el identificador del documento coincide con el campo del número de documento, los campos obligatorios están presentes, y `creadoPor` coincide con el usuario autenticado.
- Al crear una cotización: `creadoPor` coincide con el usuario autenticado, el estado inicial es `pendiente`, y el campo del comprobante resultante viene vacío.
- Al editar una cotización: el estado sigue siendo `pendiente` y no se altera la autoría.
- En toda escritura: se rechazan campos no previstos, para que la forma de los documentos no derive con el tiempo.

## Cómo se verifica este contrato

Las reglas se prueban con el emulador, y las pruebas son obligatorias porque protegen operaciones con efecto tributario. Los casos que no pueden faltar:

- Un vendedor intenta crear un comprobante directamente. **Debe fallar.**
- Un vendedor intenta cambiar el estado de un comprobante a `aceptado`. **Debe fallar.**
- Un vendedor intenta borrar un comprobante. **Debe fallar.**
- Un vendedor intenta incrementar el contador de su serie. **Debe fallar.**
- Un vendedor intenta marcar una cotización como `convertida`. **Debe fallar.**
- Un vendedor desactivado intenta cualquier escritura. **Debe fallar.**
- Un vendedor intenta cambiar su propio rol a administrador. **Debe fallar.**
- Un vendedor lee el catálogo, el índice de clientes y los parámetros. **Debe funcionar.**
- Un vendedor crea un cliente nuevo con forma válida. **Debe funcionar.**
- Un vendedor recupera una cotización creada por otro vendedor. **Debe funcionar**, porque FR-017 lo exige.
