// AUTRUM — COMPARADOR (etapa 1: armónicos)

const btnGrabarRef = document.getElementById('btn-grabar-ref');
const btnDetenerRef = document.getElementById('btn-detener-ref');
const btnPlayRef = document.getElementById('btn-play-ref');
const refStatus = document.getElementById('ref-status');
const refInfo = document.getElementById('ref-info');

const inputAtmCand = document.getElementById('input-atm-cand');
const candStatus = document.getElementById('cand-status');
const candFilename = document.getElementById('cand-filename');

const btnComparar = document.getElementById('btn-comparar');
const btnPlayMatch = document.getElementById('btn-play-match');
const comparConfianza = document.getElementById('compar-confianza');
const comparTiempoMatch = document.getElementById('compar-tiempo-match');

// --- Estado de la referencia (mic en vivo) ---
let comparRefFrames = [];          // espectros ya recortados de silencio: [Array(1024), ...]
let comparAudioContext = null;
let comparAnalyser = null;
let comparMicrophone = null;
let comparStream = null;
let comparGrabando = false;
let comparAnimationId = null;
let comparFrameCount = 0;          // contador propio para el submuestreo 1/10, igual que analizador.js
let comparRefMediaRecorder = null;
let comparRefChunks = [];
let comparRefAudioEl = null;       // <audio> de la referencia grabada, para reproducir

// --- Estado del candidato (.atm subido) ---
let comparCand = null;             // { nombre, frames, duracion, audioEl }
let comparResultado = null;        // { offset, confianza, tInicioSeg, tFinSeg, framesInput }

// 0. HELPERS COMPARTIDOS DENTRO DEL MÓDULO

function crearAudioDesdeBlob(blob) { // Crea un <audio> reproducible a partir de un Blob.
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preload = 'auto';
    return audio;
}

function liberarAudio(audioEl) { // Pausa y libera la URL de un <audio> creado con crearAudioDesdeBlob, si existe. 
    if (!audioEl) return;
    audioEl.pause();
    URL.revokeObjectURL(audioEl.src);
}

function actualizarUIGrabacion(grabando) { // Habilita/deshabilita los controles relacionados con la grabación de la referencia.
    btnGrabarRef.disabled = grabando;
    btnDetenerRef.disabled = !grabando;

    if (grabando) { // Mientras se graba una nueva referencia, cualquier resultado de comparación previo deja de tener sentido.
        btnPlayRef.disabled = true;
        btnComparar.disabled = true;
        btnPlayMatch.disabled = true;
    }
    refStatus.style.display = grabando ? 'flex' : 'none';
}

function formatTiempoPreciso(segundos) { // Formatea segundos como mm:ss.s (con un decimal).
    if (!isFinite(segundos) || segundos < 0) segundos = 0;
    const m = Math.floor(segundos / 60);
    const s = (segundos % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

// 1. CAPTURA DE LA REFERENCIA POR MICRÓFONO
btnGrabarRef.addEventListener('click', async () => {
    try {
        if (!comparAudioContext) {
            comparAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (comparAudioContext.state === 'suspended') {
            await comparAudioContext.resume();
        }

        comparStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // --- Análisis de frecuencia (para comparar) ---
        comparAnalyser = comparAudioContext.createAnalyser();
        comparAnalyser.fftSize = 2048; // mismo valor que analizador.js: los espectros deben ser comparables
        comparMicrophone = comparAudioContext.createMediaStreamSource(comparStream);
        comparMicrophone.connect(comparAnalyser);
        // No se conecta a destination: evita feedback/eco mientras se graba
        // --- Grabación del audio real (para poder reproducirlo después) ---
        comparRefChunks = [];
        comparRefMediaRecorder = new MediaRecorder(comparStream);
        comparRefMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) comparRefChunks.push(e.data);
        };
        comparRefMediaRecorder.onstop = () => {
            liberarAudio(comparRefAudioEl);
            comparRefAudioEl = crearAudioDesdeBlob(new Blob(comparRefChunks, { type: 'audio/webm' }));
            btnPlayRef.disabled = false;
        };
        comparRefMediaRecorder.start();

        comparRefFrames = [];
        comparFrameCount = 0;
        comparGrabando = true;

        actualizarUIGrabacion(true);
        refInfo.textContent = 'Grabando... pronuncia la palabra o frase';
        capturarFramesReferencia();
    } catch (err) {
        console.error('Error al acceder al micrófono:', err);
        alert('No se pudo acceder al micrófono. Asegúrese de dar permisos.');
    }
});

function capturarFramesReferencia() {
    if (!comparGrabando) return;
    comparAnimationId = requestAnimationFrame(capturarFramesReferencia);

    const bufferLength = comparAnalyser.frequencyBinCount;
    const dataArrayFreq = new Uint8Array(bufferLength);
    comparAnalyser.getByteFrequencyData(dataArrayFreq);

    // Mismo criterio de submuestreo que analizador.js: 1 de cada 10 frames de animación. 
    comparFrameCount++;
    if (comparFrameCount % 10 === 0) {
        comparRefFrames.push(Array.from(dataArrayFreq));
    }
}

btnDetenerRef.addEventListener('click', () => {
    comparGrabando = false;
    cancelAnimationFrame(comparAnimationId);
    if (comparRefMediaRecorder && comparRefMediaRecorder.state !== 'inactive') {
        comparRefMediaRecorder.stop();
    }
    if (comparMicrophone) {
        comparMicrophone.disconnect();
        comparMicrophone = null;
    }
    if (comparStream) {
        comparStream.getTracks().forEach(track => track.stop());
        comparStream = null;
    }

    actualizarUIGrabacion(false);
    // Se descartan los frames de silencio al inicio/fin
    const framesOriginales = comparRefFrames.length;
    comparRefFrames = recortarSilencio(comparRefFrames);

    refInfo.textContent =
        `Referencia lista — ${comparRefFrames.length} frames útiles (de ${framesOriginales} capturados)`;
    actualizarBotonComparar();
});

btnPlayRef.addEventListener('click', () => {
    if (!comparRefAudioEl) return;
    comparRefAudioEl.currentTime = 0;
    comparRefAudioEl.play();
});

// 2. RECORTE DE SILENCIO

// Energía de un frame = suma de todas sus magnitudes de frecuencia.
// Silencio → suma baja. Voz → suma alta.
function energiaFrame(frame) {
    return frame.reduce((suma, v) => suma + v, 0);
}

// Recorta los frames de silencio al inicio y al final de la referencia,
// dejando solo el tramo con voz real. El umbral es relativo al pico máximo
// de ESA MISMA grabación (no un número fijo), porque el volumen absoluto
// varía mucho según el micrófono y la persona.
function recortarSilencio(frames, factorUmbral = 0.15) {
    if (frames.length === 0) return frames;

    const energias = frames.map(energiaFrame);
    const maxEnergia = Math.max(...energias);
    const umbral = maxEnergia * factorUmbral;

    let inicio = 0;
    while (inicio < frames.length && energias[inicio] < umbral) inicio++;

    let fin = frames.length - 1;
    while (fin > inicio && energias[fin] < umbral) fin--;

    // Si toda la grabación fue "silencio" (nunca superó el umbral), se
    // devuelve sin recortar en vez de un array vacío.
    if (inicio >= fin) return frames;

    return frames.slice(inicio, fin + 1);
}

// 3. CARGA DEL CANDIDATO (.atm)
async function cargarAtmComparador(archivo) {
    const texto = await archivo.text();
    const atmJSON = JSON.parse(texto);

    if (!atmJSON.frecuencias || atmJSON.frecuencias.length === 0) {
        throw new Error('El .atm no contiene datos de frecuencia.');
    }
    if (!atmJSON.audioBase64) {
        throw new Error('El .atm no contiene audio ("audioBase64" ausente).');
    }
    // El .atm de analizador.js guarda trazosFrecuencia como array plano (sin timestamp). 
    const frames = atmJSON.frecuencias.map(f => Array.isArray(f) ? f : f.datos);
    // Se decodifica el audio dos veces con propósitos distintos:
    // - audioBuffer: para obtener la duración exacta (necesaria para convertir "índice de frame" a "segundos").
    // - audioEl: elemento <audio> real, para poder reproducir con play/pause/currentTime de forma simple.
    const respuesta = await fetch(atmJSON.audioBase64);
    const blob = await respuesta.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const ctxTemp = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctxTemp.decodeAudioData(arrayBuffer.slice(0));
    ctxTemp.close();

    return {
        nombre: atmJSON.metadata?.nombre || archivo.name,
        frames,
        duracion: audioBuffer.duration,
        audioEl: crearAudioDesdeBlob(blob)
    };
}

inputAtmCand.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    try {
        // Si había un candidato previo cargado, se libera su audio antes de
        // reemplazarlo para no dejar memoria/objetos colgados.
        liberarAudio(comparCand?.audioEl);

        comparCand = await cargarAtmComparador(e.target.files[0]);
        candFilename.textContent = comparCand.nombre;
        candStatus.style.display = 'flex';
        btnPlayMatch.disabled = true;
        actualizarBotonComparar();
    } catch (err) {
        console.error(err);
        alert('No se pudo leer el archivo .atm: ' + err.message);
    }
});

function actualizarBotonComparar() {
    btnComparar.disabled = !(
        comparRefFrames.length > 0 &&
        comparCand &&
        comparRefFrames.length <= comparCand.frames.length
    );
}

// 4. COMPARACIÓN POR ARMÓNICOS (ventana deslizante + similitud coseno)

// Similitud coseno entre dos espectros: mide qué tan parecida es la FORMA
// del espectro (proporción relativa entre frecuencias), ignorando el
// volumen absoluto. Resultado entre 0 y 1 (con datos de FFT, siempre
// positivos). 1 = espectros idénticos en forma.
function similitudCoseno(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Ventana deslizante: recorre cada posición posible donde la referencia
// podría encajar dentro del candidato, comparando frame a frame en cada
// posición, y se queda con la de mayor similitud promedio.
function compararArmonicos(refFrames, candFrames, duracionCand) {
    const framesInput = refFrames.length;
    const framesCand = candFrames.length;
    const maxOffset = framesCand - framesInput;

    let mejorOffset = 0;
    let mejorScore = -Infinity;

    for (let offset = 0; offset <= maxOffset; offset++) {
        let suma = 0;
        for (let i = 0; i < framesInput; i++) {
            suma += similitudCoseno(refFrames[i], candFrames[offset + i]);
        }
        const promedio = suma / framesInput;
        if (promedio > mejorScore) {
            mejorScore = promedio;
            mejorOffset = offset;
        }
    }

    // Conversión de índice de frame a segundos: se asume que los frames
    // están repartidos uniformemente a lo largo de la duración total del
    // candidato (válido porque el submuestreo 1/10 es constante).
    const segPorFrame = duracionCand / framesCand;
    const tInicioSeg = mejorOffset * segPorFrame;
    const ultimoFrame = Math.min(mejorOffset + framesInput - 1, framesCand - 1);
    const tFinSeg = ultimoFrame * segPorFrame;

    return {
        offset: mejorOffset,
        confianza: 0, //PENDIENTE
        tInicioSeg,
        tFinSeg,
        framesInput
    };
}

btnComparar.addEventListener('click', () => {
    comparResultado = compararArmonicos(comparRefFrames, comparCand.frames, comparCand.duracion);
    comparTiempoMatch.textContent =
        `${formatTiempoPreciso(comparResultado.tInicioSeg)} — ${formatTiempoPreciso(comparResultado.tFinSeg)}`;

    btnPlayMatch.disabled = false;
});

// 5. REPRODUCIR EL SEGMENTO COINCIDENTE
btnPlayMatch.addEventListener('click', () => {
    if (!comparResultado || !comparCand?.audioEl) return;

    const { tInicioSeg, tFinSeg } = comparResultado;
    const audioEl = comparCand.audioEl;

    audioEl.currentTime = tInicioSeg;
    audioEl.play();

    // Se detiene automáticamente al llegar al final del segmento coincidente, para que suene solo el fragmento encontrado y no el resto del audio.
    const onTimeUpdate = () => {
        if (audioEl.currentTime >= tFinSeg) {
            audioEl.pause();
            audioEl.removeEventListener('timeupdate', onTimeUpdate);
        }
    };
    audioEl.addEventListener('timeupdate', onTimeUpdate);
});
