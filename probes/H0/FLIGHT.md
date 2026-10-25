# Sonda H0: qué dice X-Plane 12 del vuelo, y por dónde

**La pregunta:** ¿qué canal alimenta la carrera, a qué tasa, en qué unidades y con qué signos?
¿Y por cuál se sabe qué avión es?

## El diseño

`listen.ts` abre todas las puertas a la vez y graba lo que llega por cada una, sin interpretar nada:

- **RPOS** (UDP 49000): le pide la posición a X-Plane 40 veces por segundo y vuelve a pedirla si el
  flujo se corta (X-Plane olvida al suscriptor cuando se reinicia). Al terminar, pide 0 Hz para no
  dejar a X-Plane mandando a un puerto cerrado.
- **Web API** (WebSocket 8086, `/api/v3`): busca 16 datarefs por nombre (REST v3, v2 y v1, por si
  acaso) y se suscribe. Los nombres que no existan quedan anotados: también es un resultado.
- **Puerto 49002**: todo lo que llegue, con sus primeros 200 caracteres.
- **BECN** (multicast 239.255.1.1:49707): la versión de X-Plane y su puerto, para encontrarlo más
  adelante sin configuración.

`analyze.ts` resume al terminar. Los signos se leen **contra el track que dibujan las propias
posiciones**, así que no pueden salir bien por casualidad:

| Chequeo | Contra qué | Alternativa que debe perder |
|---|---|---|
| Rumbo de brújula | track de las posiciones a mitad de cada segundo | `90 − rumbo` (el error de la DLL de Aerofly) |
| vx este, vz sur | el mismo track | — |
| Roll + = ala derecha abajo | el sentido en que gira el track | — |
| Pitch + = nariz arriba | si sube o baja | (flojo: un planeo baja con la nariz arriba) |

Probado contra `fake-xplane.ts`: rumbo a 0,2° del track (el ángulo matemático, a 91°), vz al sur a
0,2° y roll 327 de 357.

## Cómo se lee

| Si `summary.md` dice | Entonces |
|---|---|
| RPOS en vuelo ≥ 30 Hz, intervalo p95 < 50 ms | RPOS es la fuente de la carrera |
| RPOS < 10 Hz | revisar: ¿FPS del sim bajos? Repetir con `--rate 20` |
| ✅ en los cuatro signos | el core de Pylon Racer porta sin conversión |
| ❌ en el rumbo con la alternativa en ~0° | X-Plane manda un ángulo matemático: se convierte en `telemetry/rpos.ts` |
| La Web API dice `acf_ICAO` | la tabla de clases se arma con esos valores reales |
| Algo en el 49002 | anotar formato y tasa; no es la fuente principal salvo que RPOS falle |

## Resultado: volado el 2026-10-24, X-Plane 12.4.3, Extra 330SC de Vertigo

Juan voló en SCEL: rodaje y despegue por la 17L, pasadas bajas por las tres puertas, maniobras
acrobáticas (toneles, invertido) y replay. Corrida `runs/2026-10-25T01-38-31` (local, no versionada).

| Pregunta | Respuesta medida |
|---|---|
| Tasa de RPOS | **~29,5 Hz** (intervalo mediano 33,9 ms, p95 41 ms) pidiendo 40, con X-Plane a ~60 fps. Siete veces el UDP de Aerofly. |
| Rumbo | ✅ **brújula**: a 3,0° del track en la mediana (p90 5,9°) en 3472 pares; leído como ángulo matemático daría 91°. Llega en **[-180, 180]** (se vio -179): `rpos.ts` ya lo pasa a [0, 360). |
| vx / vz | ✅ este / **sur**: el track de las velocidades y el de las posiciones, a 0,2°. |
| Signo del roll | ✅ **positivo = ala derecha abajo**: 346 de 346 muestras en virajes estables de 15–60°. En alabeos de más de 60°, invertido o en pleno tonel la relación con el viraje se rompe por física (214 de 361); ya no se juzga ahí. |
| Pitch | ✅ positivo = nariz arriba (1651 de 1678). |
| Menú | Sin RPOS hasta cargar un vuelo; **nunca** lat/lon 0,0. |
| Pausa / replay | **RPOS sigue a ~30 Hz con la posición congelada.** El motor ya trata un flujo congelado como fin de carrera. ⚠️ En replay en reproducción X-Plane mandaría posiciones del replay: hay que ignorarlo (dataref `replay_mode`). |
| Web API | REST responde en **`/api/v3`**; `acf_ICAO` del Vertigo = `Extra`. El **WebSocket sólo abre en `/api/v1`** (v2 y v3 cierran con 1006); la app no lo usa. |
| Puerto 49002 | Nada. X-Plane 12 no manda ForeFlight por defecto, y no hace falta. |
| Beacon | Llega: versión 124311, puerto 49000, nombre del PC. Sirve para encontrar X-Plane en la red sin configurar. |

### ⚠️ Hallazgo: RPOS tiene UN suscriptor

Con la app y la grabadora pidiendo RPOS a la vez, cada una veía ~29 Hz, luego ~18, luego 0, y así:
X-Plane manda RPOS **sólo al último que lo pidió**, y cada programa lo volvía a pedir al quedarse sin
datos. Cerrando uno, el otro recibió ~29 Hz estables. Consecuencia para la app: si el piloto usa
otro programa que también pide RPOS (un mapa móvil), se pelean. Pendiente para el diseño: detectarlo
(flujo que se corta cada ~2 s) y avisar, o pasar a otra fuente (RREF, o la Web API).
