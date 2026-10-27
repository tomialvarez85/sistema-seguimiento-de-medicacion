# Análisis de los sprints y decisiones de implementación

Fuentes leídas: `Parcial2-PGE-Sprint1.pdf` (Comprender), `TP2 – Sprint 2 Pastillero digital.pdf` (Diseñar) y
`TP2_Sprint3_Pastillero_digital.pdf` (Mejorar), más el prompt maestro del pedido.

## 1. Requisitos extraídos

### Historias de usuario (backlog final del Sprint 3)

| ID | Requisito | Criterios de aceptación que se implementan |
|----|-----------|---------------------------------------------|
| HU-01 | Ver las pastillas de cada bloque con su etiqueta "para qué es" y su estado | Bloques Mañana y Noche · estado en texto · fecha siempre visible · pendientes arriba, registradas al final con ✓ y la hora |
| HU-02 | Marcar todo un bloque con un solo botón | Botón grande · confirmación con la hora ("Bloque de la mañana registrado a las 8:15") · el bloque pasa a Completo · si ya estaba registrado: "Este bloque ya se registró a las 8:15." |
| HU-03 | Marcar pastillas individualmente, incluso tarde | Clic o Espacio · confirmar bloque incompleto avisa qué falta y pide confirmación (foco en "Volver y marcar") · después del cierre se registra como tarde con la hora real · desmarcar es libre, con aviso breve |
| HU-04 | Cargar y editar medicamentos (nombre, dosis, bloque, etiqueta ≤ 25 caracteres) | No guarda con campos vacíos · contador de caracteres visible · avisa si el nombre ya está en ese bloque y ofrece "Editar el existente" |
| HU-05 | Avisos al inicio, a la mitad y al cierre del bloque | Inicio siempre; mitad y cierre solo si hay pendientes · ventana con la lista de pendientes + sonido · si el bloque se completa, no hay más avisos |
| HU-06 | Historial de los últimos 7 días | Estado de cada bloque por día · distingue a tiempo, tarde y no entregada · detalle del día con qué pastilla faltó y a qué hora se dio cada una · "Semana anterior" |
| HU-07 | Configurar inicio y fin de cada bloque (esposa o hijas) | HH:MM entre 00:00 y 23:59 · fin posterior al inicio · sin bloques superpuestos · muestra cuándo sonará cada aviso |
| TEC-01 | Accesibilidad | Flechas para moverse entre pastillas, Espacio marca/desmarca, Enter marca el bloque, Tab pasa de bloque · foco visible · ningún estado depende solo del color o del sonido · letra grande y contraste fijos |
| TEC-02 | Tratamiento de errores | Mensajes directos sin palabras técnicas · el programa no se cierra · si no se pueden leer los datos, se informa |

### Pantallas (7)
1 Hoy · 2 Aviso del bloque · 3 Bloque incompleto · 4 Confirmaciones · 5 Cambiar horarios · 6 Configuración de medicamentos · 7 Historial.

### Reglas de negocio
- Dos bloques: Mañana 08:00–12:00 y Noche 20:00–23:00 (Sprint 3), configurables.
- Tres avisos por bloque: inicio, mitad (calculada) y cierre → 08:00 / 10:00 / 12:00 y 20:00 / 21:30 / 23:00.
- Una pendiente marcada después del cierre queda "tarde" con la hora real.
- Se impide registrar dos veces lo mismo; se informa la hora del registro anterior.
- Orden dentro del bloque: pendientes arriba en su orden original; registradas al final sin desordenar las demás (stable partition). Al desmarcar vuelve a su lugar.
- Mismo medicamento permitido en bloques distintos; repetido solo se rechaza dentro del mismo bloque.
- Mensajes literales definidos en el Sprint 2 (se respetan los textos).

## 2. Contradicciones y ambigüedades detectadas, y cómo se resolvieron

| # | Tema | Sprints | Prompt maestro | Decisión |
|---|------|---------|----------------|----------|
| 1 | Plataforma | C++ / Win32, archivo de texto | Web local React + Express + SQLite | Se sigue el prompt maestro (pedido explícito más reciente). Las clases del dominio de Sprint 3 se respetan como servicios del backend; las excepciones se mapean a errores de dominio con los mismos mensajes. |
| 2 | Quién usa la app | Usuaria principal: esposa cuidadora que da la medicación al beneficiario (que no usa la app); hijas secundarias | "Persona mayor" registra sus tomas; familiar supervisa | La cuenta **Persona mayor** es la cuenta principal del perfil de medicación (sirve tanto si la persona registra sus propias tomas como si lo hace la cuidadora que vive con ella). La cuenta **Familiar** corresponde a las hijas. |
| 3 | Quién carga medicamentos | Hijas (HU-04) y horarios esposa e hijas (HU-07) | Familiar solo lectura; no edita medicamentos ni horarios | Se sigue el prompt maestro: solo la cuenta Persona mayor modifica. El familiar ve medicamentos, horarios e historial sin controles de edición, validado en el backend. Se documenta como cambio respecto del Sprint 3. |
| 4 | Usuarios con contraseña / varios pacientes | Fuera de alcance (Sprint 1) | Obligatorio | Se sigue el prompt maestro. |
| 5 | Largo de la etiqueta | 20 letras (Sprint 2) | 25 caracteres | 25 contando espacios (Sprint 3 y prompt coinciden). |
| 6 | Bloque noche | 18:00–22:00 (Sprint 1) | 20:00–23:00 | 20:00–23:00 (Sprint 3). |
| 7 | "No entregada" | Estado del historial sin regla de cómo se produce | No convertir pendientes automáticamente | Solo existe "No tomada" si la persona lo registra explícitamente (botón "No la tomó" o "Confirmar igual" en Bloque incompleto, que lo explica antes). Un pendiente de un día pasado se muestra como **"Sin registrar"**, distinto de "No tomada". |
| 8 | Confirmar un bloque incompleto | "¿Confirmar igual?" sin definir qué pasa con lo que falta | No asumir que cerrar un bloque es haberlo tomado | "Confirmar igual" registra las faltantes como **No tomada** y el diálogo lo dice antes de confirmar. La opción destacada es "Volver y marcar". |
| 9 | Cerrar con la X / minimizar | Win32: minimiza y sigue avisando; "Salir del programa" pide confirmación | Web local | Un navegador no puede seguir avisando cerrado. Al cerrar sesión la persona mayor ve "Si sale, no va a recibir los avisos. ¿Salir igual?". Los avisos funcionan con la pestaña abierta (aunque esté en segundo plano). Limitación documentada. |
| 10 | Desmarcar | Libre, sin confirmación | El historial no se debe destruir | Desmarcar anula el registro (no lo borra): queda en el registro de eventos, y el estado vuelve a pendiente. |
| 11 | Cambios de medicación vs. historial | No definido | Conservar historial | Cada día tiene un plan congelado (`plan_items`) con nombre, dosis, etiqueta y horario de ese día. Editar o eliminar un medicamento solo cambia el día de hoy en adelante. Eliminar = desactivar. |
| 12 | Registrar días anteriores | No definido | — | Solo se registra el día de hoy (no se reescribe el pasado). |
