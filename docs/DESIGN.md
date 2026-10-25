# XP Pylon Racer — Documento de diseño

> Versión 1.1 · 2026-10-25 · volada · publicada.
> Hermana de [Pylon Racer](https://github.com/jlgabriel/afs4-pylon-racer) (Aerofly FS4, 1.0.1) y
> heredera de la disciplina de [XOP](https://github.com/jlgabriel/xp12-object-placer).
> Qué viene de cada una, y qué se rechaza a propósito: [LINEAGE.md](LINEAGE.md).

---

## 0. Estado (2026-10-25, v1.1: volada y publicada)

**1.1.0, 2026-10-25.** La 1.0 más la *Queenstown Lake Race* como novena pista incluida y
**Export to Shirley…** (abajo, ambas voladas el mismo día). Tag `v1.1.0`, mismo workflow.

**1.0.0, publicada el 2026-10-25.** Tag `v1.0.0`; el workflow `release.yml` armó los cinco
instaladores (Windows setup y portable, macOS x64 y arm64, AppImage) y el release
[XP Pylon Racer 1.0.0](https://github.com/jlgabriel/xp12-pylon-racer/releases/tag/v1.0.0) se
publicó a pedido de Juan. Juan la subió a X-Plane.org (Downloads › Utilities):
[XP Pylon Racer](https://forums.x-plane.org/files/file/102104-xp-pylon-racer/).

La 1.0 es la 0.2 más los pilones altos (D15), sin cambios de comportamiento desde el último vuelo.
Juan confirmó el nombre (D2) y que esta app también registra `.pylonrace` (D14), y el README pasó a
ser la guía de la 1.0: instalación de un build sin firmar en cada sistema, tamaño de pilones, RPOS a
~30 Hz y cómo se comparte una pista Tall con Pylon Racer. Typecheck, 287 tests unitarios (284 sin
DSFTool: 3 son la lectura de vuelta), 3 e2e y los builds de Windows en verde; la app empaquetada
abre como "XP Pylon Racer 1.0.0".

Lo que sigue es cómo se llegó.

### Hasta la 0.2

La app completa está portada: diseñador, carrera en vivo, ranking por clase, compartir
`.pylonrace`, demo e instalación del pack. Typecheck, 271 tests unitarios (con la lectura de vuelta
por DSFTool) y 3 e2e sobre Electron en verde.

**El mismo día Juan voló las sondas y una carrera real.** Todo lo que era supuesto quedó confirmado
sin cambiar una línea de la app (detalle en cada `probes/H*/FLIGHT.md`):

| Supuesto | Dónde vive | Resultado |
|---|---|---|
| RPOS con los campos y signos del documento de Laminar | `src/core/telemetry/rpos.ts` | ✅ rumbo de brújula, vz al sur, roll + = derecha, pitch + = arriba. **~29,5 Hz**, no 40 (H0) |
| La Web API da `acf_ICAO` | `src/core/telemetry/webapi.ts`, `src/main/telemetry.ts` | ✅ REST en `/api/v3`; el Vertigo dice `Extra` → Aerobatic (H0) |
| X-Plane carga `OBJECT_DEF` relativos al pack, con textura PNG | `src/core/export/pack.ts` | ✅ sin errores en `Log.txt` (H1) |
| Los pilones se ven apoyados en el suelo, con su pintura | `src/core/pylon/` | ✅ capturas y replay (H1) |
| La posición de RPOS y la de los pilones coinciden al metro | — | ✅ tres puertas, lado y medida coinciden con el replay (H2) |
| Qué manda X-Plane en el menú y en pausa | `isNullIsland`, el motor (`STILL_S`) | menú: nada; pausa: posición congelada a 30 Hz (H0) |

**Primera carrera:** Daggett Sprint, instalada por la app, en KDAG con el Extra. **29,13 s, limpia**:
las cinco pasadas a menos de 6 m del centro, entre 10 y 20 m de altura, y una carrera guardada con
`source: rpos 30 Hz` y la clase Aerobatic.

**Lo que dejó el vuelo, resuelto en la 0.2** (typecheck, 280 tests y 3 e2e en verde; volada el mismo día, abajo):

1. **RPOS compartido.** RPOS tiene un solo suscriptor: X-Plane lo manda sólo al último que lo pidió.
   `src/core/telemetry/rposShare.ts` (puro, `tests/rposShare.test.ts`) reconoce la pelea por su firma:
   el flujo se corta y vuelve **justo después de nuestra petición** (X-Plane estaba sirviendo, pero a
   otro). Dos de esas "tomas" en 40 s = otro programa pide RPOS. Un tirón o una carga de escenario
   vuelven solos, el menú no contesta y un sim reiniciado contesta una sola vez: ninguno cuenta.
   Mientras dura, la app **espacia sus peticiones** (2 → 4 → 8 → 10 s), así el otro programa funciona
   casi siempre (simulado: recibe el 80 % del flujo en vez de la mitad) y la app vuelve a pedir de vez
   en cuando para recuperar RPOS cuando el otro se cierre (~15 s en la simulación). 10 s de flujo sin
   cortes lo despejan. La UI lo dice en la píldora (*X-Plane RPOS taken*), en "Flight data" y en la
   línea de estado.
2. **Replay.** El hub lee `sim/time/is_in_replay` por la Web API REST cada 250 ms (el avión, cada
   5 s) y no pasa fixes al motor mientras vale 1. La UI dice *Replay: not racing*. Sin Web API, todo
   pasa como en la 0.1. Si se cuela algún fix del replay antes de verlo, el motor ya trata el salto
   como DNF "reset".
3. El WebSocket de la Web API sólo abre en `/api/v1` en 12.4.3. La app no lo usa; la grabadora ya
   lo sabe.

**Medido el 2026-10-24 con X-Plane 12.4.3 abierto, para la 0.2** (sin volar: el sim estaba en replay):

| Pregunta | Respuesta |
|---|---|
| ¿Qué dataref dice "replay"? | `sim/time/is_in_replay`: int, **sólo lectura**, valía 1 en replay. `sim/operation/prefs/replay_mode` también existe, pero es escribible y es un enum (valía 7): no sirve de booleano. Ids de la Web API ~1,6e12 (caben en un double). |
| RPOS con dos sockets | El segundo que pide se lo queda entero (75 paquetes en 2 s contra 0). |
| ¿Un `RPOS 0` de quien no es dueño? | **Corta el flujo del dueño.** Por eso la app (y la grabadora H0) sólo piden 0 al cerrar si el flujo les está llegando. |
| ¿RREF admite varios suscriptores? | **Sí**: dos sockets pidiendo `sim/flightmodel/position/latitude` a 20 Hz reciben ~19 Hz cada uno, y el 0 de uno no corta al otro. |

**Volada el 2026-10-24** (X-Plane 12.4.3, KDAG, Extra de Vertigo, la 0.2 corriendo con `npm run dev`;
log de la app y corrida H0 `runs/2026-10-25T02-32-07`, local):

| Prueba | Resultado |
|---|---|
| Carrera normal | Daggett Sprint, **29,02 s** limpia (la 0.1: 29,13 s). |
| Otro programa pidiendo RPOS (`npm run probe:listen`) | *RPOS taken* **7 s** después de que arrancó la grabadora. |
| Backoff | Funciona, pero rinde menos que en la simulación: la grabadora tuvo RPOS **6,4 s de cada ~10 (63 %)**, no el 80 %, porque tarda ~4 s en volver a pedirlo (revisa cada 2 s si lleva 2 s callada). Se deja el máximo en 10 s (Juan): subirlo a 20 s daría ~80 % pero hasta ~30 s para recuperar RPOS. |
| Al cerrar la grabadora | La app recupera RPOS en ~2 s y despeja el aviso a los ~12 s. |
| Replay | Detectado al entrar; el replay pasó por las puertas y **no se guardó ninguna carrera**; la pantalla muestra *Replay: not racing* y los valores de vuelo en "—". |
| Al salir del replay | "X-Plane is flying again": la app vuelve a seguir el vuelo y a quedar armada. |
| Ids de la Web API | Cambian en cada sesión de X-Plane (1626080912064 → 3170083268528 para `is_in_replay`): bien que el hub los busque por nombre. |

### Después de la 0.2: pilones altos, volados el 2026-10-25

Juan: el tamaño actual está bien, pero
en un sim cuesta verlos. Cada pista elige ahora el tamaño de sus pilones en el diseñador (*Pylons*:
Standard o Tall ×2), todos a la vez; decisión D15. Typecheck, 287 tests y 3 e2e en verde (el e2e del
diseñador cambia a Tall, reinstala y revisa que el pack lleve `pylon_*_tall.obj` de 30 m).

| Prueba (KDAG, Extra de Vertigo, `npm run dev`) | Resultado |
|---|---|
| Reinstalar la Daggett Sprint en Tall | El pack trae sólo `pylon_{blue,green,home,red}_tall`: 30 m × 2,4 m de radio y 50 m × 4 m la meta; el DSF apunta sólo a ellos. Sin errores en `Log.txt`. |
| Verlos en el sim | "Muy buen tamaño" (Juan). |
| Ranking | Revisión nueva (`3959655537af3ac1`): la carrera abrió su propio ranking, aparte de los 29,02 s en Standard. |
| Pilón tocado | 41,93 s: 35,93 de vuelo y dos toques. Puerta 3 a 4,3 m del centro y puerta 4 a **5,73 m**, que sólo es toque con el radio de Tall (6,2 m; en Standard serían 5 m). Los dos fueron a 12–15 m de altura, también bajo un pilón Standard, así que la altura nueva (30 m) no quedó separada de la vieja en este vuelo. |

### Después de la 1.0: la primera pista sobre agua, volada el 2026-10-25

La *Queenstown Lake Race* (9 puertas, Tall, sobre el lago Wakatipu cerca de NZQN) la diseñó ChatGPT
y Juan la importó desde Descargas con la 1.0.0 portable. Antes de volarla Juan corrió el viraje g5
~335 m al suroeste: en la posición original quedaba a ~400 m de la orilla este, con la ladera a
+30–60 m sobre el lago (elevaciones de Open-Meteo), y pasar por el este con un radio de ~400 m
podía sacar al avión sobre ella.

| Prueba (Extra de Vertigo, la 1.0.0 portable) | Resultado |
|---|---|
| Pack sobre agua | El DSF `-46+168` carga sin errores en `Log.txt` (0 tris: sólo objetos). |
| Verlos sobre el lago | Apoyados en la superficie, ni hundidos ni flotando, con su reflejo en el agua: captura del replay en la meta, los dos `home` Tall de 50 m. |

Pasó a ser la novena pista incluida (`sampleCourses.ts`, sólo en esta app), tal como Juan la voló:
misma revisión (`4e1a66db22f68f91`), así la carrera de arriba sigue en su ranking. Conserva el id
`queenstown-lake-race-01` del archivo compartido, y la copia que Juan importó toma el texto nuevo
al abrir la app (su sello va en `SAMPLE_EARLIER_STAMPS`).
| Altura sobre el suelo en el lago | La AGL de RPOS se mide **desde la superficie del agua**: `altMslM − aglM` = 311,0 m en las nueve pasadas (el lago, 310 m). Las ventanas de altura sirven sobre agua. |
| Carrera | **2:44,71**: 2:42,71 de vuelo y +2 s en g3 por pasar a 52 m (el piso es 55 m). g5 rodeado a 45 m del pilón, con 56° de alabeo a 239 km/h; g6 a 156 m (ventana 70–160). |

### Después de la 1.0: Export to Shirley (sin volar todavía)

Juan está suscrito a [FlyShirley](https://airplane.team), el copiloto con IA, que acepta *challenges*
en JSON con fases, instrucciones y estado. **Export to Shirley…** (junto a *Share…*) convierte la
pista en uno para que Shirley relate la carrera; se lo anunció a Alex, el autor, en el Discord de
FlyShirley. `src/core/export/shirley.ts` (puro, `tests/shirley.test.ts`) sigue el `ChallengeSchema`
publicado (repo `Airplane-Team/sample-challenges` y la pestaña *Challenge Specification* de
airplane.team/capabilities/specifications, leídos el 2026-10-25); el test lleva un espejo estricto del
schema, recortado a los campos que se escriben.

- Tres fases: `Brief` (presentación de la pista camino a la salida, silencio máx. 60 s) → `Race`
  (relato en vivo: silencio máx. `RACE_QUIET_S` = 6 s, `challengeTimer`, `recordFlightData`) →
  `Debrief` (veredicto, `analyzeFlightData`, otra corrida vuelve a `Brief`).
- Las puertas de una vuelta van como `navigateToStateWaypoints`, con lo que pide cada una en su
  `context`; rumbos verdaderos (no se llena `magneticHeadingDeg`), alturas en m y ft.
- **La app juzga, Shirley relata.** Shirley no ve el reloj ni las penalizaciones de la app: el prompt
  le prohíbe anunciarlos como hechos y le pide el resultado oficial al piloto en el debrief.
- Se apagan las herramientas que mueven el avión o el sim (`setPosition`, `resetFlight`,
  `setSimulatorSetpoints`, `setDestinationRunway`): un reposicionamiento a mitad de carrera es DNF.
- Los récords de la revisión actual (líder por clase y el mejor del piloto) entran al prompt.
- Se guarda un `.json` y se copia al portapapeles: el Challenge Creator (airplane.team/fly/create)
  recibe el challenge pegado.

El challenge pasa el schema actual de Shirley en las nueve pistas (transcrito de la web, sin claves
descartadas) y el Challenge Creator lo aceptó sin avisos.

**Volado el 2026-10-25** (Daggett Sprint Tall, Cessna 172SP, la 1.0.0 portable midiendo; vuelo
compartido en airplane.team/share/2mMcEFrN):

| Prueba | Resultado |
|---|---|
| Brief | Presentó la pista bien, con el récord de 41,93 s y que el Skyhawk corre en otra clase. Hasta vio el freno de estacionamiento puesto. |
| Transiciones | `Brief` → `Race` y `Race` → `Debrief` solas, sin el botón *Transition Phase*. |
| Relato en vivo | Alcanza: cantó cada puerta. Por su cuenta se puso *wake-up triggers* en la longitud de cada puerta (la pista va de este a oeste). |
| Conexión | Shirley usa el WebSocket de la Web API, no RPOS: la app no mostró *RPOS taken*. |
| Debrief | Pidió el tiempo oficial. |
| App | **1:00,79**, limpia, cero penalizaciones; las cinco pasadas entre 15 y 20 m AGL. |

Dos errores de Shirley, corregidos en el prompt:
1. Dijo "way over the tops" y que esas puertas no contarían: las pasadas fueron a 15–20 m, bajo los
   30 m de los pilones Tall, y sin límite de altura la puerta cuenta a cualquier altura. Venía del
   "below its top" de la regla del toque y de dar alturas en metros cuando ella lee pies (60 ft contra
   "30 m"). Ahora las alturas van en pies primero, y una línea dice que sin límite de altura toda puerta
   cuenta, también por encima de los pilones.
2. Escribió 1:00.079 cuando Juan leyó "01:00.79". Ahora el prompt explica el formato
   minutos:segundos.centésimas de la app.

Pendiente: volver a volar con el prompt corregido.

### RREF como alternativa a RPOS (no adoptada)

Comparte sin pelear, pero cada valor llega
como **float de 32 bits**: lat/lon perderían precisión (~0,7 m de paso a 117° de longitud, contra el
double de RPOS), y una muestra son ~10 datarefs sueltos sin garantía de llegar en el mismo paquete.
Sirve para leer banderas (el replay, sin HTTP) o como fuente de respaldo con posición
`local_x/y/z`; queda anotado para cuando un piloto necesite volar con un mapa móvil que no suelte RPOS.

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
| D2 | **Nombre: XP Pylon Racer** (Juan lo confirmó el 2026-10-25), repo `jlgabriel/xp12-pylon-racer`, público desde la 1.0. | Sigue el patrón de XOP (`xp12-object-placer`, "XP Object Placer"). |
| D3 | **Vocabulario de X-Plane desde el primer commit**: pack, DSF, OBJ8, dataref, RPOS. | Nada de POI, `.tsl`, `autoheight` ni carpetas `<coord>_pr_`: son conceptos de Aerofly (LINEAGE). |
| D4 | **GPL-3.0-or-later.** | Permite copiar código de Pylon Racer y de XOP (mismo autor, misma licencia). |
| D5 | **Cero assets de terceros. Los pilones los genera la app** (OBJ8 + PNG propios, `src/core/pylon/`). | Los Reno de krzysk1 y los de Rodeo son `.tmb` de Aerofly: no sirven en X-Plane, y el permiso de Rodeo fue para Pylon Racer. Un pilón generado tiene altura y radio **exactos**, que es justo lo que pide la regla de "pilón tocado". Si un artista ofrece un pilón OBJ8 más adelante, se suma sin cambiar el modelo. |
| D6 | **Sondear antes de diseñar** (XOP D6). | Cada dato duro del sim se mide con una sonda que no puede salir bien por casualidad (control positivo). Las sondas de la v0.0 están en `probes/`. |
| D7 | **Mismo formato de pista `.pylonrace`.** Una pista hecha en una app se abre en la otra. | Es lo único que cruza entre los dos simuladores. Los ids de pilón de Aerofly (`red`, `rodeo-reno`…) se traducen a un pilón generado del mismo color y rol; ninguno se pierde. |
| D8 | **Rankings separados por simulador.** Ni se importan ni se comparan tiempos de Aerofly. | Física, terreno y tasa de datos distintos: un tiempo de AFS4 y uno de X-Plane no miden lo mismo. |
| D9 | **Heredadas de Pylon Racer sin reabrir:** sin servidor; app individual (se comparten sólo pistas); sin medallas, fantasma ni sonido; UI en inglés y docs en español con "tú"; diseño sobre tokens. | Decisiones de Juan del 2026-10-24 para Pylon Racer. |
| D10 | **Heredadas de XOP sin reabrir:** el DSF binario lo escribe la app, sin DSFTool (XOP D10); la línea de `scenery_packs.ini` la escribe el instalador, con respaldo (XOP D8); instalar y desinstalar con X-Plane cerrado (XOP D16); el instalador sólo toca carpetas propias con marcador. | Medido y publicado en XOP 1.0–1.4. |
| D11 | **Cada modelo de pilón sabe su altura, al tamaño que pida la pista (D15); el `pylonHeightM` de la pista no se usa** (sigue en el formato, por compatibilidad). El diseñador ya no lo muestra. | Pilones generados. Consecuencia: la **revisión** de una misma pista es distinta en cada app (la altura entra en cómo se puntúa), lo que calza con D8. |
| D12 | **Clase de avión por código ICAO** (`acf_ICAO`), sin distinguir mayúsculas. La tabla se leyó de los `.acf` de la instalación 12.4.3 de Juan, nunca de memoria. | En X-Plane no hay ids de carpeta fijos. Un avión desconocido: el piloto elige la clase, recordada por su código. |
| D13 | **X-Plane se encuentra solo** (primera instalación usable de `x-plane_install_12.txt`); el piloto puede elegir otra. Los e2e usan `XPR_XPLANE_DIR` para no tocar nunca un X-Plane real. | Código de XOP (`findInstallations`). |
| D14 | **Esta app también registra `.pylonrace`** (Juan, 2026-10-25): con ambas instaladas, el doble clic abre la que se instaló última, y el README lo dice. Ambas importan el archivo igual. | Quien sólo vuela X-Plane gana el doble clic; quien tiene las dos sigue teniendo Import. |
| D15 | **El tamaño de los pilones es de la pista** (Juan, 2026-10-24): `rules.pylonSize`, `standard` (los modelos de siempre, 15–25 m) o `tall` (todos al doble de alto **y** de ancho, misma pintura: 30–50 m). Viaja en el `.pylonrace`; Pylon Racer lo descarta al abrir, como toda clave que no conoce. El radio de "pilón tocado" crece lo mismo que creció la base de cada modelo (`pylonHitRadiusFor`: el rojo pasa de 5 a 6,2 m), así la distancia que se pide al costado del pilón no cambia y un toque nunca queda dentro del pilón. **Ranking separado:** `pylonSize` entra en la revisión cuando no es `standard`, igual que la altura de cada modelo, así que cambiarlo abre otro ranking y volver a Standard recupera el anterior; las pistas y carreras de antes conservan su revisión. Los modelos altos van en el pack como `pylon_<id>_tall.obj/.png`; el `sceneryId` de Standard no cambió. | En un sim cuesta ver un pilón de 15 m de lejos. Dos tamaños bastan para elegir sin pensar; un pilón sólo más alto sería un poste. Tiempos con pilones de distinta altura no miden lo mismo (D11). |

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
| Replay | sigue mandando (posiciones del replay) | `sim/time/is_in_replay` (0.2) | ? |
| Suscriptores | **uno**: el último que pidió (0.2, §0) | REST: sin límite | ? |
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
                                       (pylon_<color>_tall con pilones altos, D15)
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

| Versión | Qué | Estado (2026-10-25) |
|---|---|---|
| v0.0 | Este documento + sondas H0–H2 | ✅ volado el 2026-10-24 |
| v0.1 | Core portado de Pylon Racer + fuente RPOS | ✅ ~29,5 Hz en el sim |
| v0.2 | Diseñador + instalación del pack | ✅ la Daggett Sprint instalada por la app se ve en X-Plane |
| v0.3 | Carrera en vivo + ranking por clase | ✅ primera carrera: 29,13 s, Aerobatic |
| v0.4 | Abrir `.pylonrace` de Pylon Racer | ✅ mismo formato, mismos ids de pilón, mismas pistas de ejemplo |
| 0.2 | Los hallazgos del vuelo (§0): RPOS compartido, replay | ✅ volada: aviso en 7 s, replay ignorado, 29,02 s |
| Pilones altos | `rules.pylonSize`: Standard o Tall ×2 (D15) | ✅ volados en KDAG: "muy buen tamaño" |
| 1.0 | README de la 1.0, nombre y `.pylonrace` decididos, release | Mismo ciclo que XOP y PCT |

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
