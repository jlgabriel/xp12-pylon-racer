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

## Resultado

Pendiente: lo vuela Juan.
