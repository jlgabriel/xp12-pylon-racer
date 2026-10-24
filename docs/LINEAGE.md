# Linaje: qué viene de Pylon Racer, qué viene de XOP y qué se rechaza

XP Pylon Racer tiene dos padres. De **Pylon Racer** (Aerofly FS4) hereda el juego: las reglas, el
motor de carrera, el formato de pista y la interfaz. De **XOP** (XP Object Placer) hereda todo lo
que sabe de X-Plane: el DSF, el instalador y la disciplina de las sondas.

Este archivo existe para que en seis meses nadie, persona o agente, "arregle" algo aquí
reintroduciendo un concepto de Aerofly que se dejó fuera a propósito. **Si vas a agregar algo de la
última tabla, vas a cometer un error.**

## Copiado de XOP (v0.0, línea por línea)

Cada archivo lleva una cabecera que lo dice. Se copiaron también sus tests: que pasen aquí los
números de XOP es lo que prueba que la copia no se desvió.

| Archivo | Por qué viaja |
|---|---|
| `src/core/dsf/writeDsfBinary.ts`, `tile.ts`, `validate.ts` | El DSF binario que X-Plane 12.4.3 carga (XOP H0b, H8). Sin DSFTool. |
| `src/core/geo/geo.ts` | Sabe de la Tierra, no de un simulador. Venía de PCT, igual que en Pylon Racer. |
| `src/core/model.ts` | **Recortado** a `LonLat` y `PlacedObject`, lo que importa el DSF. `libraryPath` conserva el nombre aunque aquí casi siempre sea una ruta relativa al pack: renombrarlo obligaría a tocar el código copiado. |
| `tests/writeDsfBinary.test.ts`, `tile.test.ts`, `geo.test.ts` | Con `XOP_DSFTOOL` apuntando a DSFTool, también la lectura de vuelta (en este computador: `D:\Simuladores\Ortho4XP1.3\Utils\DSFTool.exe`). |

**Por copiar más adelante:** `installPack`, `sceneryPacksIni`, `findInstallations`,
`containedPath`, `fsAtomic`, `airports/` (apt.dat y la búsqueda con tres niveles).

## Por portar de Pylon Racer (v0.1)

`course/` (modelo zod, revisión FNV, `raceSequence`, `edit.ts` con los roles start/finish
posicionales), `race/` (cruce de segmentos, interpolación, `Fix`), `run/`, `session/`,
`ranking/ranking.ts`, `demo/` y el renderer completo con sus tokens. Las pruebas de Pylon Racer
vienen con el código.

## La disciplina (de PCT, vía XOP)

Sondear antes de diseñar · control positivo · ángulos que no sean múltiplos de 90° · el log del sim
como instrumento más barato (`Log.txt`) · core puro sin E/S · docs escritos contra el código ·
verificar la UI en el renderer real · el instalador sólo toca lo suyo · hitos chicos con nombre.

## Rechazado a propósito

| Concepto de Aerofly | Por qué no viaja | Qué lo reemplaza |
|---|---|---|
| Carpeta POI `<coord>_pr_<slug>` y `.tsl` | Formato de escenario de Aerofly | Pack `XPR_<slug>` con DSF (DESIGN §3) |
| `autoheight` | En X-Plane un `OBJECT` siempre se apoya en la malla | Nada: el DSF no lleva altura |
| Pilones `.tmb` de krzysk1 y Rodeo | Formato compilado de Aerofly; el permiso de Rodeo era para AFS4 | Pilones generados (`src/core/pylon/`) |
| AeroflyReader.dll y `compassFromReader` (`90 − ángulo`) | La DLL es de Aerofly; la conversión arreglaba un ángulo matemático que X-Plane no entrega (H0 lo confirma) | RPOS, rumbo verdadero en grados |
| `isNullIsland` como "estoy en el menú" | Señal de Aerofly; X-Plane puede comportarse distinto | Lo que diga H0 |
| Clases por id de carpeta (`c172`, `extra330`) | En X-Plane no hay ids fijos | `acf_ICAO` + elección del piloto |
| Elevación de Open-Meteo para la regla de altura | Aerofly por UDP no daba AGL | AGL de RPOS |
