# Implementation Plan: Guías de remisión electrónicas

**Branch**: `002-guias-remision` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-guias-remision/spec.md`

## Summary

Extender SuitPay para emitir guías de remisión electrónicas (modos público, privado y traslado entre almacenes) reutilizando el mostrador de 001: comando `/guia` + papeleta de confirmación, maestros `transportistas`, e implementación de `emitirGuiaRemision` en la frontera del proveedor. Sin tab nuevo. Sin filtrar el nombre del proveedor fuera de `src/server/proveedor/**`.

## Technical Context

Reutiliza el stack de 001: TanStack Start, Firestore, Zustand pedido local, Vitest + emuladores, Playwright. Nuevas piezas:

| Área | Elección |
|------|----------|
| Dominio | Tipo de documento guía; validación condicional por modo/motivo |
| Persistencia | `comprobantes` (mismo patrón idempotente); `transportistas/{ruc}`; `indices/transportistas` |
| UI | Papeleta/modal desde `/guia`; alta transportista en contexto |
| Frontera | `emitirGuiaRemision` en adaptador; simulado para pruebas |
| Comandos | Entradas en `CATALOGO_DE_COMANDOS`: `/guia`, `/crear transportista` |

## Constitution Check

| # | Puerta | Estado |
|---|--------|--------|
| I | Confirmación humana antes de emitir / alta transportista | pass — papeleta + Emitir; comandos → propuesta |
| II | Idempotencia; no reintento a ciegas | pass — mismo patrón que `emitirComprobante` |
| III | Frontera proveedor | pass — mapeo solo en adaptador |
| IV | Sin datos de clientes a IA | pass — GRE no usa asistencia con PII |
| V | Degradación visible | pass — fallo padrón/proveedor no bloquea alta manual / reintento clasificado |
| VI | No afirmar mejoras sin medir | pass |

## Project Structure

```text
src/server/proveedor/          # emitirGuiaRemision + simulado
src/server/emision/            # orquestación guía (idempotencia)
src/server/transportistas/     # crear / índice
src/features/guias/            # papeleta, comandos, UI
src/features/comandos/pistas.ts
specs/002-guias-remision/
```

## Decisions

1. **Comando + papeleta, no tab** — GRE es menos frecuente que la venta; ~15 campos no caben en una línea.
2. **Transportistas como clientes** — doc por RUC + índice reducido; conductores embebidos o recientes en el transportista/privado, sin colección de conductores en v1.
3. **Payloads del proveedor** — documentados en [research.md](./research.md); vocabulario SuitPay en contratos propios.

## Phases (alto nivel)

0. Contrato SuitPay de guía + tipos dominio  
1. Adaptador `emitirGuiaRemision` + simulado + pruebas de fallo  
2. Orquestación emisión (idempotencia, series)  
3. Transportistas (CRUD servidor, índice, alta UI)  
4. Papeleta UI + `/guia` / `/crear transportista`  
5. PDF post-emisión (reutilizar patrón 001)  
6. Emulador + e2e mínimo  

Detalle en [tasks.md](./tasks.md).
