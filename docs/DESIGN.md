# XP Pylon Racer — Documento de diseño

> Versión 0.1 · 2026-10-24 · en definición con Juan. Nombre provisional.
> Hermana de [Pylon Racer](https://github.com/jlgabriel/afs4-pylon-racer) (Aerofly FS4, 1.0.1) y
> heredera de la disciplina de [XOP](https://github.com/jlgabriel/xp12-object-placer).
> Qué viene de cada una, y qué se rechaza a propósito: [LINEAGE.md](LINEAGE.md).

---

## 0. Estado (2026-10-24, v0.1, sin vuelo)

Juan pidió avanzar todo lo posible sin prueba de vuelo. **La app completa está portada y corre**:
diseñador, carrera en vivo, ranking por clase, compartir `.pylonrace`, demo, e instalación del pack
en X-Plane. Typecheck, 271 tests unitarios (con la lectura de vuelta por DSFTool) y 3 e2e sobre
Electron en verde. La instalación se probó
de punta a punta contra una carpeta de X-Plane desechable, y DSFTool lee los DSF que escribe la app,
incluido uno de una pista que cruza dos tiles.

**Lo que es supuesto hasta que vuele H0–H2** (todo está aislado en un solo lugar para corregirlo):

| Supuesto | Dónde vive | Lo confirma |
|---|---|---|
| RPOS llega a ~40 Hz con los campos y signos del documento de Laminar | `src/core/telemetry/rpos.ts` | H0 |
| La Web API responde en `/api/v3` (o v2/v1) y da `acf_ICAO` | `src/core/telemetry/webapi.ts`, `src/main/telemetry.ts` | H0 |
| X-Plane carga `OBJECT_DEF` relativos al pack, con textura PNG | `src/core/export/pack.ts` | H1 |
| Los pilones se ven apoyados en el suelo, con su pintura | `src/core/pylon/` | H1 |
| La posición de RPOS y la de los pilones coinciden al metro | — | H2 |
| Qué manda X-Plane en el menú, en pausa y tras un choque | `isNullIsland`, el motor (`STILL_S`) | H0 |

---

## 1. Qué es

Pylon Racer para **X-Plane 12**: una app de escritorio que es a la vez

- **un creador de pistas de pilones**: diseñas el circuito sobre un mapa y la app lo instala en
  X-Plane como un scenery pack con un clic;
- **un juego de carreras**: sigue tu vuelo en vivo, aplica las reglas, cronometra, guarda cada
  carrera y te da un ranking por clase de avión entre los pilotos de este computador.

El ciclo es el mismo de Pylon Racer: **diseñar o abrir una pista → instalarla → volar → ver el
resultado → reintentar.** Lo que cambia es todo lo que toca al simulador.

---

## 2. Decisiones

| # | Decisión | Por qué |
|---|----------|---------|
| D1 | **App aparte, no un "modo X-Plane" dentro de Pylon Racer** (Juan, 2026-10-24). | Igual que XOP respecto de PCT (XOP D1): cada app habla el idioma de su simulador desde el primer commit, y la 1.0 de Aerofly ya publicada no se ensucia con ramas `if (xplane)`. |
| D2 | **Nombre provisional: XP Pylon Racer**, repo `jlgabriel/xp12-pylon-racer`, privado hasta que funcione. | Sigue el patrón de XOP (`xp12-object-placer`, "XP Object Placer"). Juan confirma el nombre antes de publicar. |
| D3 | **Vocabulario de X-Plane desde el primer commit**: pack, DSF, OBJ8, dataref, RPOS. | Nada de POI, `.tsl`, `autoheight` ni carpetas `<coord>_pr_`: son conceptos de Aerofly (LINEAGE). |
| D4 | **GPL-3.0-or-later.** | Permite copiar código de Pylon Racer y de XOP (mismo autor, misma licencia). |
| D5 | **Cero assets de terceros. Los pilones los genera la app** (OBJ8 + PNG propios, `src/core/pylon/`). | Los Reno de krzysk1 y los de Rodeo son `.tmb` de Aerofly: no sirven en X-Plane, y el permiso de Rodeo fue para Pylon Racer. Un pilón generado tiene altura y radio **exactos**, que es justo lo que pide la regla de "pilón tocado". Si un artista ofrece un pilón OBJ8 más adelante, se suma sin cambiar el modelo. |
| D6 | **Sondear antes de diseñar** (XOP D6). | Cada dato duro del sim se mide con una sonda que no puede salir bien por casualidad (control positivo). Las sondas de la v0.0 están en `probes/`. |
| D7 | **Mismo formato de pista `.pylonrace`.** Una pista hecha en una app se abre en la otra. | Es lo único que cruza entre los dos simuladores. Los ids de pilón de Aerofly (`red`, `rodeo-reno`…) se traducen a un pilón generado del mismo color y rol; ninguno se pierde. |
| D8 | **Rankings separados por simulador.** Ni se importan ni se comparan tiempos de Aerofly. | Física, terreno y tasa de datos distintos: un tiempo de AFS4 y uno de X-Plane no miden lo mismo. |
| D9 | **Heredadas de Pylon Racer sin reabrir:** sin servidor; app individual (se comparten sólo pistas); sin medallas, fantasma ni sonido; UI en inglés y docs en español con "tú"; diseño sobre tokens. | Decisiones de Juan del 2026-10-24 para Pylon Racer. |
| D10 | **Heredadas de XOP sin reabrir:** el DSF binario lo escribe la app, sin DSFTool (XOP D10); la línea de `scenery_packs.ini` la escribe el instalador, con respaldo (XOP D8); instalar y desinstalar con X-Plane cerrado (XOP D16); el instalador sólo toca carpetas propias con marcador. | Medido y publicado en XOP 1.0–1.4. |
| D11 | **Cada modelo de pilón sabe su altura; el `pylonHeightM` de la pista no se usa** (sigue en el formato, por compatibilidad). El diseñador ya no lo muestra. | Pilones generados. Consecuencia: la **revisión** de una misma pista es distinta en cada app (la altura entra en cómo se puntúa), lo que calza con D8. |
| D12 | **Clase de avión por código ICAO** (`acf_ICAO`), sin distinguir mayúsculas. La tabla se leyó de los `.acf` de la instalación 12.4.3 de Juan, nunca de memoria. | En X-Plane no hay ids de carpeta fijos. Un avión desconocido: el piloto elige la clase, recordada por su código. |
| D13 | **X-Plane se encuentra solo** (primera instalación usable de `x-plane_install_12.txt`); el piloto puede elegir otra. Los e2e usan `XPR_XPLANE_DIR` para no tocar nunca un X-Plane real. | Código de XOP (`findInstallations`). |
| D14 | **Pendiente para Juan:** las dos apps registran `.pylonrace`; con ambas instaladas, el doble clic abre la que se instaló última. Ambas importan el archivo igual. | Alternativa: que esta app no registre la extensión. |

---

## 3. Integración con X-Plane 12

### Datos del vuelo: tres puertas, a medir en H0

| | **RPOS** (UDP 49000) | **Web API** (WebSocket 8086) | **Puerto 49002** |
|---|---|---|---|
| Fuente | `Instructions/Exchanging Data with X-Plane.rtfd` (en la instalación) | developer.x-plane.com, "X-Plane Web API" | sin documentar para X-Plane 12 |
| Versión | todas | **12.1.1+** | — |
| Tasa | **la que pidas** (`RPOS\0` + `"40\0"`); tope: los FPS del sim | **10 Hz** según Laminar, y sólo los valores que cambian | ? |
| Posición | lon/lat/elevación en **double** | double (JSON) | ? |
| Altura | **AGL real** (`y_agl_mtr`) | `y_agl` | ? |
| Actitud | pitch, **rumbo verdadero**, roll (float, grados) | `true_theta/psi/phi` | ? |
| Velocidad | vx este, vy arriba, vz **sur** (m/s) + velocidades angulares | `groundspeed`, `hpath` | ? |
| Avión | **no** | `acf_ICAO`, `acf_relative_path`, `acf_ui_name` | ? |
| Requiere | nada; no desactivar el tráfico entrante | no marcar "Disable Incoming Traffic" en Settings › Network | una opción en Settings › Network, si existe |

**Hipótesis (a confirmar en H0):** RPOS a 40 Hz alimenta la carrera, igual que la DLL en Aerofly,
y la Web API se consulta una vez por vuelo para saber qué avión es. Si RPOS entrega cerca de 40 Hz,
X-Plane queda mejor servido que Aerofly por UDP (4,9 Hz) y sin instalar nada.

Lecciones de Aerofly que la sonda verifica sola (`probes/H0/analyze.ts`), sin depender de que
alguien mire una flecha:

- **El rumbo es un rumbo de brújula, no un ángulo matemático.** En Aerofly la DLL entregaba
  `90 − rumbo` y lo cazó Juan en KDAG (2026-10-18). Aquí se compara contra el track que dibujan las
  propias posiciones, y contra la lectura alternativa.
- **Roll positivo = ala derecha abajo**, comprobado contra el sentido en que gira el track.
- **vz apunta al sur**, como dice el documento (los ejes de OBJ8 también: XOP lo verificó).
- **Qué pasa en el menú y en pausa** (en Aerofly, posición 0,0 en el menú: `isNullIsland`).
- **Jitter de llegada:** RPOS no trae la hora del sim. El hub fecha cada muestra con el reloj
  monotónico del main, como en Pylon Racer. H0 mide cuánto bailan los intervalos.

### Escenario: un pack por pista

```
Custom Scenery/XPR_<slug>/
  objects/pylon_<color>.obj + .png     generados, sólo los colores que usa la pista
  Earth nav data/<bloque>/<tile>.dsf   uno por tile tocado (groupByTile de XOP)
  pylon-racer.json                     marcador: el instalador sólo toca carpetas con él
```

- **Sin elevación:** un `OBJECT` de DSF se apoya en la malla que tenga debajo (XOP,
  `reference/dsf-overlay.md`). No hace falta Open-Meteo para plantar pilones.
- `OBJECT_DEF` con ruta **relativa al pack** (`objects/pylon_red.obj`). XOP sólo escribió rutas de
  librería; el DSF de la sonda H1 ya pasó por DSFTool sin errores, falta que X-Plane lo vuele.
- El prefijo `XPR_` es provisional (lo usa la sonda).

### Altura y terreno

Con RPOS el AGL viene **del sim**: la ventana de altura se juzga contra el terreno real de X-Plane,
sin el margen DEM-contra-sim que Aerofly obligaba a tener. Open-Meteo queda, como mucho, para
mostrar el relieve en el diseñador.

### Clases de avión

En X-Plane no hay ids de carpeta fijos como en Aerofly: cualquiera instala cualquier `.acf`. La
tabla de clases se arma con **`acf_ICAO`** (C172, PTS2, E330…), con los valores **reales** que
entregue H0 y nunca escritos de memoria (regla de PCT). Un avión desconocido: el piloto elige la
clase y queda recordada por `acf_relative_path`. Ese flujo ya existe en Pylon Racer.

---

## 4. Arquitectura

Igual que Pylon Racer (Electron + TS + React 19 + Zustand 5 + zod, electron-vite, Node 24):

- `src/core/` puro y testeable. **Se porta de Pylon Racer:** `course/` (modelo, revisión FNV,
  `raceSequence`, ediciones), `race/` (cruce de segmentos, interpolación, reglas), `run/`,
  `session/`, `ranking/` (salvo `classes.ts`), `demo/`. **Se copia de XOP:** `dsf/`, `geo/` (ya
  está), `airports/` (búsqueda en el `apt.dat` del usuario). **Nuevo:** `pylon/` (OBJ8 + PNG, ya
  está), `telemetry/rpos.ts` y `telemetry/webapi.ts`, `export/pack.ts` (plan puro del pack).
- `src/main/`: `ipc.ts` como única frontera, hub de telemetría con reloj monotónico, controlador de
  carrera; **de XOP:** `installPack`, `sceneryPacksIni`, `findInstallations` (lee
  `x-plane_install_12.txt`, que en este computador lista tres instalaciones).
- `src/renderer/`: el de Pylon Racer, tokens y todo; cambian los textos que nombran a Aerofly.

---

## 5. Plan de versiones

| Versión | Qué | Estado (2026-10-24) |
|---|---|---|
| v0.0 | Este documento + sondas H0–H2 | ✅ hecho; **falta el vuelo de Juan** |
| v0.1 | Core portado de Pylon Racer + fuente RPOS | ✅ código y tests; el demo corre |
| v0.2 | Diseñador + instalación del pack | ✅ código, tests y e2e; falta verlo en X-Plane (H1) |
| v0.3 | Carrera en vivo + ranking por clase | ✅ código; falta la primera carrera en el sim |
| v0.4 | Abrir `.pylonrace` de Pylon Racer | ✅ mismo formato, mismos ids de pilón, mismas pistas de ejemplo |
| 1.0 | Pulido, release | Cuando H0–H2 y una carrera real salgan bien. Mismo ciclo que XOP y PCT |

Después del vuelo, lo que quede de las sondas se corrige en los lugares de la tabla del §0, y la
primera carrera de verdad es la Munich Sprint o la Daggett Sprint (rectas, fáciles de leer).

---

## 6. Lo que hay que medir antes de diseñar en detalle

| Pregunta | Sonda |
|---|---|
| ¿A qué tasa llega RPOS de verdad, en vuelo y en el menú? ¿Cuánto bailan los intervalos? | H0 |
| ¿Rumbo de brújula? ¿Signo del roll? ¿vz al sur? | H0 (automático) |
| ¿Qué dice la Web API del avión? ¿A qué tasa? ¿Qué llega al 49002? | H0 |
| ¿Qué pasa con RPOS en pausa y en el menú? | H0 |
| ¿Carga un DSF con `OBJECT_DEF` relativo al pack? ¿Se ven los pilones, con su pintura y apoyados en el suelo? ¿Desde qué distancia? | H1 |
| ¿Las posiciones de RPOS y los pilones del DSF son el mismo mundo, al metro? | H2 |

Todo cabe en **un vuelo de unos 15 minutos**: [probes/README.md](../probes/README.md).
