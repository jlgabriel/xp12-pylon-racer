# Sonda H1: nuestros pilones, en un pack nuestro

**La pregunta:** un DSF escrito por el código de XOP, con `OBJECT_DEF` **relativo al pack** y
objetos OBJ8 + PNG generados por la app, ¿carga y se ve como debe?

XOP sólo escribió rutas de librería (`lib/…`). La sintaxis relativa al pack existe (la usa el
overlay de París que XOP desarmó, `reference/dsf-overlay.md`), pero ningún archivo nuestro la ha
volado todavía.

## El diseño

`make.ts` genera `XPR_H1_Pylons/`: tres pilones (verde, rojo y naranja, con franjas blancas) de
**20 m de alto y 2,4 m de ancho en la base**, y un DSF de 534 bytes con seis pilones en tres
puertas de 40 m sobre la **pista 17L de SCEL**, a 1500, 2000 y 2500 m de la cabecera (coordenadas
de los extremos de la pista tomadas del `apt.dat` 12.4.3).

- **Control positivo:** una torre de control de la librería de serie, a 150 m al este del par
  verde. Ya cargó en las sondas de XOP. Si está la torre y no los pilones, el pack cargó y los
  objetos no.
- **Pintura inconfundible:** cinco franjas, color en el pie y en la punta. Leída al revés se ve
  igual, así que una textura invertida no puede hacer fallar la sonda por la razón equivocada (el
  test unitario sí cubre el sentido).
- **`ATTR_no_cull`:** no se ha sondeado qué sentido de giro toma X-Plane como cara frontal, y dibujar
  las caras de atrás de un tubo de 16 lados no cuesta nada.
- **Sin rotación:** un pilón es redondo.
- DSFTool (el de Ortho4XP) lo decompila sin errores: 4 `OBJECT_DEF`, 7 `OBJECT` y cada pilón a
  menos de 10 cm de lo pedido, dentro de la cuantización de ~21 cm del DSF.

## Cómo se lee

| Se ve | Lectura |
|---|---|
| Tres pares de colores, sobre el pavimento, franjas nítidas | ✅ todo el camino del pack funciona |
| Pilones blancos o grises | el `.obj` cargó y el PNG no: revisar `Log.txt` |
| Torre sí, pilones no | `OBJECT_DEF` relativo al pack no resolvió: revisar `Log.txt` |
| Nada | el pack no cargó (`scenery_packs.ini`) |
| Pilones flotando o enterrados | la malla bajo la pista no es lo que creíamos; anotar cuánto |

Además, para el diseño: **desde qué distancia se distinguen los pilones** en la carrera de
despegue. Sin `ATTR_LOD`, X-Plane decide.

## Resultado

Pendiente: lo vuela Juan.
