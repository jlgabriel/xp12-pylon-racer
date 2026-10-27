# Sonda H3: la carrera dentro de X-Plane

**La pregunta:** un plugin nuestro, compilado con el SDK 4.3.0 y sólo con APIs de XPLM301, ¿puede
mostrar la carrera dentro del sim (estado, reloj, la puerta que sigue con su flecha, y la pista
sobre fondo negro) sin costar frames y sin que la app deje de ser el juez?

## El diseño

- **El plugin sólo muestra.** El juez es el `RaceSession` de la app. Mientras no conectemos la
  app, `display.ts` hace de app: lee RPOS como ella, juzga y manda al plugin lo que tiene que
  mostrar, con los mismos textos de la app (`rulesText.ts`, el `GATE_NAME` de `RaceView`).
- **Lo único que calcula el plugin** es dónde queda la puerta que sigue, desde la nariz: usa la
  posición del sim en cada frame, no los ~30 Hz de RPOS. Por eso la flecha y la distancia
  deberían verse más suaves que en la app.
- **El formato del cable** está en `plugin/src/protocol.h`. Es UDP a `127.0.0.1:49710`, en texto
  separado por tabulaciones, con un número de versión. La pista se manda cada 2 s y el estado
  ~20 veces por segundo; en Windows salen 16 por los 15,6 ms del timer. El plugin le contesta
  `hello` una vez por segundo con su fps y su tiempo de dibujo.
- **La ventana** es una ventana moderna de X-Plane: se mueve, cambia de tamaño, se puede sacar a
  una ventana aparte del sistema y llevar a VR. El reloj se dibuja con segmentos, porque
  `XPLMDrawString` sólo tiene una letra chica. Los colores se copiaron de `tokens.css`.
- **Lo que mide** queda en `Log.txt`, cada 10 s, en líneas que empiezan con `XPR_H3:`: fps, ms
  de dibujo (promedio y máximo), mensajes recibidos, dónde está la ventana y **cuántos metros
  hay entre el último fix de la app y la posición del sim** cuando llega cada mensaje. Eso dice
  cuánto atrasa la flecha si la calculara la app.
- Se compila con el **SDK 4.3.0** y sólo con `XPLM200`–`XPLM301`, así que no usa nada propio de
  la 12.4.4. Se repite cuando la 12.4.4 salga oficial.

## Probado sin sim (2026-10-26)

- `npm run probe:plugin` compila con Build Tools 2026 (MSVC 19.50) sin warnings. El `.xpl`
  exporta las cinco `XPlugin*` y depende sólo de `XPLM_64.dll`, OpenGL, Winsock y Kernel32: el
  runtime de C++ va adentro, así que no hace falta instalar un redistribuible.
- `build/Release/xpr_h3_listen.exe` usa el mismo socket y el mismo parser del plugin, sin XPLM.
  Contra `npm run probe:display -- --demo --course kdag-rules-test` entiende la pista (6 puertas,
  11 pilones) y la carrera completa: Start → Level ("wings level, ±10°") → Knife-edge → Turn
  pylon ("pass to the right of the pylon") → Gate ("below 40 m") → Finish, con las puertas
  marcándose `d`/`n`/`t` a su tiempo. `display.ts` recibe el `hello` de vuelta.
- **No probado:** todo lo que dibuja. Eso sólo se ve en X-Plane.

## Primer arranque (2026-10-26, 12.4.3)

- **Carga:** `XPR_H3: start 0.1.0-h3, X-Plane 12431, XPLM 430`, y escucha en el 49710.
- **Llenaba el `Log.txt` desde el menú principal:** 34.490 líneas de `Sim is not yet started -
  Position is unset`, dos por frame. Las ventanas **se dibujan también en el menú**, y el dibujo
  leía la latitud y la longitud. El flight loop **no** corre en el menú (no hubo ninguna línea de
  mediciones). Arreglado: la posición se lee sólo en el flight loop y el dibujo usa la última. Lo
  mismo valdrá para el plugin de verdad.
- **Ya en el vuelo (KDAG 26):** el plugin contesta el `hello`. **59,5–59,8 fps** con la ventana
  visible, **dibujo 0,065 ms** de promedio y 0,19 ms de máximo, 17 mensajes por segundo. Un solo
  dibujo de 307 ms, en el período en que cargaba el vuelo (12 fps): a vigilar.
- **Se dibuja con Vulkan:** la ventana, el estado, "1 · Start", "3.9 km", la flecha "ahead" y el
  mapa con las 5 puertas en orden y el avión en el borde, mirando al oeste. El `—` se ve bien.
- **No salieron ni el fondo negro, ni el reloj, ni los cuadraditos de los pilones;** las líneas
  y la flecha sí. Primero creímos que era `GL_QUADS`, pero con triángulos pasó lo mismo. La causa
  es el **culling de caras traseras, que X-Plane deja encendido** en el dibujo de las ventanas: la
  flecha va en sentido horario y se ve, los rectángulos en sentido antihorario y desaparecían.
  `XPLMSetGraphicsState` no lo toca, así que `glState()` hace `glDisable(GL_CULL_FACE)`.
- La pista se escribía en el `Log.txt` cada vez que llegaba (cada 2 s). Ahora, sólo cuando cambia.

## Primera carrera (2026-10-26, 12.4.3): Daggett Sprint en 27,34 s, limpia

- **56–60 fps** toda la carrera con la ventana visible, **dibujo 0,05–0,07 ms** de promedio y
  menos de 0,5 ms de máximo. El pico de 307 ms no se repitió: fue al cargar el vuelo.
- **La app atrasa ~2 m** respecto del sim (máximo 7 m) a velocidad de carrera. Es poco, pero la
  flecha la sigue calculando el plugin.
- Al terminar, la ventana dice "Finished" y todas las puertas pasan a gris.
- **La flecha "se volvía loca" al pasar cada puerta** (Juan): apuntaba al centro, y pasando al
  costado el centro gira a 90° y luego queda atrás hasta que la app avisa el paso. Ahora, a
  menos de 150 m (o del ancho de la puerta), apunta en el rumbo de la puerta. **Volado de nuevo
  el mismo día: "la flecha ya no se vuelve loca"** ✅. El `Log.txt` de ese vuelo: 58–60 fps,
  0,06 ms por dibujo, y la pista escrita una sola vez.
  La app tiene el mismo `TurnCue` y le pasa lo mismo, a menos frames.
- Esta carrera se voló todavía sin el fondo negro ni el reloj (la versión con `GL_QUADS`).
- **Con el culling apagado se ve todo** (captura de Juan, "mejor!"): fondo negro, el reloj grande,
  "1 · Start" con su `·`, el nombre de la pista y los pilones en el mapa. El reloj salía blanco
  esperando la largada, cuando debía ser gris: el color se fijaba antes del `glState()` del reloj
  y se perdía. Ahora el reloj lo recibe y lo pone después.
- **Tercera carrera, con el reloj a la vista: 27,51 s** ("ahora sí!"). Al terminar, "Finished",
  el tiempo grande y todas las puertas en gris. 49–60 fps y 0,05–0,07 ms por dibujo. El `1` del
  reloj queda a la derecha de su casilla, como en cualquier display de siete segmentos.
- **Cuarta carrera, 27,38 s**, con la versión que mide la GPU: el reloj gris esperando, blanco
  corriendo y gris otra vez al terminar. Idea de Juan a pensar: el tiempo final quizás debería
  quedar destacado, no apagado.
- **Cambiar el tamaño:** el mapa se agranda con la ventana. El reloj no, porque tiene un tope de
  64 px.
- **Pop out ✅:** queda como una ventana de Windows de verdad y sigue dibujando todo. Arriba a la
  derecha se ve un cuadradito, que parece un resto de la decoración de X-Plane.
- **GPU** (`gpu_time_per_frame_sec_approx`): con la ventana en el sim, **5,5–6 ms** a 60 fps
  topados. **Con la ventana aparte bajó a 30–42 fps y 6,5–8,4 ms** en tres períodos. Puede ser el
  costo de una ventana más del sistema o que Juan la estaba moviendo: repetirlo quieto.
- El menú *Plugins › XP Pylon Racer (H3)* funciona.
- **Falta:** oculta contra visible (no quedó ningún período con la ventana oculta), VR, una tecla
  para `xpr/h3/toggle_display`, Pop out quieto, y repetir en la 12.4.4.

## Antes (con X-Plane cerrado)

1. Si no existe `probes/H3/XPR_H3_Display/`, rehazla con `npm run probe:plugin`.
2. Copia la carpeta **`XPR_H3_Display`** a
   `D:\Laminar\XP12-Last-Release\X-Plane 12\Resources\plugins\`.
3. **Cierra XP Pylon Racer.** RPOS tiene un solo suscriptor, y `display.ts` lo pide igual que la
   app.

## En X-Plane

4. **Vuelo en KDAG, pista 26**, con cualquier avión. Los pilones de la Daggett Sprint ya están
   instalados (`XPR_daggett-sprint`).
5. **Sin el emisor todavía:** arriba a la derecha tiene que aparecer una ventana negra *XP Pylon
   Racer* que dice "Waiting for XP Pylon Racer...", y en el menú *Plugins* un ítem
   **XP Pylon Racer (H3)**. **Una captura.**
6. En una terminal, en la carpeta `xp12-pylon-racer`:
   ```
   npm run probe:display
   ```
   Cada 5 s imprime una línea del plugin (fps, ms de dibujo). La ventana tiene que pasar a
   "Armed — fly through the start gate", con el reloj en 00:00.00, "1 · Start" y la pista abajo.
7. **En la cabecera:** la flecha apunta hacia adelante ("ahead"), porque la largada está 2 km
   después del final de la pista. En el mapa se ven 5 puertas en línea y tu avión. Mira si se ven
   bien `°`, `·` y `—`. **Una captura.**
8. **La ventana:** muévela y cámbiale el tamaño. Prueba *Plugins › XP Pylon Racer (H3) › Pop out
   into its own window* y después *Back into the sim*. Si tienes VR, prueba *Move into VR*.
   Asigna una tecla o un botón a **`xpr/h3/toggle_display`** (*Settings › Keyboard*, busca
   "XP Pylon Racer") y prueba mostrar y ocultar.
9. **Vuela la Daggett Sprint** mirando la ventana. Fíjate si el reloj se lee de un vistazo, si la
   flecha se mueve suave y si la puerta que sigue cambia al pasarla. Al final tiene que decir
   "Finished", y la terminal imprime el tiempo.
10. **El costo:** con el avión estable, deja la ventana **oculta 20 s** y luego **visible 20 s**.
    Juan tiene los fps topados en 60 desde el driver de NVIDIA, así que los fps no muestran el
    costo. Se compara la columna **`gpu … ms`** (`sim/time/gpu_time_per_frame_sec_approx`, que
    Laminar llama aproximada) y el tiempo de dibujo propio, que es CPU.
11. Sal al menú y corta la terminal con **Ctrl+C**.

## Después

12. Pásame las capturas y tus notas de los pasos 7 a 9. El `Log.txt` lo leo yo directo del disco.
13. **Desinstalar:** con X-Plane cerrado, borra `Resources\plugins\XPR_H3_Display`.

## Cómo se lee

| Se ve | Lectura |
|---|---|
| Ventana y menú; `XPR_H3: start …` en el `Log.txt` | ✅ el plugin carga con el SDK 4.3.0 |
| No hay ventana y el `Log.txt` dice que no pudo cargar `XPR_H3_Display.xpl` | falta una DLL o la arquitectura no corresponde: pasarme el `Log.txt` |
| "UDP port 49710 is taken by another program" | otro programa usa el puerto: elegir otro |
| La ventana parpadea o queda negra con Vulkan | el dibujo 2D con OpenGL no basta: probar con Zink, o pensar en otra forma de dibujar |
| `°` o `·` salen como cuadrados o basura | `XPLMDrawString` no entiende UTF-8: la app manda ASCII |
| fps igual con la ventana oculta y visible, dibujo < 0,5 ms | ✅ cuesta nada |
| "app fix vs sim" de varios metros a velocidad de carrera | la flecha conviene calcularla en el plugin, como ya hace |
| Pop out y VR funcionan | ✅ sirve con un monitor y con casco |
