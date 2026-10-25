# Sonda H2: ¿la posición de RPOS y los pilones del DSF son el mismo mundo?

**La pregunta:** cuando Juan dice "pasé cerca del pilón derecho", ¿el log dice lo mismo, al metro?

Si no, ninguna regla de la carrera sirve: una puerta "saltada" podría ser un error de coordenadas y
no de pilotaje. En Aerofly esto nunca se midió directo.

## El diseño

`gates.ts` toma el `rpos.csv` de la corrida de H0 y, para cada par de muestras que cruza la línea
de una de las puertas de H1 (`probes/course.ts`, los mismos números que usó el DSF), da:

- **a cuántos metros del pilón izquierdo** cruzó (0 = izquierdo, 40 = derecho, volando la 17L);
- la altura AGL y el alabeo en el cruce (interpolados);
- la **distancia mínima a cada pilón** en ±3 s, la base para el radio de "pilón tocado".

Las cuentas son a propósito simples: un plano local por puerta y un cruce de segmentos. El motor
de verdad llega desde Pylon Racer en la v0.1; aquí sólo tiene que ser obviamente correcto.
Probado con el X-Plane falso, que pasa a 12 m a la derecha del eje: devuelve **32,0 m** en las
tres puertas.

## Cómo se lee

Comparar cada fila con la nota de Juan:

| Juan anotó | Esperado en "from left" |
|---|---|
| cerca del izquierdo | 0 – 13 m |
| al centro | 13 – 27 m |
| cerca del derecho | 27 – 40 m |

Las tres coinciden ⇒ ✅ el mundo de RPOS y el del DSF coinciden a la escala que importa (los DSF
de XOP cuantizan a ~21 cm). Una puerta que no coincide por mucho ⇒ revisar con la captura antes de
sacar conclusiones.

## Resultado: volado el 2026-10-24, X-Plane 12.4.3 ✅

| Puerta | Desde el izquierdo | AGL | Lo que muestra el replay de Juan |
|---|---|---|---|
| 1 verde | 20,0 m (centro exacto) | 12,7 m | el avión centrado entre los dos pilones |
| 2 roja | 15,1 m (5 m a la izquierda) | 9,7 m | el avión claramente a la izquierda del centro |
| 3 naranja | 18,9 m (casi al centro) | 9,0 m | apenas a la izquierda |

En vez de notas, Juan mandó tres capturas del replay de X-Plane con la cámara detrás del avión en
cada puerta. Es mejor referencia que una nota de memoria, y las tres coinciden con el log en lado y
en orden de magnitud. **La posición de RPOS y los pilones del DSF son el mismo mundo.**

Lo confirmó después la carrera real en KDAG: la Daggett Sprint, en el mismo Extra, terminó limpia en
29,13 s, con las cinco pasadas a menos de 6 m del centro de cada puerta.
