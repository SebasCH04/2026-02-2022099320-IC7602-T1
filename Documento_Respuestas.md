# Documento con las Respuestas a las Preguntas según Tanenbaum

## Información del Curso

- **Curso:** IC7602 — Redes
- **Profesor:** Nereo Gerardo Campos Araya
- **II Semestre, 2026**

## Integrantes

- Daniel de Jesús Alemán Ruiz | 2023051957 
- Victor Aymerich Quesada | 2023152436 
- José Julián Brenes Garro | 2022272865 
- Sebastián Calvo Hernández | 2022099320 
- Emmanuel David Rodríguez Rivas | 2023146102 
- Sebastián Rodríguez Sánchez | 2023074446 

## Pregunta 1: ¿Por qué las voces de los integrantes son diferentes?

Cada persona tiene cuerdas vocales de distinto tamaño y grosor, y eso hace que vibren a
un tono base distinto (más agudo o más grave). Ese tono luego pasa por la garganta, la boca
y la nariz, que actúan como una especie de caja de resonancia y refuerzan unas frecuencias
más que otras dependiendo de su forma. Como esa forma es distinta en cada persona, el
resultado también lo es, aunque dos personas digan exactamente la misma palabra.

Con el Analizador esto se puede ver directamente: al grabar la misma palabra con dos
integrantes distintos, la gráfica de frecuencia muestra el primer pico (el tono base) en una
posición distinta para cada uno, y el resto de las barras también tienen una forma diferente.
Esa diferencia en el gráfico es, básicamente, lo que hace que dos voces suenen distinto aunque
digan lo mismo.

Esto se puede ver en las capturas de la Pregunta 2 más abajo: la "Referencia Uno" y la
"Referencia Tres" corresponden a dos integrantes distintos diciendo la misma palabra
("Alajuela"), y sus espectros de frecuencia son distintos entre sí.

## Pregunta 2: ¿Por qué la comparación de voces es tan poco exacta mediante armónicos?

La comparación por armónicos no es tan exacta porque hay varios factores que pueden alterar el espectro de la señal de la voz a pesar de que se esté diciendo lo mismo.

Primero el micrófono y el ambiente son un canal de transmisión que tienen limitaciones, porque el micrófono no capta del todo las frecuencias tales como son y a eso se suma la señal, por eso cuando escuchamos nuestra grabación no nos gusta porque es una grabación de media a baja calidad. Por lo que suele afectar la comparación de los armónicos.

Segundo, hay una variabilidad temporal en la pronunciación, porque dos personas pueden pronunciar una palabra a velocidades diferentes. Nosotros usamos compararArmonicos y esta función usa ventanas para analizar la señal, entonces los armónicos pueden quedar distribuidos en posiciones diferentes, entonces los frames no están alineados.

Y por último, la similitud coseno que utilizamos compara la forma relativa de los espectros pero no corrige diferencias de tono, timbre o pequeñas diferencias de frecuencia entre personas. Entonces como la voz de cada persona tiene características propias, dos personas diciendo lo mismo puede dar espectros diferentes.

Se pueden ver en el siguiente ejemplo usando la aplicación Autrum, se grabó utilizando la función Analizador para luego convertir en archivo .atm donde se dijo la frase "Que lindo ir a Alajuela"

![Referencia Uno Alajuela](https://i.imgur.com/rVjfJQc.png)

Está seleccionada la parte del archivo donde justo se dice "Alajuela" y si luego la misma persona graba otro audio diciendo lo mismo, va a tener una frecuencia similar.

![Referencia Dos Alajuela](https://i.imgur.com/zJ5BIOS.png)

Pero en cambio otra persona dijo lo mismo y se ve que que dió resultados diferentes.

![Referencia Tres Alajuela](https://i.imgur.com/hmqKkOu.png)