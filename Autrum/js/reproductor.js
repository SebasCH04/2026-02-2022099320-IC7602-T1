// ============================================================
// AUTRUM — REPRODUCTOR
// Carga un archivo .atm (generado por el Analizador), reproduce
// el audio y sincroniza dos gráficas: forma de onda (con zoom)
// y espectro de frecuencia en vivo mediante Web Audio API.
//
// NOTA: este script comparte el scope global con analizador.js
// (no se usan módulos ES). Todos los identificadores usan el
// prefijo "repr" para no chocar con las variables de los otros
// módulos (audioContext, analyser, isRecording, etc.).
// ============================================================

// --- Referencias a UI ---
const inputAtm = document.getElementById('input-atm');
const atmStatus = document.getElementById('atm-status');
const atmFilename = document.getElementById('atm-filename');
const atmMeta = document.getElementById('atm-meta');

const btnPlayAtm = document.getElementById('btn-play-atm');
const btnPausarAtm = document.getElementById('btn-pausar-atm');
const btnDetenerAtm = document.getElementById('btn-detener-atm');

const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');

const seekBar = document.getElementById('seek-bar');
const tiempoActualEl = document.getElementById('tiempo-actual');
const tiempoTotalEl = document.getElementById('tiempo-total');

const canvasReprTiempo = document.getElementById('canvas-reproductor-tiempo');
const ctxReprTiempo = canvasReprTiempo.getContext('2d');
const canvasReprFrecuencia = document.getElementById('canvas-reproductor-frecuencia');
const ctxReprFrecuencia = canvasReprFrecuencia.getContext('2d');

// --- Elemento de audio real (controla reproducción/pausa/seek nativo) ---
const reprAudioEl = new Audio();
reprAudioEl.preload = 'auto';

// --- Estado del Reproductor ---
let reprAudioContext = null;
let reprAnalyser = null;
let reprGraphConectado = false; // createMediaElementSource solo puede llamarse una vez por <audio>
let reprAudioBuffer = null;     // AudioBuffer decodificado para dibujar la forma de onda
let reprAnimationId = null;
let reprIsPlaying = false;
let reprDragging = false;
let reprDragStartX = 0;
let reprDragStartView = 0;
let reprMoved = false;

// Ventana visible de la forma de onda (para el zoom)
let reprViewStart = 0;    // segundos
let reprViewDuration = 0; // segundos visibles en pantalla

function ajustarCanvasReproductor() {
    canvasReprTiempo.width = canvasReprTiempo.offsetWidth;
    canvasReprTiempo.height = canvasReprTiempo.offsetHeight;
    canvasReprFrecuencia.width = canvasReprFrecuencia.offsetWidth;
    canvasReprFrecuencia.height = canvasReprFrecuencia.offsetHeight;
    dibujarOnda();
}
window.addEventListener('resize', ajustarCanvasReproductor);
window.addEventListener('load', ajustarCanvasReproductor);

function formatTime(segundos) {
    if (!isFinite(segundos) || segundos < 0) segundos = 0;
    const m = Math.floor(segundos / 60);
    const s = Math.floor(segundos % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// 1. CARGA DEL ARCHIVO .ATM
// ============================================================
inputAtm.addEventListener('change', async (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;

    let atmJSON;
    try {
        const texto = await archivo.text();
        atmJSON = JSON.parse(texto);
    } catch (e) {
        alert('El archivo seleccionado no es un .atm válido (JSON corrupto o formato incorrecto).');
        return;
    }

    if (!atmJSON.audioBase64) {
        alert('El archivo .atm no contiene audio ("audioBase64" ausente).');
        return;
    }

    // Detener cualquier reproducción previa antes de cargar el nuevo archivo
    pausarReproduccion();
    reprAudioEl.currentTime = 0;

    try {
        // El audio viaja como Data URL (data:audio/webm;base64,...)
        const respuesta = await fetch(atmJSON.audioBase64);
        const blob = await respuesta.blob();
        const arrayBuffer = await blob.arrayBuffer();

        // Fuente de reproducción real
        const objectUrl = URL.createObjectURL(blob);
        if (reprAudioEl.src) URL.revokeObjectURL(reprAudioEl.src);
        reprAudioEl.src = objectUrl;

        // Decodificar para poder dibujar la forma de onda completa (necesita un ArrayBuffer "fresco")
        const arrayBufferParaDecodificar = arrayBuffer.slice(0);
        const contextoDecodificacion = new (window.AudioContext || window.webkitAudioContext)();
        reprAudioBuffer = await contextoDecodificacion.decodeAudioData(arrayBufferParaDecodificar);
        contextoDecodificacion.close();

        // Metadatos
        atmFilename.textContent = atmJSON.metadata?.nombre || archivo.name;
        const muestras = atmJSON.metadata?.muestrasFrecuencia ?? (atmJSON.frecuencias?.length || 0);
        atmMeta.textContent = ` — ${muestras} muestras de frecuencia — ${formatTime(reprAudioBuffer.duration)}`;
        atmStatus.style.display = 'flex';

        // Reiniciar zoom a la vista completa
        reprViewStart = 0;
        reprViewDuration = reprAudioBuffer.duration;

        // Configurar barra de progreso
        seekBar.min = 0;
        seekBar.max = reprAudioBuffer.duration;
        seekBar.value = 0;
        seekBar.disabled = false;
        tiempoTotalEl.textContent = formatTime(reprAudioBuffer.duration);
        tiempoActualEl.textContent = '00:00';

        // Habilitar controles
        btnPlayAtm.disabled = false;
        btnPausarAtm.disabled = true;
        btnDetenerAtm.disabled = true;
        btnZoomIn.disabled = false;
        btnZoomOut.disabled = false;
        btnZoomReset.disabled = false;

        dibujarOnda();
        limpiarFrecuencia();
    } catch (err) {
        console.error('Error al procesar el archivo .atm:', err);
        alert('No se pudo decodificar el audio contenido en el archivo .atm.');
    }
});

// ============================================================
// 2. CONTROLES DE REPRODUCCIÓN
// ============================================================

function conectarGrafoDeAudio() {
    if (reprGraphConectado) return;
    reprAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    reprAnalyser = reprAudioContext.createAnalyser();
    reprAnalyser.fftSize = 2048;

    const fuente = reprAudioContext.createMediaElementSource(reprAudioEl);
    fuente.connect(reprAnalyser);
    reprAnalyser.connect(reprAudioContext.destination);
    reprGraphConectado = true;
}

btnPlayAtm.addEventListener('click', async () => {
    conectarGrafoDeAudio();
    if (reprAudioContext.state === 'suspended') {
        await reprAudioContext.resume();
    }
    await reprAudioEl.play();
    reprIsPlaying = true;

    btnPlayAtm.disabled = true;
    btnPausarAtm.disabled = false;
    btnDetenerAtm.disabled = false;

    bucleDeAnimacion();
});

btnPausarAtm.addEventListener('click', () => {
    if (reprIsPlaying) {
        pausarReproduccion();
        btnPausarAtm.innerHTML = '<i class="fas fa-play"></i> Continuar';
    } else {
        reprAudioEl.play();
        reprIsPlaying = true;
        btnPausarAtm.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        bucleDeAnimacion();
    }
});

btnDetenerAtm.addEventListener('click', () => {
    pausarReproduccion();
    reprAudioEl.currentTime = 0;
    seekBar.value = 0;
    tiempoActualEl.textContent = '00:00';

    btnPlayAtm.disabled = false;
    btnPausarAtm.disabled = true;
    btnPausarAtm.innerHTML = '<i class="fas fa-pause"></i> Pausar';
    btnDetenerAtm.disabled = true;

    dibujarOnda();
    limpiarFrecuencia();
});

reprAudioEl.addEventListener('ended', () => {
    pausarReproduccion();
    btnPlayAtm.disabled = false;
    btnPausarAtm.disabled = true;
    btnPausarAtm.innerHTML = '<i class="fas fa-pause"></i> Pausar';
    btnDetenerAtm.disabled = true;
    limpiarFrecuencia();
});

function pausarReproduccion() {
    reprIsPlaying = false;
    reprAudioEl.pause();
    if (reprAnimationId) cancelAnimationFrame(reprAnimationId);
}

// Barra de progreso (seek manual)
seekBar.addEventListener('input', () => {
    reprAudioEl.currentTime = parseFloat(seekBar.value);
    if (!reprIsPlaying) dibujarOnda();
});

// ============================================================
// 3. DOMINIO DEL TIEMPO — forma de onda estática + zoom
// ============================================================

function dibujarOnda() {
    if (!reprAudioBuffer) {
        ctxReprTiempo.fillStyle = '#0f172a';
        ctxReprTiempo.fillRect(0, 0, canvasReprTiempo.width, canvasReprTiempo.height);
        return;
    }

    const datos = reprAudioBuffer.getChannelData(0); // canal 0
    const sampleRate = reprAudioBuffer.sampleRate;
    const w = canvasReprTiempo.width;
    const h = canvasReprTiempo.height;
    const mitad = h / 2;

    const muestraInicio = Math.floor(reprViewStart * sampleRate);
    const muestraFin = Math.min(datos.length, Math.floor((reprViewStart + reprViewDuration) * sampleRate));
    const muestrasPorPixel = Math.max(1, Math.floor((muestraFin - muestraInicio) / w));

    ctxReprTiempo.fillStyle = '#0f172a';
    ctxReprTiempo.fillRect(0, 0, w, h);

    ctxReprTiempo.strokeStyle = '#3b82f6';
    ctxReprTiempo.lineWidth = 1;
    ctxReprTiempo.beginPath();

    for (let x = 0; x < w; x++) {
        const inicio = muestraInicio + x * muestrasPorPixel;
        let min = 1.0, max = -1.0;
        for (let j = 0; j < muestrasPorPixel; j++) {
            const idx = inicio + j;
            if (idx >= datos.length) break;
            const v = datos[idx];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        if (min > max) { min = 0; max = 0; }
        ctxReprTiempo.moveTo(x, mitad + min * mitad);
        ctxReprTiempo.lineTo(x, mitad + max * mitad);
    }
    ctxReprTiempo.stroke();

    dibujarPlayhead();
}

function dibujarPlayhead() {
    if (!reprAudioBuffer) return;
    const t = reprAudioEl.currentTime;
    if (t < reprViewStart || t > reprViewStart + reprViewDuration) return; // fuera de la vista actual

    const w = canvasReprTiempo.width;
    const h = canvasReprTiempo.height;
    const x = ((t - reprViewStart) / reprViewDuration) * w;

    ctxReprTiempo.strokeStyle = '#f59e0b';
    ctxReprTiempo.lineWidth = 2;
    ctxReprTiempo.beginPath();
    ctxReprTiempo.moveTo(x, 0);
    ctxReprTiempo.lineTo(x, h);
    ctxReprTiempo.stroke();
}

// --- Zoom in / out / reset ---
btnZoomIn.addEventListener('click', () => {
    const centro = reprAudioEl.currentTime;
    reprViewDuration = Math.max(0.2, reprViewDuration / 2);
    reprViewStart = clampVista(centro - reprViewDuration / 2);
    dibujarOnda();
});

btnZoomOut.addEventListener('click', () => {
    const centro = reprViewStart + reprViewDuration / 2;
    reprViewDuration = Math.min(reprAudioBuffer.duration, reprViewDuration * 2);
    reprViewStart = clampVista(centro - reprViewDuration / 2);
    dibujarOnda();
});

btnZoomReset.addEventListener('click', () => {
    reprViewStart = 0;
    reprViewDuration = reprAudioBuffer.duration;
    dibujarOnda();
});

function clampVista(inicio) {
    if (!reprAudioBuffer) return 0;
    const maxInicio = Math.max(0, reprAudioBuffer.duration - reprViewDuration);
    return Math.min(Math.max(0, inicio), maxInicio);
}

// --- Interacción con el canvas: click para saltar, arrastrar para desplazar ---
canvasReprTiempo.addEventListener('mousedown', (e) => {
    if (!reprAudioBuffer) return;
    reprDragging = true;
    reprMoved = false;
    reprDragStartX = e.offsetX;
    reprDragStartView = reprViewStart;
});

window.addEventListener('mousemove', (e) => {
    if (!reprDragging || !reprAudioBuffer) return;
    const dx = e.offsetX !== undefined && e.target === canvasReprTiempo ? e.offsetX - reprDragStartX : 0;
    if (Math.abs(dx) > 2) reprMoved = true;
    const deltaTiempo = (dx / canvasReprTiempo.width) * reprViewDuration;
    reprViewStart = clampVista(reprDragStartView - deltaTiempo);
    dibujarOnda();
});

window.addEventListener('mouseup', (e) => {
    if (!reprDragging) return;
    reprDragging = false;
    // Si no hubo arrastre real, se interpreta como "click para saltar"
    if (!reprMoved && reprAudioBuffer && e.target === canvasReprTiempo) {
        const x = e.offsetX;
        const t = reprViewStart + (x / canvasReprTiempo.width) * reprViewDuration;
        reprAudioEl.currentTime = Math.min(Math.max(0, t), reprAudioBuffer.duration);
        seekBar.value = reprAudioEl.currentTime;
        tiempoActualEl.textContent = formatTime(reprAudioEl.currentTime);
        dibujarOnda();
    }
});

// ============================================================
// 4. DOMINIO DE LA FRECUENCIA — espectro en vivo durante playback
// ============================================================

function limpiarFrecuencia() {
    ctxReprFrecuencia.fillStyle = '#0f172a';
    ctxReprFrecuencia.fillRect(0, 0, canvasReprFrecuencia.width, canvasReprFrecuencia.height);
}

function dibujarFrecuencia() {
    if (!reprAnalyser) return;
    const bufferLength = reprAnalyser.frequencyBinCount;
    const datos = new Uint8Array(bufferLength);
    reprAnalyser.getByteFrequencyData(datos);

    ctxReprFrecuencia.fillStyle = '#0f172a';
    ctxReprFrecuencia.fillRect(0, 0, canvasReprFrecuencia.width, canvasReprFrecuencia.height);

    const barWidth = (canvasReprFrecuencia.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = datos[i];
        const r = barHeight + (25 * (i / bufferLength));
        const g = 250 * (i / bufferLength);
        const b = 50;
        ctxReprFrecuencia.fillStyle = `rgb(${r},${g},${b})`;
        ctxReprFrecuencia.fillRect(x, canvasReprFrecuencia.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
    }
}

// ============================================================
// 5. BUCLE PRINCIPAL DE ANIMACIÓN (mientras reproduce)
// ============================================================
function bucleDeAnimacion() {
    if (!reprIsPlaying) return;
    reprAnimationId = requestAnimationFrame(bucleDeAnimacion);

    seekBar.value = reprAudioEl.currentTime;
    tiempoActualEl.textContent = formatTime(reprAudioEl.currentTime);

    // Auto-scroll de la vista si el playhead sale de la ventana con zoom activo
    if (reprAudioEl.currentTime > reprViewStart + reprViewDuration || reprAudioEl.currentTime < reprViewStart) {
        reprViewStart = clampVista(reprAudioEl.currentTime - reprViewDuration / 2);
    }

    dibujarOnda();
    dibujarFrecuencia();
}
