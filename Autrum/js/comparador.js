// ============================================================
// AUTRUM — COMPARADOR (armonicos y potencia)
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
const comparConfianza = document.getElementById('compar-confianza');
const comparTiempoMatch = document.getElementById('compar-tiempo-match');

// NUEVO: Referencias UI para los gráficos
const comparGraphsContainer = document.getElementById('compar-graphs-container');
const canvasComparRef = document.getElementById('canvas-comparador-ref');
const ctxComparRef = canvasComparRef?.getContext('2d');
const canvasComparCand = document.getElementById('canvas-comparador-cand');
const ctxComparCand = canvasComparCand?.getContext('2d');


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
let comparRefInicioMs = 0;
// NUEVO: Guardar el buffer de la referencia para dibujar la onda
let comparRefAudioBuffer = null; 

// --- Estado del candidato (.atm subido) ---
let comparCand = null;             // { nombre, frames, duracion, audioEl, buffer }
let comparResultado = null;        


// NUEVO: Ajuste de canvas del comparador (similar a reproductor.js)
function ajustarCanvasComparador() {
    if(canvasComparRef && canvasComparCand) {
        ajustarCanvas(canvasComparRef);
        ajustarCanvas(canvasComparCand);
        
        // Redibujar si los buffers ya existen
        if (comparRefAudioBuffer) {
            dibujarOndaBuffer(ctxComparRef, comparRefAudioBuffer, canvasComparRef.width, canvasComparRef.height, 0, comparRefAudioBuffer.duration);
        }
        if (comparCand && comparCand.buffer) {
            dibujarOndaBuffer(ctxComparCand, comparCand.buffer, canvasComparCand.width, canvasComparCand.height, 0, comparCand.duracion);
        }
    }
}
window.addEventListener('resize', ajustarCanvasComparador);
window.addEventListener('load', ajustarCanvasComparador);


// 0. HELPERS COMPARTIDOS DENTRO DEL MÓDULO

function crearAudioDesdeBlob(blob) { 
    const audio = new Audio(URL.createObjectURL(blob));
    audio.preload = 'auto';
    return audio;
}

function liberarAudio(audioEl) {  
    if (!audioEl) return;
    audioEl.pause();
    URL.revokeObjectURL(audioEl.src);
}

function actualizarUIGrabacion(grabando) { 
    btnGrabarRef.disabled = grabando;
    btnDetenerRef.disabled = !grabando;

    if (grabando) { 
        btnPlayRef.disabled = true;
        btnComparar.disabled = true;
        btnPlayMatch.disabled = true;
        
        // NUEVO: Limpiar grafica de referencia al iniciar nueva grabacion
        comparRefAudioBuffer = null;
        if(ctxComparRef) limpiarCanvas(ctxComparRef, canvasComparRef.width, canvasComparRef.height);
    }
    refStatus.style.display = grabando ? 'flex' : 'none';
}

function formatTiempoPreciso(segundos) { 
    if (!isFinite(segundos) || segundos < 0) segundos = 0;
    const m = Math.floor(segundos / 60);
    const s = (segundos % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

function clampComparador(valor, minimo = 0, maximo = 1) {
    return Math.min(Math.max(valor, minimo), maximo);
}

function calcularPotenciaTemporalComparador(muestras) {
    if (!muestras.length) return 0;
    let sumaCuadrados = 0;
    for (const muestra of muestras) {
        sumaCuadrados += muestra * muestra;
    }
    return sumaCuadrados / muestras.length;
}

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

        comparAnalyser = comparAudioContext.createAnalyser();
        comparAnalyser.fftSize = 2048; 
        comparMicrophone = comparAudioContext.createMediaStreamSource(comparStream);
        comparMicrophone.connect(comparAnalyser);
        
        comparRefChunks = [];
        comparRefMediaRecorder = new MediaRecorder(comparStream);
        comparRefMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) comparRefChunks.push(e.data);
        };
        
        // NUEVO: Bloque modificado para decodificar el blob y dibujar la grafica
        comparRefMediaRecorder.onstop = async () => {
            liberarAudio(comparRefAudioEl);
            const blob = new Blob(comparRefChunks, { type: 'audio/webm' });
            comparRefAudioEl = crearAudioDesdeBlob(blob);
            btnPlayRef.disabled = false;
            
         
            ajustarCanvasComparador();
            
            // Decodificar audio para dibujarlo
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const ctxTemp = new (window.AudioContext || window.webkitAudioContext)();
                comparRefAudioBuffer = await ctxTemp.decodeAudioData(arrayBuffer);
                ctxTemp.close();
                dibujarOndaBuffer(ctxComparRef, comparRefAudioBuffer, canvasComparRef.width, canvasComparRef.height, 0, comparRefAudioBuffer.duration);
            } catch(e) {
                console.error("No se pudo decodificar la referencia para graficar", e);
            }
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

// 2. RECORTE DE SILENCIO (Sin cambios)

function energiaFrame(frame) {
    return Number.isFinite(frame.potencia)
        ? frame.potencia
        : estimarPotenciaDesdeEspectro(frame.datos || frame);
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
        audioEl: crearAudioDesdeBlob(blob),
        buffer: audioBuffer // NUEVO: Exportar el buffer para poder dibujarlo
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
        
  
        ajustarCanvasComparador();
        dibujarOndaBuffer(ctxComparCand, comparCand.buffer, canvasComparCand.width, canvasComparCand.height, 0, comparCand.duracion);
        
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

// 4. COMPARACIÓN POR ARMÓNICOS (Sin cambios en algoritmos, solo UI)

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

    const candidatos = seleccionarCandidatosDistintos(
        resultadosArmonicos,
        Math.min(10, resultadosArmonicos.length),
        Math.max(1, Math.floor(framesInput / 2))
    );

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

// NUEVO: Dibujar un rectángulo resaltando la zona de coincidencia
function resaltarCoincidencia(tInicio, tFin) {
    if (!comparCand?.buffer || !ctxComparCand) return;
    
    // Redibujar la onda original limpia
    dibujarOndaBuffer(ctxComparCand, comparCand.buffer, canvasComparCand.width, canvasComparCand.height, 0, comparCand.duracion);
    
    // Calcular coordenadas
    const w = canvasComparCand.width;
    const duracion = comparCand.duracion;
    const xInicio = (tInicio / duracion) * w;
    const xFin = (tFin / duracion) * w;
    const ancho = xFin - xInicio;

    // Dibujar fondo semi-transparente amarillo/naranja
    ctxComparCand.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctxComparCand.fillRect(xInicio, 0, ancho, canvasComparCand.height);
    
    // Dibujar bordes
    ctxComparCand.strokeStyle = '#f59e0b';
    ctxComparCand.lineWidth = 2;
    ctxComparCand.strokeRect(xInicio, 0, ancho, canvasComparCand.height);
}

btnComparar.addEventListener('click', () => {
    comparResultado = compararDosEtapas(comparRefFrames, comparCand.frames, comparCand.duracion);
    comparConfianza.textContent = `${comparResultado.confianza.toFixed(1)}%`;
    comparTiempoMatch.textContent =
        `${formatTiempoPreciso(comparResultado.tInicioSeg)} — ${formatTiempoPreciso(comparResultado.tFinSeg)}`;

    // NUEVO: Llamar a la función que pinta el cuadrito amarillo en el gráfico
    resaltarCoincidencia(comparResultado.tInicioSeg, comparResultado.tFinSeg);

    btnPlayMatch.disabled = false;
});

// 5. REPRODUCIR EL SEGMENTO COINCIDENTE (Sin cambios)
btnPlayMatch.addEventListener('click', () => {
    if (!comparResultado || !comparCand?.audioEl) return;

    const { tInicioSeg, tFinSeg } = comparResultado;
    const audioEl = comparCand.audioEl;

    audioEl.currentTime = tInicioSeg;
    audioEl.play();

    const onTimeUpdate = () => {
        if (audioEl.currentTime >= tFinSeg) {
            audioEl.pause();
            audioEl.removeEventListener('timeupdate', onTimeUpdate);
        }
    };
    audioEl.addEventListener('timeupdate', onTimeUpdate);
});