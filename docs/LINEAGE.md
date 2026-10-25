# Linaje: qué viene de Pylon Racer, qué viene de XOP y qué se rechaza

XP Pylon Racer tiene dos padres. De **Pylon Racer** (Aerofly FS4) hereda el juego: las reglas, el
motor de carrera, el formato de pista y la interfaz. De **XOP** (XP Object Placer) hereda todo lo
que sabe de X-Plane: el DSF, el instalador y la disciplina de las sondas.

Este archivo existe para que en seis meses nadie, persona o agente, "arregle" algo aquí
reintroduciendo un concepto de Aerofly que se dejó fuera a propósito. **Si vas a agregar algo de la
última tabla, vas a cometer un error.**

## Copiado de XOP, línea por línea

Cada archivo lleva una cabecera que lo dice. Se copiaron también sus tests: que pasen aquí los
números de XOP es lo que prueba que la copia no se desvió. Estos archivos conservan el estilo de XOP
(comillas simples, imports con `.js`); el resto del repo sigue el de Pylon Racer.

| Archivo | Por qué viaja |
|---|---|
| `src/core/dsf/writeDsfBinary.ts`, `tile.ts`, `validate.ts` | El DSF binario que X-Plane 12.4.3 carga (XOP H0b, H8). Sin DSFTool. |
| `src/core/install/sceneryPacksIni.ts` | Una línea en `scenery_packs.ini`, sin reordenar ni normalizar nada más, respetando los finales de línea del archivo. |
| `src/core/install/parseInstallList.ts`, `src/main/findInstallations.ts` | Encontrar X-Plane 12 desde la lista del instalador de Laminar. |
| `src/main/containedPath.ts` | Ninguna ruta sale de `Custom Scenery`. |
| `src/core/model.ts` | **Recortado** a `LonLat` y `PlacedObject`, lo que importa el DSF. `libraryPath` conserva el nombre aunque aquí sea una ruta relativa al pack: renombrarlo obligaría a tocar el código copiado. |
| `tests/writeDsfBinary.test.ts`, `tile.test.ts`, `sceneryPacksIni.test.ts`, `parseInstallList.test.ts`, `containedPath.test.ts` | Con `XOP_DSFTOOL` apuntando a DSFTool, también la lectura de vuelta (en este computador: `D:\Simuladores\Ortho4XP1.3\Utils\DSFTool.exe`). |

**Adaptado, no copiado:** `src/main/installer.ts` sigue las reglas de `installPack` de XOP
(armar al lado y cambiar con un rename, respaldo del ini, un archivo bloqueado no es culpa de
X-Plane) con el marcador propio `pylon-racer.json` y el prefijo `XPR_`. El test de propiedad del
marcador nunca se vuelve más estricto (la regla `packContract` de XOP).

**Por copiar si hace falta:** `airports/` (búsqueda en el `apt.dat` del usuario). Hoy el diseñador
busca con Nominatim, como Pylon Racer.

## Portado de Pylon Racer (v0.1)

Todo `src/` salvo lo de Aerofly: `course/` (modelo zod, revisión FNV, `raceSequence`, `edit.ts`),
`race/`, `run/`, `session/`, `ranking/`, `demo/`, `files/` (`.pylonrace`), `geo/` (el `geo.ts` de
Pylon Racer, que es el de PCT con lo que necesita el motor), `main/` y el renderer completo con sus
tokens, fuentes e íconos. Sus tests vinieron con el código.

Lo que cambió al portar:

| Pieza | En Pylon Racer | Aquí |
|---|---|---|
| Telemetría | UDP ForeFlight 49002 + AeroflyReader.dll | RPOS (UDP 49000) + Web API para el avión (`core/telemetry/rpos.ts`, `webapi.ts`) |
| `SourceKind` | `udp`, `reader`, `demo` | `rpos`, `demo` |
| Pilones | `.tmb` vendidos en `assets/` | generados (`core/pylon/`, `core/export/pylons.ts`), **mismos ids** |
| Escenario | POI `.tsl` (`export/poi.ts`) | pack con DSF (`export/pack.ts`) |
| Clases | ids de carpeta de AFS4 | códigos ICAO leídos de los `.acf` |
| Revisión de una pista | — | distinta: cada pilón tiene altura conocida (DESIGN D11), y la pista elige su tamaño (D15) |
| Test dorado del `.tsl` | el `.tsl` completo | sólo las posiciones de los pilones, que siguen idénticas al exportador viejo |

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
| AeroflyReader.dll y `compassFromReader` (`90 − ángulo`) | La DLL es de Aerofly; la conversión arreglaba un ángulo matemático que X-Plane, según su documento, no entrega (H0 lo confirma) | RPOS, rumbo verdadero en grados |
| `isNullIsland` como "estoy en el menú" | Señal de Aerofly; X-Plane puede comportarse distinto | Se conserva el filtro (no cuesta nada); lo que diga H0 decide |
| Clases por id de carpeta (`c172`, `extra330`) | En X-Plane no hay ids fijos | `acf_ICAO` + elección del piloto |
| Elevación de Open-Meteo como fuente de la regla de altura | Aerofly por UDP no daba AGL | AGL de RPOS; Open-Meteo queda de respaldo y para el demo |
