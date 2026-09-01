<div align="center">
  <img src="Autrum/favicon.svg" alt="Autrum Logo" width="100" />

  # Autrum

  **Analizador de espectros de audio con Transformada de Fourier en tiempo real**

  [![Windows](https://img.shields.io/badge/OS-Windows-blue?style=flat-square&logo=windows)](https://www.microsoft.com/windows/)
  [![Linux](https://img.shields.io/badge/OS-Linux-orange?style=flat-square&logo=linux)](https://www.linux.org/)
  [![macOS](https://img.shields.io/badge/OS-macOS-white?style=flat-square&logo=apple)](https://www.apple.com/macos/)
  [![JavaScript](https://img.shields.io/badge/JavaScript-yellow?style=flat-square&logo=javascript)](https://developer.mozilla.org/es/docs/Web/JavaScript)
  [![Web Audio API](https://img.shields.io/badge/Motor_de_Audio-Web_Audio_API-blueviolet?style=flat-square&logo=googlechrome)](https://developer.mozilla.org/es/docs/Web/API/Web_Audio_API)
  [![Node.js](https://img.shields.io/badge/Servidor-Node.js-green?style=flat-square&logo=node.js)](https://nodejs.org/)

</div>

---

## Integrantes

- Daniel de Jesús Alemán Ruiz | 2023051957 
- Victor Aymerich Quesada | 2023152436 
- José Julián Brenes Garro | 2022272865 
- Sebastián Calvo Hernández | 2022099320 
- Emmanuel David Rodríguez Rivas | 2023146102 
- Sebastián Rodríguez Sánchez | 2023074446 

## Información del Curso

- **Curso:** IC7602 — Redes
- **Profesor:** Nereo Gerardo Campos Araya
- **II Semestre, 2026**

---

**Autrum** es una aplicación web de análisis y comparación de espectros de audio desarrollada para el curso de Redes (IC7602). Permite capturar señales de audio en tiempo real desde el micrófono o cargar archivos WAV, calcular su Transformada de Fourier, graficar las señales en el dominio del tiempo y de la frecuencia, y exportar los datos en un formato propietario `.atm`.

## Módulos

- **Analizador:** Captura audio en vivo (micrófono) o en lote (archivos WAV). Aplica la Transformada de Fourier mediante la Web Audio API (`AnalyserNode`) y muestra las gráficas del dominio del tiempo y la frecuencia en tiempo real. Permite exportar la sesión como un archivo `.atm`.
- **Reproductor:** Carga un archivo `.atm` previamente generado, reproduce el audio sincronizado con sus gráficas espectrales y permite hacer zoom para explorar detalles de la señal.
- **Comparador:** Recibe un archivo `.atm` candidato y una palabra o frase pronunciada por micrófono. Busca la referencia dentro del candidato mediante comparación de armónicos y potencia, muestra su ubicación, reproduce el segmento encontrado y devuelve un nivel de confianza estimado entre 0% y 100%.

---

## Instalación y Ejecución (Un solo comando)

### Prerrequisitos

- **Node.js 18+** instalado y disponible en el PATH del sistema. ([Descargar aquí](https://nodejs.org/))

### Windows

```bat
cd Autrum
.\run.bat
```

### Linux / macOS

```bash
cd Autrum
chmod +x run.sh
./run.sh
```

El script verificará automáticamente si Node.js está instalado, levantará un servidor local con `http-server` en el puerto `8080` y abrirá la aplicación en tu navegador automáticamente en `http://127.0.0.1:8080`.

---

## Stack Tecnológico y Arquitectura

La aplicación es una **Single Page Application (SPA)** construida con tecnologías web estándar, sin frameworks de JavaScript, para mantener la complejidad baja y el rendimiento alto en el procesamiento de audio en tiempo real.

| Componente | Tecnología |
|---|---|
| Estructura (HTML) | HTML5 semántico |
| Estilos (CSS) | CSS Vanilla con variables, Glassmorphism y Flexbox/Grid |
| Lógica (JavaScript) | Vanilla JS (ES2020+) modularizado |
| Análisis de Audio / FFT | **Web Audio API** nativa del navegador (`AnalyserNode`) |
| Íconos | **FontAwesome 6** vía CDN |
| Servidor local | `npx http-server` (Node.js) |

## Estructura del Proyecto

```
2026-02-2022099320-IC7602-T1/
│
├── Autrum/                 # Código fuente de la aplicación
│   ├── index.html          # Interfaz principal (Analizador, Reproductor, Comparador)
│   ├── style.css           # Estilos globales (diseño oscuro moderno)
│   ├── favicon.svg         # Ícono de la aplicación
│   ├── run.sh              # Script de automatización para Linux / macOS
│   ├── run.bat             # Script de automatización para Windows
│   └── js/                 # Lógica de la aplicación
│       ├── app.js          # Controlador de navegación
│       ├── analizador.js   # Lógica del Analizador
│       ├── reproductor.js  # Lógica del Reproductor
│       ├── comparador.js   # Lógica del Comparador
│       └── visualizador.js # Lógica de dibujado de gráficas (Canvas)
│
├── Reportes/               # Reportes semanales de avance
│   ├── T1R1.md / .pdf      # Primer reporte de avance
│   ├── T1R2.md / .pdf      # Segundo reporte de avance
│   └── T1R3.md / .pdf      # Tercer reporte de avance
│
├── Documento_Respuestas.md # Respuestas teóricas solicitadas
└── README.md               # Documentación general del proyecto
```

## Formato del archivo `.atm`

El archivo `.atm` es el formato propietario de Autrum. Internamente es un objeto JSON con la siguiente estructura:

```json
{
  "metadata": {
    "nombre": "mi_grabacion.atm",
    "fecha": "2026-08-12T19:00:00.000Z",
    "muestrasFrecuencia": 142,
    "versionFormato": 2,
    "fftSize": 2048,
    "sampleRate": 48000,
    "metricaPotencia": "media-cuadratica-dominio-tiempo"
  },
  "frecuencias": [
    {
      "timestamp": 0.17,
      "datos": [0, 15, 120, 80, 45],
      "potencia": 0.00142
    },
    {
      "timestamp": 0.34,
      "datos": [2, 45, 200, 95, 30],
      "potencia": 0.00318
    }
  ],
  "audioBase64": "data:audio/webm;base64,GkXfo59C..."
}
```

| Campo | Descripción |
|---|---|
| `metadata` | Nombre, fecha, cantidad de muestras, versión del formato y configuración de análisis. |
| `frecuencias` | Arreglo de frames capturados durante el análisis. |
| `frecuencias[].timestamp` | Instante del frame en segundos desde el inicio del audio, sin contar las pausas. |
| `frecuencias[].datos` | Magnitudes del espectro entregadas por `getByteFrequencyData()`. |
| `frecuencias[].potencia` | Media de los cuadrados de las muestras temporales (`RMS²`) obtenidas con `getFloatTimeDomainData()`. |
| `audioBase64` | El audio original completo codificado en Base64 para su reproducción posterior. |

El Comparador conserva compatibilidad con archivos `.atm` de la primera versión, en los que `frecuencias` contenía solamente arreglos de magnitudes. Para esos archivos estima una potencia relativa a partir del espectro y distribuye los timestamps uniformemente a lo largo del audio, por lo que el resultado puede ser menos preciso que con la versión 2.

### Comparación en dos etapas

1. Se recorta el silencio externo de la referencia capturada por micrófono.
2. Una ventana deslizante compara cada posible ubicación del candidato mediante similitud coseno entre sus espectros.
3. Se conservan hasta diez candidatos armónicamente prometedores y suficientemente separados.
4. Las curvas de potencia se convierten a decibelios y se normalizan para reducir el efecto del volumen absoluto.
5. La puntuación final combina 70% de similitud armónica y 30% de similitud de potencia.
6. El nivel de confianza estimado considera la puntuación ganadora y su separación respecto del segundo candidato. No representa una probabilidad estadística exacta.

---

## Conclusiones y Recomendaciones

### Conclusiones

- Implementar el Analizador, el Reproductor y el Comparador directamente sobre la Web Audio API (`AnalyserNode`, `AudioContext`, `decodeAudioData`) evitó dependencias externas para el cálculo de la FFT, ya que el navegador la resuelve internamente.
- Centralizar las funciones de dibujo en canvas (`js/visualizador.js`) redujo la duplicación entre los tres módulos, que comparten la misma lógica de graficar ondas y espectros.
- Trabajar sin módulos ES (scripts clásicos compartiendo el mismo `window`) exige disciplina de nombres entre los cuatro archivos de lógica (`analizador.js`, `reproductor.js`, `comparador.js`, `app.js`); varias colisiones de variables tuvieron que resolverse durante el desarrollo.
- El formato propietario `.atm` permitió desacoplar la grabación (Analizador) de la reproducción (Reproductor) y de la comparación (Comparador), de forma que los tres módulos evolucionaron con relativa independencia.
- La comparación frame a frame mediante similitud coseno y potencia normalizada es, por diseño, un método aproximado: no corrige completamente cambios en velocidad de pronunciación, tono, timbre, micrófono o ruido, por lo que la confianza puede variar incluso entre grabaciones de una misma persona.

### Recomendaciones

- Ejecutar el flujo completo (Analizador → exportar `.atm` → Reproductor / Comparador) con audios grabados por **cada integrante**, no solo por quien implementó cada módulo — es la única forma de detectar bugs de integración real.
- Probar la aplicación en Chrome, Firefox y Safari antes de la entrega, dado que `MediaRecorder` y sus códecs de salida varían entre navegadores.
- Mantener sincronizados los reportes semanales con el estado real del código.
- Alojar las imágenes del Documento de Respuestas dentro del repositorio (por ejemplo en `Documentacion/img/`) en lugar de un host externo como Imgur, para no depender de un enlace que puede caerse antes de la revisión.

## Guía de Uso

### Módulo Analizador

**Modo streaming (micrófono):**
1. En la pestaña **Analizador**, panel "Streaming", hacé clic en **Iniciar**. El navegador va a pedir permiso de micrófono.
2. Hablá o reproducí un sonido cerca del micrófono. La gráfica izquierda (dominio del tiempo) y la derecha (dominio de la frecuencia) se actualizan en vivo.
3. **Pausar** congela la captura sin perderla; **Continuar** la retoma.
4. **Finalizar** detiene la grabación y habilita **Exportar archivo .atm**.
5. Al exportar, se pide un nombre de archivo y se descarga un `.atm` con el audio y las muestras de frecuencia capturadas.

**Modo batch (archivo WAV):**
1. Hacé clic en **Cargar WAV** y seleccioná un `.wav`.
2. El archivo se reproduce mientras se analiza; podés **Pausar/Reanudar** o **Cancelar**.
3. Al terminar de forma natural se habilita la exportación a `.atm`. **Cancelar** detiene el procesamiento actual sin habilitar su exportación.

> Mientras un modo está activo, el otro se deshabilita para evitar mezclar dos fuentes de audio en la misma sesión.

### Módulo Reproductor

1. En la pestaña **Reproductor**, hacé clic en **Cargar .atm** y seleccioná un archivo generado por el Analizador.
2. Se muestra el nombre, la cantidad de muestras de frecuencia y la duración total; la forma de onda completa se dibuja en la gráfica del dominio del tiempo.
3. **Reproducir / Pausar / Detener** controlan la reproducción del audio embebido.
4. Mientras suena, el espectro de frecuencia se dibuja en vivo y una línea (playhead) marca la posición actual sobre la onda.
5. **Acercar / Alejar / Ver todo** hacen zoom sobre la onda. También podés hacer clic para saltar a un punto, o arrastrar para desplazarte.
6. La barra de progreso inferior permite saltar (seek) manualmente.

### Módulo Comparador

1. En la pestaña **Comparador**, panel "Referencia": hacé clic en **Grabar referencia** y pronunciá la palabra o frase que querés buscar. **Detener** cuando termines. Podés escucharla de nuevo con **Reproducir referencia**.
2. En el panel "Candidato": hacé clic en **Cargar .atm** y seleccioná el archivo (generado con el Analizador) donde se quiere buscar esa palabra o frase.
3. Hacé clic en **Comparar**. El sistema ejecuta dos etapas: comparación por armónicos y comparación por potencia, y devuelve un nivel de confianza estimado (0–100%) junto con el intervalo del audio candidato donde encontró la mejor coincidencia.
4. Con **Reproducir coincidencia** se reproduce únicamente el segmento encontrado.
5. Las gráficas de referencia y candidato admiten el mismo zoom/navegación que el Reproductor.

---

## Estado de Implementación

A continuación se resume qué funciona y qué no funciona en la implementación actual del proyecto, de acuerdo a los requerimientos de la tarea:

| Aspecto | Funciona | No funciona / Observaciones |
|---|---|---|
| **Autrum Analizador** | Sí | — |
| **Autrum Comparador** | Sí | La ubicación y la confianza son aproximadas y pueden variar por voz, velocidad, micrófono y ruido. |
| **Autrum Reproductor** | Sí | — |
| **Documento: ¿Por qué las voces de los integrantes son diferentes?** | Sí | Incluido en `Documento_Respuestas.md`. |
| **Documento: ¿Por qué la comparación de voces es tan poco exacta mediante armónicos?** | Sí | Incluido en `Documento_Respuestas.md`. |
