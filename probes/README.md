# Sondas v0.0: un vuelo de unos 15 minutos

Las tres sondas se vuelan juntas. H1 pone los pilones, H0 graba todo lo que dice X-Plane y H2 cruza
la grabación con los pilones. Cada `FLIGHT.md` explica la pregunta y cómo se lee la respuesta; esta
página es sólo la lista de qué hacer.

Probado sin sim contra `npm run probe:fake`, un X-Plane falso con un vuelo de guion: el análisis
devuelve exactamente el guion (32,0 m desde el pilón izquierdo y signos correctos).

## Antes (con X-Plane cerrado)

1. **Instalar el pack de pilones.** Ya está generado en `probes/H1/XPR_H1_Pylons/`. Si se borró,
   se rehace con `npm run probe:pack`.
   - Copia la carpeta `XPR_H1_Pylons` a `D:\Laminar\XP12-Last-Release\X-Plane 12\Custom Scenery\`.
   - Respalda `Custom Scenery\scenery_packs.ini` y agrega esta línea **justo debajo** de
     `SCENERY_PACK *GLOBAL_AIRPORTS*`, donde ya está la de XOP:
     ```
     SCENERY_PACK Custom Scenery/XPR_H1_Pylons/
     ```
2. **Cierra Pylon Racer (Aerofly)** si está abierto: también escucha en el puerto 49002, y con dos
   programas en el mismo puerto no se sabe a cuál le llegan los paquetes.
3. En una terminal, en la carpeta `xp12-pylon-racer`:
   ```
   npm run probe:listen
   ```
   Déjala corriendo **antes** de abrir X-Plane: así también graba el menú y el beacon. Cada 2 s
   imprime una línea con las tasas.

## En X-Plane

4. **Menú principal, 20 s sin tocar nada.**
5. **Settings › Network:** comprueba que **no** esté marcado "Disable Incoming Traffic". Busca
   cualquier opción para ForeFlight, "mapping apps" o EFB; si hay una, actívala y **anota el nombre
   exacto**.
6. **Vuelo nuevo:** Cessna 172 de serie, **SCEL, pista 17L**, de día, **sin viento** (el viento
   no rompe el análisis, pero lo ensucia).
7. **En la cabecera, antes de despegar:** mira pista abajo. Tendrían que verse **tres pares de
   pilones** a 1500, 2000 y 2500 m: verde, rojo y naranja, cada uno con franjas blancas, sobre el
   pavimento y 40 m entre sí. A la izquierda del par verde, a 150 m, una torre de control chica.
   **Una captura.**
8. **Despega y pasa bajo, entre 5 y 15 m, por los tres pares.** Los pilones miden 20 m. Después
   de cada par anota por dónde pasaste: *cerca del izquierdo / al centro / cerca del derecho*.
9. **Sube a unos 300 m** y haz **un giro completo a la derecha** con unos 30° de alabeo, luego **uno
   completo a la izquierda**.
10. **Pausa (P) unos 10 s** y sigue.
11. **Vuelve al menú** y espera 10 s. Luego **Ctrl+C** en la terminal: escribe el resumen.

## Después

12. En la terminal:
    ```
    npm run probe:gates -- probes/H0/runs/<la carpeta que creó>
    ```
13. Pásame la carpeta de la corrida (con `summary.md` y `gates.md`), la captura y tus tres notas
    de las puertas. El `Log.txt` de X-Plane lo leo yo directo del disco.
14. **Desinstalar:** borra la carpeta `XPR_H1_Pylons` y su línea en `scenery_packs.ini`, con
    X-Plane cerrado.

## Si algo sale raro

- **La línea de la terminal muestra RPOS en 0 Hz con el avión ya en la pista:** algo bloquea el
  puerto 49000 (el firewall o el tráfico entrante desactivado). Anota qué ves y sigue igual: la
  Web API y el 49002 graban de todos modos.
- **No se ven los pilones pero sí la torre:** el pack cargó y los objetos no. Ese es un resultado,
  no un fracaso. Sigue con el resto del vuelo.
- **No se ve ni la torre:** el pack no cargó. Revisa la línea del `scenery_packs.ini`.
