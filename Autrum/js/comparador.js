// ============================================================
// AUTRUM — COMPARADOR (etapa 1: armónicos)
//
// Prefijo "compar" en todo para no chocar con otros módulos, ya
// que todos los scripts comparten el mismo scope global.
// ============================================================

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
const comparTiempoMatch = document.getElementById('compar-tiempo-match');

// --- Estado de la referencia (mic en vivo) ---
let comparRefFrames = [];
let comparAudioContext = null;
let comparAnalyser = null;
let comparMicrophone = null;
let comparStream = null;
let comparGrabando = false;
let comparAnimationId = null;
let comparFrameCount = 0;
let comparRefMediaRecorder = null;
let comparRefChunks = [];
let comparRefAudioEl = null;

// --- Estado del candidato (.atm subido) ---
let comparCand = null;
let comparResultado = null;

// --- Helpers ---
function crearAudioDesdeBlob(blob) {
    return new Audio(URL.createObjectURL(blob));
}
function liberarAudio(audioEl) {
    if (!audioEl) return;
    audioEl.pause();
    URL.revokeObjectURL(audioEl.src);
}
function actualizarUIGrabacion(grabando) {
    btnGrabarRef.disabled = grabando;
    btnDetenerRef.disabled = !grabando;
    if (grabando) btnPlayRef.disabled = btnComparar.disabled = btnPlayMatch.disabled = true;
    refStatus.style.display = grabando ? 'flex' : 'none';
}
function formatTiempoPreciso(segundos) {
    if (!isFinite(segundos) || segundos < 0) segundos = 0;
    const m = Math.floor(segundos / 60);
    const s = (segundos % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

// ============================================================
// 1. CAPTURA DE LA REFERENCIA POR MICRÓFONO
// ============================================================
btnGrabarRef.addEventListener('click', async () => {
    try {
        if (!comparAudioContext) {
            comparAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (comparAudioContext.state === 'suspended') {
            await comparAudioContext.resume();
        }

        comparStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        comparAnalyser = comparAudioContext.createAnalyser();
        comparAnalyser.fftSize = 2048;

        comparMicrophone = comparAudioContext.createMediaStreamSource(comparStream);
        comparMicrophone.connect(comparAnalyser);

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

// ============================================================
// 2. RECORTE DE SILENCIO
// ============================================================
function energiaFrame(frame) {
    return frame.reduce((suma, v) => suma + v, 0);
}

function recortarSilencio(frames, factorUmbral = 0.15) {
    if (frames.length === 0) return frames;

    const energias = frames.map(energiaFrame);
    const maxEnergia = Math.max(...energias);
    const umbral = maxEnergia * factorUmbral;

    let inicio = 0;
    while (inicio < frames.length && energias[inicio] < umbral) inicio++;

    let fin = frames.length - 1;
    while (fin > inicio && energias[fin] < umbral) fin--;

    if (inicio >= fin) return frames;

    return frames.slice(inicio, fin + 1);
}

// ============================================================
// 3. CARGA DEL CANDIDATO (.atm)
// ============================================================
async function cargarAtmComparador(archivo) {
    const texto = await archivo.text();
    const atmJSON = JSON.parse(texto);

    if (!atmJSON.frecuencias || atmJSON.frecuencias.length === 0) {
        throw new Error('El .atm no contiene datos de frecuencia.');
    }
    if (!atmJSON.audioBase64) {
        throw new Error('El .atm no contiene audio ("audioBase64" ausente).');
    }

    const frames = atmJSON.frecuencias.map(f => Array.isArray(f) ? f : f.datos);

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

// ============================================================
// 4. COMPARACIÓN POR ARMÓNICOS (pendiente)
// ============================================================
function similitudCoseno(a, b) {
    // Pendiente
}

function compararArmonicos(refFrames, candFrames, duracionCand) {
    // Pendiente
}

btnComparar.addEventListener('click', () => {
    // Pendiente
});

// ============================================================
// 5. REPRODUCIR EL SEGMENTO COINCIDENTE (pendiente)
// ============================================================
btnPlayMatch.addEventListener('click', () => {
    // Pendiente
});