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
    Las líneas del `Log.txt` comparan los fps.
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
