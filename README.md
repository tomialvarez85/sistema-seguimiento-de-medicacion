# Pastillero digital

Aplicación web **local** para organizar la medicación diaria de una persona mayor y registrar cada toma,
con una cuenta separada para que familiares o cuidadores **supervisen sin modificar**.

Implementa los requisitos de los Sprints 1, 2 y 3 del TP2 (Programación Genérica y Eventos). El análisis
de los documentos, las contradicciones encontradas y cómo se resolvió cada una están en
[docs/ANALISIS.md](docs/ANALISIS.md).

> La aplicación solo registra y recuerda lo que indicó el médico. No calcula dosis ni sugiere medicamentos.

---

## 1. Requisitos

- **Node.js 22.13 o superior** (probado con Node 24.16). Usa el módulo SQLite que trae Node (`node:sqlite`),
  así que no hace falta instalar ni compilar ninguna base de datos aparte.
- npm (viene con Node).
- Un navegador actual (Chrome, Edge o Firefox).

## 2. Instalación

Desde la carpeta del proyecto:

```bash
npm install
```

## 3. Ejecución

### Uso diario (datos reales)

```bash
npm run build
```

```bash
npm start
```

Abra **http://localhost:4173**. Los datos se guardan en `data/pastillero.sqlite` (se crea solo la primera vez).

### Desarrollo (con recarga automática)

```bash
npm run dev
```

Interfaz en **http://localhost:5173**, API en **http://localhost:3001/api**. Usa la misma base `data/pastillero.sqlite`.

### Demostración (datos de ejemplo, base separada)

```bash
npm run seed:demo
```

```bash
npm run demo
```

Abra **http://localhost:5173**. La demostración usa **otra base** (`data/demo.sqlite`): nunca toca la base real.
`seed:demo` no sobrescribe una base de demostración que ya tenga datos; para recrearla:

```bash
npm run seed:demo -- --reset
```

| Cuenta de demostración | Correo | Contraseña |
|---|---|---|
| Persona mayor | `marta@demo.local` | `demo-pastillero` |
| Familiar vinculada | `lucia@demo.local` | `demo-pastillero` |
| Familiar **sin** vincular (para probar el acceso denegado) | `sofia@demo.local` | `demo-pastillero` |

Son credenciales de prueba: **no las use como credenciales definitivas**. La demostración trae 9 medicamentos
(uno de ellos en los dos bloques), 7 días de historial con días completos, incompletos, con entregas tarde,
con pastillas no tomadas y un bloque sin registrar, y el día de hoy con tomadas, no tomadas y pendientes.

### Otros comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas del backend y del frontend |
| `npm run typecheck` | Revisión de tipos de TypeScript |
| `npm run db:init` | Crea la base y aplica migraciones pendientes (no borra datos) |

### Variables de entorno (opcionales)

Todas tienen valor por defecto; ver [.env.example](.env.example). Se definen en la terminal antes de iniciar
(por ejemplo `API_PORT=3005 npm run dev`). Las principales: `API_PORT` (3001), `DB_PATH`
(`../data/pastillero.sqlite`, relativo a `server/`), `SESSION_DAYS` (7), `LINK_CODE_HOURS` (48).

> **localhost** solo permite usar la aplicación desde la computadora donde se ejecuta. Para abrirla desde otra
> computadora o tablet de la casa habría que exponer los servidores en la red local (por ejemplo
> `vite --host` y escuchar en `0.0.0.0`) y agregar ese origen en `CLIENT_ORIGIN`. No viene configurado así
> por seguridad.

---

## 4. Cómo se usa

### Persona mayor

1. **Crear una cuenta** de tipo “Persona mayor”. Se crea su perfil de medicación con los horarios iniciales
   (mañana 8:00 a 12:00 y noche 20:00 a 23:00).
2. **Medicamentos**: cargar cada pastilla con nombre, dosis, bloque y, si quiere, “para qué es” (hasta 25 caracteres).
3. **Hoy**: marcar cada pastilla (clic o Espacio), “Marcar todo el bloque” (o Enter), o “No la tomó” (o N).
   “Terminar bloque” avisa si falta algo.
4. **Familia**: crear un código y dárselo al familiar.

### Familiar o cuidador

1. **Crear una cuenta** de tipo “Familiar o cuidador”.
2. **Vincular**: escribir el código, revisar a quién corresponde y confirmar.
3. **Panel de hoy**, **Historial** y **Medicamentos y horarios**: todo en solo lectura.

### Teclado en la pantalla Hoy (Sprint 3)

| Tecla | Acción |
|---|---|
| ↑ ↓ (o ← →), Inicio, Fin | Moverse entre las pastillas del bloque |
| Espacio | Marcar o desmarcar la pastilla |
| N | Registrar que no se tomó (pide confirmación) |
| Enter | Marcar todo el bloque |
| Tab | Pasar al bloque siguiente |
| Escape | Cerrar un diálogo |

---

## 5. Pantallas

| # | Pantalla (sprints) | Ruta | Quién |
|---|---|---|---|
| 1 | Hoy | `/hoy` | Persona mayor |
| 2 | Aviso del bloque | diálogo sobre cualquier pantalla | Persona mayor |
| 3 | Bloque incompleto | diálogo en Hoy | Persona mayor |
| 4 | Confirmaciones | diálogos y mensajes breves | Persona mayor |
| 5 | Cambiar horarios | `/horarios` | Persona mayor |
| 6 | Configuración de medicamentos | `/medicamentos` · `/supervision/:id/medicamentos` (lectura) | Persona mayor · Familiar |
| 7 | Historial | `/historial` · `/supervision/:id/historial` | Ambos |
| — | Panel de supervisión | `/supervision/:id` | Familiar |
| — | Familia (código y accesos) | `/familia` | Persona mayor |
| — | Vincular | `/vincular` | Familiar |
| — | Ingresar / Crear cuenta | `/ingresar`, `/registro` | Todos |

---

## 6. Reglas de negocio implementadas

Están en un único módulo, [server/src/services/reglas.ts](server/src/services/reglas.ts), que usan todas las pantallas.

- **Estados de una pastilla**: *Pendiente* (sin resultado), *Tomada* (con hora; *Tomada tarde* si se marcó después
  del cierre del bloque) y *No tomada* (solo si se registró explícitamente). En días pasados, lo que nadie registró
  se muestra como **Sin registrar**, distinto de *No tomada*.
- **El paso del tiempo no registra nada**: un pendiente sigue pendiente aunque termine el bloque; se indica
  “horario terminado” y, si se marca, queda como tarde con la hora real.
- **Estado del bloque**: Pendiente · Incompleto X de Y (X = tomadas) · Completo (con aviso si hubo entrega tarde) ·
  No tomado · Sin registrar.
- **Orden** (Sprint 3): pendientes arriba y registradas al final, sin desordenar el resto (partición estable).
  Al desmarcar, la pastilla vuelve a su lugar.
- **Desmarcar** es libre y sin confirmación (Sprint 2); el registro no se borra: queda anulado en el historial de eventos.
- **Bloque incompleto**: “Terminar bloque” con pendientes muestra lo que falta con el foco en “Volver y marcar”.
  “Confirmar igual” registra las faltantes como *No tomada* (el diálogo lo dice antes).
- **Duplicados**: un solo resultado vigente por pastilla y día (índice único parcial en SQLite); doble clic o
  reenvío responde “Esta pastilla ya se registró a las 8:15.” / “Este bloque ya se registró a las 8:15.”
  Un medicamento repetido solo se rechaza **dentro del mismo bloque** (sin distinguir mayúsculas, tildes ni espacios);
  el mismo medicamento puede estar en mañana y noche.
- **Horarios**: HH:MM, fin después del inicio, sin bloques superpuestos. Avisos al inicio, a la mitad y al cierre.
- **Historial conservado**: cada día guarda una copia de sus pastillas (nombre, dosis, etiqueta y horario de ese día).
  Editar o quitar un medicamento, o cambiar un horario, afecta desde hoy; los días anteriores no cambian.
  Quitar un medicamento lo desactiva, no lo borra.
- Solo se registran pastillas **del día de hoy**.
- Fechas y horas en la **zona horaria local** de la computadora donde corre el servidor.

### Avisos (HU-05) y límites del navegador

- Mientras la aplicación está abierta (aunque la pestaña esté en segundo plano), se consulta cada 30 segundos.
  Aviso 1 (inicio) siempre; aviso 2 (mitad) y 3 (cierre) solo si hay pendientes; si el bloque se completa, no hay más avisos.
- Cada aviso muestra una ventana con la lista de lo que falta, suena (Web Audio) y cambia el título de la pestaña.
  Si se activan los avisos del navegador, también aparece una notificación del sistema cuando la pestaña no está a la vista.
- Los avisos mostrados se anotan en la base para **no repetirlos** (también después de recargar).
- Un aviso **nunca registra una toma**.
- **Limitación**: un sitio web no puede avisar con el navegador cerrado, ni garantizar el sonido (el navegador
  lo permite después de la primera interacción con la página; el volumen depende del equipo). En el diseño de
  los sprints (Win32) el programa se minimizaba y seguía avisando; en la web, la alternativa es dejar la pestaña
  abierta. Por eso, al salir, la persona mayor ve: “Si sale, no va a recibir los avisos. ¿Salir igual?”.

---

## 7. Usuarios y permisos

La identidad que inicia sesión (`users`) está separada del perfil de medicación que se consulta (`perfiles`).
Cada solicitud a `/api/perfiles/:id/...` comprueba en el backend que la cuenta sea la titular del perfil o un
familiar vinculado; las modificaciones exigen ser titular. Ocultar botones en la interfaz es solo comodidad.

| Operación | Persona mayor (titular) | Familiar vinculado | Otra cuenta |
|---|---|---|---|
| Ver Hoy, medicamentos, horarios, historial | ✔ | ✔ (solo lectura) | ✘ 403 |
| Registrar tomada / no tomada, desmarcar, marcar o confirmar bloque | ✔ | ✘ 403 | ✘ 403 |
| Agregar, editar, quitar medicamentos | ✔ | ✘ 403 | ✘ 403 |
| Cambiar horarios | ✔ | ✘ 403 | ✘ 403 |
| Recibir avisos del bloque | ✔ | ✘ | ✘ |
| Crear código de vinculación, quitar familiares | ✔ | ✘ | ✘ |
| Vincularse con un código, desvincularse | ✘ | ✔ | — |

Seguridad:
- Contraseñas con **scrypt** y sal aleatoria; nunca en texto plano. Mensaje genérico ante credenciales incorrectas
  y límite de intentos de ingreso.
- Sesión en **cookie httpOnly** (`SameSite=Lax`) con un token aleatorio; en la base solo se guarda su hash.
  Vence a los 7 días y se invalida en el servidor al cerrar sesión.
- Las modificaciones se rechazan si vienen de otro sitio (control de `Origin`).
- Vinculación: código aleatorio de 8 caracteres, **de un solo uso**, vence a las 48 h, se anula al crear otro;
  límite de intentos fallidos; no alcanza con conocer el nombre o el correo. Sin vínculos duplicados (restricción única).
  Un familiar puede supervisar a varias personas y una persona puede tener varios familiares.
- Un perfil ajeno responde siempre lo mismo (403), exista o no, sin revelar datos.

---

## 8. Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite, React Router, CSS Modules + hoja de diseño con variables, íconos lucide-react, tipografía Atkinson Hyperlegible (incluida localmente) |
| Backend | Node.js + TypeScript + Express 5, API REST |
| Base de datos | SQLite (`node:sqlite`), migraciones versionadas, claves foráneas, restricciones e índices únicos |
| Pruebas | Vitest + Supertest (API) y Testing Library (interfaz) |

```
├── client/                  React
│   └── src/
│       ├── components/      BloqueCard, Dialog, AvisoWatcher, MedicamentoForm, Estado, Toasts…
│       ├── pages/           Hoy, Medicamentos, Horarios, Historial, Familia, Supervisión, Vincular, Ingreso
│       ├── layouts/         Encabezado y navegación según el rol
│       ├── context/         Sesión
│       ├── services/        Comunicación con la API
│       ├── lib/             Formatos, sonido, carga de datos
│       ├── styles/          Variables de diseño, base y componentes
│       ├── types/           Tipos compartidos del frontend
│       └── test/            Pruebas de interfaz
├── server/                  Express
│   ├── src/
│   │   ├── routes/          Definición de la API y qué middleware protege cada ruta
│   │   ├── controllers/     Traducción HTTP ↔ servicios
│   │   ├── services/        Lógica de negocio (reglas.ts = fuente única de reglas)
│   │   ├── middleware/      Autenticación, acceso al perfil, origen, errores
│   │   ├── repositories/    Consultas SQL
│   │   ├── database/        Conexión, migraciones, inicialización y datos de demostración
│   │   ├── lib/             Reloj, fechas, errores del dominio
│   │   └── types/
│   └── tests/               Pruebas de reglas y de la API
├── data/                    Archivos SQLite (no se suben al repositorio)
└── docs/ANALISIS.md         Análisis de los sprints
```

Correspondencia con el diseño técnico del Sprint 3: las clases `Medicamento`, `Bloque`, `Registro`, `Historial` y
`GestorAvisos` son los servicios del backend; la jerarquía `PastilleroException` es `AppError` y sus subclases
(`DatoInvalidoError`, `RegistroDuplicadoError`, etc.), con los mismos mensajes; `std::stable_partition` es
`ordenarPendientesPrimero`; el archivo de texto se reemplazó por SQLite.

### Base de datos

| Tabla | Para qué |
|---|---|
| `users` | Cuentas (nombre, correo único, hash de contraseña, rol `mayor`/`familiar`) |
| `sessions` | Sesiones activas (hash del token, vencimiento) |
| `perfiles` | Perfil de medicación de cada persona mayor (1 por cuenta titular) |
| `vinculos` | Familiar ↔ perfil (único por par) |
| `codigos_vinculacion`, `intentos_vinculacion` | Códigos de un solo uso y control de intentos |
| `bloques` | Horario de mañana y noche de cada perfil (`fin > inicio`) |
| `medicamentos` | Nombre, dosis, etiqueta (≤ 25), bloque, orden, activo; único por nombre normalizado **dentro del bloque** |
| `plan_dias`, `plan_items` | Copia de las pastillas que correspondían cada día (el historial no cambia al editar) |
| `tomas` | Resultado registrado: tomado/no tomado, tarde, hora, fecha y hora reales, quién, origen, anulación. Índice único parcial: un resultado vigente por pastilla y día |
| `eventos` | Registro de lo que pasó (tomas, desmarcadas, cambios de medicamentos y horarios, vínculos) |
| `avisos_mostrados` | Qué avisos ya se mostraron, para no repetirlos |
| `schema_migrations` | Migraciones aplicadas |

---

## 9. Pruebas

```bash
npm test
```

Resultado de la última ejecución: **backend 49 de 49** y **frontend 13 de 13** pruebas aprobadas.

| Requisito del pedido | Dónde se prueba |
|---|---|
| 1–7 Usuarios y permisos | `server/tests/api.test.ts` › “Usuarios y permisos” (incluye código de un solo uso, vencido, vínculo duplicado, varios familiares, varias personas, sesión vencida, cierre de sesión, origen ajeno) |
| 8–14 Medicación | `api.test.ts` › “Medicación” y `server/tests/reglas.test.ts` (estados, orden, tarde, paso del tiempo, duplicados, avisos) |
| 15–20 Historial y persistencia | `api.test.ts` › “Historial y persistencia” y “19. persistencia después de reiniciar el backend” (cierra y reabre el archivo SQLite) |
| 21 Botones principales | `client/src/test/BloqueCard.test.tsx` |
| 22 Errores de formularios | `client/src/test/MedicamentoForm.test.tsx` |
| 23 Confirmaciones | `client/src/test/HoyPage.test.tsx` (bloque incompleto, no tomada, repetido, error al guardar, nada se muestra como guardado antes de que responda el backend) |
| 24 Teclado | `BloqueCard.test.tsx` (flechas, Espacio, Enter, N, una parada de Tab por bloque) |
| 25 Computadora y tablet | Revisión manual en el navegador a 1024, 768 y 375 px sin desplazamiento horizontal (ver abajo) |

Verificación manual realizada en el navegador con la demostración: ingreso, marcar/desmarcar con teclado,
entrega tarde, bloque incompleto (foco en “Volver y marcar”), marcar todo, registro repetido, no tomada,
validaciones de medicamentos (vacíos, 26 caracteres, repetido con “Editar el existente”), quitar medicamento,
horarios (formato, superposición, guardado), historial y detalle, código de vinculación, acceso denegado a un
perfil no vinculado (interfaz y API), vinculación, panel de supervisión sin controles de edición, rechazo de
escrituras del familiar en la API, aviso del bloque (“Ir a marcar” y que no se repita) y salida con confirmación.

---

## 10. Limitaciones conocidas

- **Avisos**: solo con la aplicación abierta en el navegador (ver sección 6). No hay avisos a distancia a los
  familiares (fuera de alcance en el Sprint 1).
- **Una computadora**: pensado para `localhost`; usarlo desde otros equipos requiere configurar la red.
- **Cambio de contraseña y recuperación de cuenta**: no implementados (no estaban en los sprints).
  Si se olvida una contraseña, hoy no hay forma de recuperarla desde la aplicación.
- **Letra y contraste fijos** (decisión del Sprint 3): no se adaptan a alguien que necesite letra aún más grande;
  queda el zoom del navegador (Ctrl +).
- **Registro de días anteriores**: no se puede registrar una toma de un día que ya pasó; queda “Sin registrar”.
- Si la computadora estuvo apagada varios días, al volver a abrir la aplicación esos días se arman con la
  configuración que estaba vigente (que es la última guardada), y quedan “Sin registrar”.
- La versión para celular estaba fuera de alcance; la interfaz se adapta a pantallas chicas, pero se revisó
  principalmente en computadora y tablet.
