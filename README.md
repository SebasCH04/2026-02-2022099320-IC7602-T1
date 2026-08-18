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

- Daniel de Jesús Alemán Ruiz | 2023051957 |
- Victor Aymerich Quesada | 2023152436 |
- José Julián Brenes Garro | 2022272865 |
- Sebastián Calvo Hernández | 2022099320 |
- Emmanuel David Rodríguez Rivas | 2023146102 |
- Sebastián Rodríguez Sánchez | 2023074446 |

## Información del Curso

- **Curso:** IC7602 — Redes
- **Profesor:** Nereo Gerardo Campos Araya
- **II Semestre, 2026**

---

**Autrum** es una aplicación web de análisis y comparación de espectros de audio desarrollada para el curso de Redes (IC7602). Permite capturar señales de audio en tiempo real desde el micrófono o cargar archivos WAV, calcular su Transformada de Fourier, graficar las señales en el dominio del tiempo y de la frecuencia, y exportar los datos en un formato propietario `.atm`.

## Módulos

- **Analizador:** Captura audio en vivo (micrófono) o en lote (archivos WAV). Aplica la Transformada de Fourier mediante la Web Audio API (`AnalyserNode`) y muestra las gráficas del dominio del tiempo y la frecuencia en tiempo real. Permite exportar la sesión como un archivo `.atm`.
- **Reproductor:** Carga un archivo `.atm` previamente generado, reproduce el audio sincronizado con sus gráficas espectrales y permite hacer zoom para explorar detalles de la señal.
- **Comparador:** Compara dos señales de audio cargadas como archivos `.atm` analizando sus armónicos y potencias, y retorna un porcentaje de similitud (0% - 100%).

---

## Instalación y Ejecución (Un solo comando)

### Prerrequisitos

- **Node.js 18+** instalado y disponible en el PATH del sistema. ([Descargar aquí](https://nodejs.org/))

### Windows

```bat
.\run.bat
```

### Linux / macOS

```bash
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
2026-02-2023051957-IC7602-T1/
│
├── index.html              # Interfaz principal (Analizador, Reproductor, Comparador)
├── style.css               # Estilos globales (diseño oscuro moderno)
├── favicon.svg             # Ícono de la aplicación
│
├── js/
│   ├── app.js              # Controlador de navegación entre módulos
│   ├── analizador.js       # Lógica del Analizador (FFT, gráficas, exportación .atm)
│   ├── reproductor.js      # Lógica del Reproductor
│   └── comparador.js       # Lógica del Comparador
│
├── run.sh                  # Script de automatización para Linux / macOS
├── run.bat                 # Script de automatización para Windows
└── README.md               # Documentación general del proyecto
```

## Formato del archivo `.atm`

El archivo `.atm` es el formato propietario de Autrum. Internamente es un objeto JSON con la siguiente estructura:

```json
{
  "metadata": {
    "nombre": "mi_grabacion.atm",
    "fecha": "2026-08-12T19:00:00.000Z",
    "muestrasFrecuencia": 142
  },
  "frecuencias": [
    [0, 15, 120, 80, 45],
    [2, 45, 200, 95, 30]
  ],
  "audioBase64": "data:audio/webm;base64,GkXfo59C..."
}
```

| Campo | Descripción |
|---|---|
| `metadata` | Información general del archivo (nombre, fecha, conteo de muestras). |
| `frecuencias` | Arreglo de muestras del espectro de frecuencias capturadas durante la grabación. |
| `audioBase64` | El audio original completo codificado en Base64 para su reproducción posterior. |
