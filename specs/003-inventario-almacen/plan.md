# Implementation Plan: Inventario y almacén

**Branch**: `003-inventario-almacen` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

## Summary

Contadores orientativos por SKU (`inventario/{codigo}`), descuento idempotente al emitir, herencia en guía asociada, reintegro único al anular, avisos no bloqueantes, ajuste en Catálogo (popover perezoso, sin motivo). **No** hay ruta `/administracion/inventario`.

## Technical Context

**Language/Version**: TypeScript, TanStack Start, Firestore Admin SDK.

**Storage**: `inventario/{codigo}` separado de `catalogo/actual`. Un write por SKU vendido (no hotspot en el catálogo).

**Testing**: Vitest dominio/servidor + emulador (idempotencia, indeterminado, cascada, reglas).

**Constraints**: principio II (un efecto por clave); principio V (aviso no bloquea; fallo de inventario no revierte emisión); descontar solo con venta cerrada (`enviado`/`aceptado`), también en `consultar-estado`.

## Constitution Check

| # | Puerta | Estado |
|---|--------|--------|
| I | Ajustes admin explícitos; stock no emite solo | pass |
| II | Descuento atado a flags del comprobante | pass |
| III | Inventario no toca la frontera del proveedor | pass |
| IV | Solo códigos y cantidades | pass |
| V | Aviso no bloqueante; NV aceptada sin proveedor | pass |
| VI | No afirmar mermas sin línea base | pass |

## Project Structure

```text
src/domain/inventario/
src/server/inventario/
src/features/inventario/
src/routes/administracion/catalogo.tsx  # lista maestra + popover cantidad
```
