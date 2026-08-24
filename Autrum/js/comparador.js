// AUTRUM — COMPARADOR (armonicos y potencia)

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
let comparRefFrames = [];          // muestras { timestamp, datos, potencia }, sin silencio externo
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
let comparRefInicioMs = 0;

// --- Estado del candidato (.atm subido) ---
let comparCand = null;             // { nombre, frames, duracion, audioEl }
let comparResultado = null;        // resultado combinado de armonicos y potencia

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

function clampComparador(valor, minimo = 0, maximo = 1) {
    return Math.min(Math.max(valor, minimo), maximo);
}

// Media de cuadrados de las muestras temporales (RMS^2), es la misma metrica
// utilizada por analizador.js al crear los archivos .atm version 2
function calcularPotenciaTemporalComparador(muestras) {
    if (!muestras.length) return 0;

    let sumaCuadrados = 0;
    for (const muestra of muestras) {
        sumaCuadrados += muestra * muestra;
    }
    return sumaCuadrados / muestras.length;
}

// Compatibilidad con archivos .atm antiguos que solo guardaban el espectro
// byte. No es potencia fisica, se usa unicamente como aproximacion
function estimarPotenciaDesdeEspectro(datos) {
    if (!datos.length) return 0;

    let sumaCuadrados = 0;
    for (const magnitud of datos) {
        const normalizada = magnitud / 255;
        sumaCuadrados += normalizada * normalizada;
    }
    return sumaCuadrados / datos.length;
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
        comparRefInicioMs = performance.now();
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
        const dataArrayPotencia = new Float32Array(comparAnalyser.fftSize);
        comparAnalyser.getFloatTimeDomainData(dataArrayPotencia);

        comparRefFrames.push({
            timestamp: (performance.now() - comparRefInicioMs) / 1000,
            datos: Array.from(dataArrayFreq),
            potencia: calcularPotenciaTemporalComparador(dataArrayPotencia)
        });
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

// Para los .atm nuevos se usa potencia temporal real, el fallback conserva
// compatibilidad con muestras antiguas que no poseen el campo de potencia.
function energiaFrame(frame) {
    return Number.isFinite(frame.potencia)
        ? frame.potencia
        : estimarPotenciaDesdeEspectro(frame.datos || frame);
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
    // Se decodifica el audio dos veces con propósitos distintos:
    // - audioBuffer: para obtener la duración exacta (necesaria para convertir "índice de frame" a "segundos").
    // - audioEl: elemento <audio> real, para poder reproducir con play/pause/currentTime de forma simple.
    const respuesta = await fetch(atmJSON.audioBase64);
    const blob = await respuesta.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const ctxTemp = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctxTemp.decodeAudioData(arrayBuffer.slice(0));
    ctxTemp.close();

    const cantidadFrames = atmJSON.frecuencias.length;
    const intervaloEstimado = audioBuffer.duration / cantidadFrames;
    const frames = atmJSON.frecuencias.map((frame, indice) => {
        const datos = Array.isArray(frame) ? frame : frame.datos;
        if (!Array.isArray(datos) || datos.length === 0) {
            throw new Error(`La muestra de frecuencia ${indice} no contiene datos válidos.`);
        }

        return {
            datos,
            potencia: Number.isFinite(frame?.potencia)
                ? frame.potencia
                : estimarPotenciaDesdeEspectro(datos),
            timestamp: Number.isFinite(frame?.timestamp)
                ? frame.timestamp
                : indice * intervaloEstimado
        };
    });

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

function similitudArmonicaVentana(refFrames, candFrames, offset) {
    let suma = 0;
    for (let i = 0; i < refFrames.length; i++) {
        suma += similitudCoseno(refFrames[i].datos, candFrames[offset + i].datos);
    }
    return suma / refFrames.length;
}

// Convierte una curva de potencia a dB y la estandariza, al retirar media y
// escala se compara la forma temporal, no el volumen absoluto del microfono
function normalizarCurvaPotencia(frames) {
    const epsilon = 1e-12;
    const valoresDb = frames.map(frame => 10 * Math.log10(Math.max(frame.potencia, epsilon)));
    const media = valoresDb.reduce((suma, valor) => suma + valor, 0) / valoresDb.length;
    const varianza = valoresDb.reduce((suma, valor) => suma + (valor - media) ** 2, 0) / valoresDb.length;
    const desviacion = Math.sqrt(varianza);

    if (desviacion < 1e-9) return valoresDb.map(() => 0);
    return valoresDb.map(valor => (valor - media) / desviacion);
}

function similitudPotencia(refFrames, candFrames, offset) {
    const curvaRef = normalizarCurvaPotencia(refFrames);
    const ventanaCand = candFrames.slice(offset, offset + refFrames.length);
    const curvaCand = normalizarCurvaPotencia(ventanaCand);

    let producto = 0;
    let magnitudRef = 0;
    let magnitudCand = 0;
    for (let i = 0; i < curvaRef.length; i++) {
        producto += curvaRef[i] * curvaCand[i];
        magnitudRef += curvaRef[i] * curvaRef[i];
        magnitudCand += curvaCand[i] * curvaCand[i];
    }

    if (magnitudRef === 0 || magnitudCand === 0) return 0;
    const correlacion = producto / Math.sqrt(magnitudRef * magnitudCand);
    return clampComparador((correlacion + 1) / 2);
}

function seleccionarCandidatosDistintos(resultados, cantidad, separacionMinima) {
    const seleccionados = [];
    for (const resultado of resultados) {
        const estaSeparado = seleccionados.every(
            seleccionado => Math.abs(seleccionado.offset - resultado.offset) >= separacionMinima
        );
        if (estaSeparado) seleccionados.push(resultado);
        if (seleccionados.length === cantidad) break;
    }
    return seleccionados;
}

// Primero, ventana deslizante por armonicos, luego, seleccion de candidatos,
//  despues, validacion por potencia y por ultimo calculo de confianza
function compararDosEtapas(refFrames, candFrames, duracionCand) {
    const framesInput = refFrames.length;
    const framesCand = candFrames.length;
    const maxOffset = framesCand - framesInput;

    const resultadosArmonicos = [];

    for (let offset = 0; offset <= maxOffset; offset++) {
        resultadosArmonicos.push({
            offset,
            similitudArmonica: similitudArmonicaVentana(refFrames, candFrames, offset)
        });
    }

    resultadosArmonicos.sort((a, b) => b.similitudArmonica - a.similitudArmonica);

    // Etapa 1, conservar varias ubicaciones armonicamente prometedoras y
    // suficientemente separadas para evitar elegir diez offsets adyacentes.
    const candidatos = seleccionarCandidatosDistintos(
        resultadosArmonicos,
        Math.min(10, resultadosArmonicos.length),
        Math.max(1, Math.floor(framesInput / 2))
    );

    // Etapa 2, comparar la curva de potencia y combinar ambos criterios.
    for (const candidato of candidatos) {
        candidato.similitudPotencia = similitudPotencia(refFrames, candFrames, candidato.offset);
        candidato.puntuacion = (0.7 * candidato.similitudArmonica) + (0.3 * candidato.similitudPotencia);
    }
    candidatos.sort((a, b) => b.puntuacion - a.puntuacion);

    const mejor = candidatos[0];
    const segundo = candidatos[1];
    const segundoScore = segundo?.puntuacion ?? 0;
    const margen = clampComparador(
        (mejor.puntuacion - segundoScore) / Math.max(1 - segundoScore, 1e-9)
    );
    const confianza = 100 * clampComparador((0.85 * mejor.puntuacion) + (0.15 * margen));

    const segPorFrameEstimado = duracionCand / framesCand;
    const tInicioSeg = candFrames[mejor.offset].timestamp;
    const ultimoFrame = Math.min(mejor.offset + framesInput - 1, framesCand - 1);
    const tFinSeg = Math.min(
        duracionCand,
        candFrames[ultimoFrame].timestamp + segPorFrameEstimado
    );

    return {
        offset: mejor.offset,
        confianza,
        similitudArmonica: mejor.similitudArmonica,
        similitudPotencia: mejor.similitudPotencia,
        tInicioSeg,
        tFinSeg,
        framesInput
    };
}

btnComparar.addEventListener('click', () => {
    comparResultado = compararDosEtapas(comparRefFrames, comparCand.frames, comparCand.duracion);
    comparConfianza.textContent = `${comparResultado.confianza.toFixed(1)}%`;
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
