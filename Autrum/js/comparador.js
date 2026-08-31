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

const comparGraphsContainer = document.getElementById('compar-graphs-container');
const canvasComparRef = document.getElementById('canvas-comparador-ref');
const ctxComparRef = canvasComparRef?.getContext('2d');
const canvasComparCand = document.getElementById('canvas-comparador-cand');
const ctxComparCand = canvasComparCand?.getContext('2d');
const canvasComparRefFreq = document.getElementById('canvas-comparador-ref-freq');
const ctxComparRefFreq = canvasComparRefFreq?.getContext('2d');
const canvasComparCandFreq = document.getElementById('canvas-comparador-cand-freq');
const ctxComparCandFreq = canvasComparCandFreq?.getContext('2d');

const btnZoomInRef = document.getElementById('btn-zoom-in-ref');
const btnZoomOutRef = document.getElementById('btn-zoom-out-ref');
const btnZoomResetRef = document.getElementById('btn-zoom-reset-ref');
const btnZoomInCand = document.getElementById('btn-zoom-in-cand');
const btnZoomOutCand = document.getElementById('btn-zoom-out-cand');
const btnZoomResetCand = document.getElementById('btn-zoom-reset-cand');

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
let comparRefAudioBuffer = null; 

let comparCand = null;             
let comparResultado = null;        

let refViewStart = 0, refViewDuration = 0;
let candViewStart = 0, candViewDuration = 0;

let draggingRef = false, refDragStartX = 0, refDragStartView = 0;
let draggingCand = false, candDragStartX = 0, candDragStartView = 0;

let playRefCtx = null, playRefAnalyser = null, playRefSrc = null;
let playCandCtx = null, playCandAnalyser = null, playCandSrc = null;
let refPlayAnimId = null, candPlayAnimId = null;

function ajustarCanvasComparador() {
    if(canvasComparRef && canvasComparCand) {
        // 1. Ajustar el tamaño real de los 4 canvas
        ajustarCanvas(canvasComparRef);
        ajustarCanvas(canvasComparCand);
        ajustarCanvas(canvasComparRefFreq);
        ajustarCanvas(canvasComparCandFreq);
        
        // 2. Dibujar las ondas de tiempo
        dibujarRefTiempo();
        dibujarCandTiempo();
        
        // 3. Restaurar o limpiar Frecuencia de la Referencia
        if (comparRefFrames && comparRefFrames.length > 0) {
            dibujarEspectroFrecuencia(ctxComparRefFreq, comparRefFrames[0].datos, canvasComparRefFreq.width, canvasComparRefFreq.height);
        } else if (ctxComparRefFreq) {
            limpiarCanvas(ctxComparRefFreq, canvasComparRefFreq.width, canvasComparRefFreq.height);
        }
        
        // 4. Restaurar o limpiar Frecuencia del Candidato
        if (comparCand && comparCand.frames && comparCand.frames.length > 0) {
            dibujarEspectroFrecuencia(ctxComparCandFreq, comparCand.frames[0].datos, canvasComparCandFreq.width, canvasComparCandFreq.height);
        } else if (ctxComparCandFreq) {
            limpiarCanvas(ctxComparCandFreq, canvasComparCandFreq.width, canvasComparCandFreq.height);
        }
    }
}
window.addEventListener('resize', ajustarCanvasComparador);
window.addEventListener('load', ajustarCanvasComparador);

function clampVistaRef(inicio) {
    if (!comparRefAudioBuffer) return 0;
    const maxInicio = Math.max(0, comparRefAudioBuffer.duration - refViewDuration);
    return Math.min(Math.max(0, inicio), maxInicio);
}

function clampVistaCand(inicio) {
    if (!comparCand?.buffer) return 0;
    const maxInicio = Math.max(0, comparCand.duracion - candViewDuration);
    return Math.min(Math.max(0, inicio), maxInicio);
}

function dibujarPlayhead(ctx, canvas, t, vStart, vDur) {
    if (!canvas || !ctx) return;
    if (t < vStart || t > vStart + vDur) return;
    const x = ((t - vStart) / vDur) * canvas.width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
}

function dibujarRefTiempo() {
    if (!comparRefAudioBuffer) {
        if(ctxComparRef) limpiarCanvas(ctxComparRef, canvasComparRef.width, canvasComparRef.height);
        return;
    }
    dibujarOndaBuffer(ctxComparRef, comparRefAudioBuffer, canvasComparRef.width, canvasComparRef.height, refViewStart, refViewDuration);
}

function dibujarCandTiempo() {
    if (!comparCand?.buffer) {
        if(ctxComparCand) limpiarCanvas(ctxComparCand, canvasComparCand.width, canvasComparCand.height);
        return;
    }
    dibujarOndaBuffer(ctxComparCand, comparCand.buffer, canvasComparCand.width, canvasComparCand.height, candViewStart, candViewDuration);
    if (comparResultado) {
        resaltarCoincidencia(comparResultado.tInicioSeg, comparResultado.tFinSeg);
    }
}

btnZoomInRef.addEventListener('click', () => {
    const centro = refViewStart + refViewDuration / 2;
    refViewDuration = Math.max(0.2, refViewDuration / 2);
    refViewStart = clampVistaRef(centro - refViewDuration / 2);
    dibujarRefTiempo();
});
btnZoomOutRef.addEventListener('click', () => {
    const centro = refViewStart + refViewDuration / 2;
    refViewDuration = Math.min(comparRefAudioBuffer.duration, refViewDuration * 2);
    refViewStart = clampVistaRef(centro - refViewDuration / 2);
    dibujarRefTiempo();
});
btnZoomResetRef.addEventListener('click', () => {
    refViewStart = 0;
    refViewDuration = comparRefAudioBuffer.duration;
    dibujarRefTiempo();
});

btnZoomInCand.addEventListener('click', () => {
    const centro = candViewStart + candViewDuration / 2;
    candViewDuration = Math.max(0.2, candViewDuration / 2);
    candViewStart = clampVistaCand(centro - candViewDuration / 2);
    dibujarCandTiempo();
});
btnZoomOutCand.addEventListener('click', () => {
    const centro = candViewStart + candViewDuration / 2;
    candViewDuration = Math.min(comparCand.duracion, candViewDuration * 2);
    candViewStart = clampVistaCand(centro - candViewDuration / 2);
    dibujarCandTiempo();
});
btnZoomResetCand.addEventListener('click', () => {
    candViewStart = 0;
    candViewDuration = comparCand.duracion;
    dibujarCandTiempo();
});

canvasComparRef.addEventListener('mousedown', (e) => {
    if (!comparRefAudioBuffer) return;
    draggingRef = true;
    refDragStartX = e.offsetX;
    refDragStartView = refViewStart;
});
canvasComparCand.addEventListener('mousedown', (e) => {
    if (!comparCand?.buffer) return;
    draggingCand = true;
    candDragStartX = e.offsetX;
    candDragStartView = candViewStart;
});

window.addEventListener('mousemove', (e) => {
    if (draggingRef && comparRefAudioBuffer) {
        const dx = e.target === canvasComparRef ? e.offsetX - refDragStartX : 0;
        const delta = (dx / canvasComparRef.width) * refViewDuration;
        refViewStart = clampVistaRef(refDragStartView - delta);
        dibujarRefTiempo();
    }
    if (draggingCand && comparCand?.buffer) {
        const dx = e.target === canvasComparCand ? e.offsetX - candDragStartX : 0;
        const delta = (dx / canvasComparCand.width) * candViewDuration;
        candViewStart = clampVistaCand(candDragStartView - delta);
        dibujarCandTiempo();
    }
});
window.addEventListener('mouseup', () => {
    draggingRef = false;
    draggingCand = false;
});

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
        
        btnZoomInRef.disabled = true;
        btnZoomOutRef.disabled = true;
        btnZoomResetRef.disabled = true;

        comparRefAudioBuffer = null;
        if(ctxComparRef) limpiarCanvas(ctxComparRef, canvasComparRef.width, canvasComparRef.height);
        if(ctxComparRefFreq) limpiarCanvas(ctxComparRefFreq, canvasComparRefFreq.width, canvasComparRefFreq.height);
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

function initPlayRefGraph() {
    if(!playRefCtx) {
        playRefCtx = new (window.AudioContext || window.webkitAudioContext)();
        playRefAnalyser = playRefCtx.createAnalyser();
        playRefAnalyser.fftSize = 2048;
        playRefSrc = playRefCtx.createMediaElementSource(comparRefAudioEl);
        playRefSrc.connect(playRefAnalyser);
        playRefAnalyser.connect(playRefCtx.destination);
    }
}

function initPlayCandGraph() {
    if(!playCandCtx) {
        playCandCtx = new (window.AudioContext || window.webkitAudioContext)();
        playCandAnalyser = playCandCtx.createAnalyser();
        playCandAnalyser.fftSize = 2048;
        playCandSrc = playCandCtx.createMediaElementSource(comparCand.audioEl);
        playCandSrc.connect(playCandAnalyser);
        playCandAnalyser.connect(playCandCtx.destination);
    }
}

function animRefPlay() {
    if(!comparRefAudioEl || comparRefAudioEl.paused) return;
    refPlayAnimId = requestAnimationFrame(animRefPlay);
    
    const data = new Uint8Array(playRefAnalyser.frequencyBinCount);
    playRefAnalyser.getByteFrequencyData(data);
    dibujarEspectroFrecuencia(ctxComparRefFreq, data, canvasComparRefFreq.width, canvasComparRefFreq.height);
    
    dibujarRefTiempo();
    dibujarPlayhead(ctxComparRef, canvasComparRef, comparRefAudioEl.currentTime, refViewStart, refViewDuration);
}

function animCandPlay() {
    if(!comparCand || comparCand.audioEl.paused) return;
    candPlayAnimId = requestAnimationFrame(animCandPlay);
    
    const data = new Uint8Array(playCandAnalyser.frequencyBinCount);
    playCandAnalyser.getByteFrequencyData(data);
    dibujarEspectroFrecuencia(ctxComparCandFreq, data, canvasComparCandFreq.width, canvasComparCandFreq.height);
    
    dibujarCandTiempo();
    dibujarPlayhead(ctxComparCand, canvasComparCand, comparCand.audioEl.currentTime, candViewStart, candViewDuration);
}


btnGrabarRef.addEventListener('click', async () => {
    try {
        if (!comparAudioContext) comparAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (comparAudioContext.state === 'suspended') await comparAudioContext.resume();

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
        
        comparRefMediaRecorder.onstop = async () => {
            liberarAudio(comparRefAudioEl);
            const blob = new Blob(comparRefChunks, { type: 'audio/webm' });
            comparRefAudioEl = crearAudioDesdeBlob(blob);
            playRefCtx = null;
            
            btnPlayRef.disabled = false;
            btnZoomInRef.disabled = false;
            btnZoomOutRef.disabled = false;
            btnZoomResetRef.disabled = false;
            
            ajustarCanvasComparador();
            
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const ctxTemp = new (window.AudioContext || window.webkitAudioContext)();
                comparRefAudioBuffer = await ctxTemp.decodeAudioData(arrayBuffer);
                ctxTemp.close();
                
                refViewStart = 0;
                refViewDuration = comparRefAudioBuffer.duration;
                dibujarRefTiempo();
                if (comparRefFrames.length > 0) {
                    dibujarEspectroFrecuencia(ctxComparRefFreq, comparRefFrames[0].datos, canvasComparRefFreq.width, canvasComparRefFreq.height);
                }            
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
    
    dibujarEspectroFrecuencia(ctxComparRefFreq, dataArrayFreq, canvasComparRefFreq.width, canvasComparRefFreq.height);

    const dataArrayTime = new Uint8Array(bufferLength);
    comparAnalyser.getByteTimeDomainData(dataArrayTime);
    dibujarOndaTiempo(ctxComparRef, dataArrayTime, canvasComparRef.width, canvasComparRef.height);

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

    refInfo.textContent = `Referencia lista — ${comparRefFrames.length} frames útiles (de ${framesOriginales} capturados)`;
    actualizarBotonComparar();
});

btnPlayRef.addEventListener('click', async () => {
    if (!comparRefAudioEl) return;
    initPlayRefGraph();
    if(playRefCtx.state === 'suspended') await playRefCtx.resume();
    comparRefAudioEl.currentTime = 0;
    
    await comparRefAudioEl.play(); 
    animRefPlay();
});

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

async function cargarAtmComparador(archivo) {
    const texto = await archivo.text();
    const atmJSON = JSON.parse(texto);

    if (!atmJSON.frecuencias || atmJSON.frecuencias.length === 0) throw new Error('El .atm no contiene datos de frecuencia.');
    if (!atmJSON.audioBase64) throw new Error('El .atm no contiene audio ("audioBase64" ausente).');
    
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
        return {
            datos,
            potencia: Number.isFinite(frame?.potencia) ? frame.potencia : estimarPotenciaDesdeEspectro(datos),
            timestamp: Number.isFinite(frame?.timestamp) ? frame.timestamp : indice * intervaloEstimado
        };
    });

    return {
        nombre: atmJSON.metadata?.nombre || archivo.name,
        frames,
        duracion: audioBuffer.duration,
        audioEl: crearAudioDesdeBlob(blob),
        buffer: audioBuffer
    };
}

inputAtmCand.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    try {
        liberarAudio(comparCand?.audioEl);
        comparCand = await cargarAtmComparador(e.target.files[0]);
        playCandCtx = null;

        candFilename.textContent = comparCand.nombre;
        candStatus.style.display = 'flex';
        btnPlayMatch.disabled = true;
        
        btnZoomInCand.disabled = false;
        btnZoomOutCand.disabled = false;
        btnZoomResetCand.disabled = false;
  
        ajustarCanvasComparador();
        candViewStart = 0;
        candViewDuration = comparCand.duracion;
        dibujarCandTiempo();
        if (comparCand.frames && comparCand.frames.length > 0) {
            dibujarEspectroFrecuencia(ctxComparCandFreq, comparCand.frames[0].datos, canvasComparCandFreq.width, canvasComparCandFreq.height);
        }        
        actualizarBotonComparar();
    } catch (err) {
        alert('No se pudo leer el archivo .atm: ' + err.message);
    }
});

function actualizarBotonComparar() {
    btnComparar.disabled = !(comparRefFrames.length > 0 && comparCand && comparRefFrames.length <= comparCand.frames.length);
}

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
        const estaSeparado = seleccionados.every(seleccionado => Math.abs(seleccionado.offset - resultado.offset) >= separacionMinima);
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
    const margen = clampComparador((mejor.puntuacion - segundoScore) / Math.max(1 - segundoScore, 1e-9));
    const confianza = 100 * clampComparador((0.85 * mejor.puntuacion) + (0.15 * margen));

    const segPorFrameEstimado = duracionCand / framesCand;
    const tInicioSeg = candFrames[mejor.offset].timestamp;
    const ultimoFrame = Math.min(mejor.offset + framesInput - 1, framesCand - 1);
    const tFinSeg = Math.min(duracionCand, candFrames[ultimoFrame].timestamp + segPorFrameEstimado);

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

function resaltarCoincidencia(tInicio, tFin) {
    if (!comparCand?.buffer || !ctxComparCand) return;
    
    dibujarOndaBuffer(ctxComparCand, comparCand.buffer, canvasComparCand.width, canvasComparCand.height, candViewStart, candViewDuration);
    
    const w = canvasComparCand.width;
    const duracion = candViewDuration;
    
    if (tFin < candViewStart || tInicio > candViewStart + candViewDuration) return;

    let xInicio = ((tInicio - candViewStart) / duracion) * w;
    let xFin = ((tFin - candViewStart) / duracion) * w;

    xInicio = Math.max(0, xInicio);
    xFin = Math.min(w, xFin);
    const ancho = Math.max(0, xFin - xInicio);

    ctxComparCand.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctxComparCand.fillRect(xInicio, 0, ancho, canvasComparCand.height);
    
    ctxComparCand.strokeStyle = '#f59e0b';
    ctxComparCand.lineWidth = 2;
    ctxComparCand.strokeRect(xInicio, 0, ancho, canvasComparCand.height);
}

btnComparar.addEventListener('click', () => {
    comparResultado = compararDosEtapas(comparRefFrames, comparCand.frames, comparCand.duracion);
    comparConfianza.textContent = `${comparResultado.confianza.toFixed(1)}%`;
    comparTiempoMatch.textContent = `${formatTiempoPreciso(comparResultado.tInicioSeg)} — ${formatTiempoPreciso(comparResultado.tFinSeg)}`;
    dibujarCandTiempo();
    btnPlayMatch.disabled = false;
});

btnPlayMatch.addEventListener('click', async () => {
    if (!comparResultado || !comparCand?.audioEl) return;
    
    initPlayCandGraph();
    if(playCandCtx.state === 'suspended') await playCandCtx.resume();

    const { tInicioSeg, tFinSeg } = comparResultado;
    const audioEl = comparCand.audioEl;

    audioEl.currentTime = tInicioSeg;
    
    await audioEl.play(); 
    animCandPlay();

    const onTimeUpdate = () => {
        if (audioEl.currentTime >= tFinSeg) {
            audioEl.pause();
            audioEl.removeEventListener('timeupdate', onTimeUpdate);
            dibujarCandTiempo();
        }
    };
    audioEl.addEventListener('timeupdate', onTimeUpdate);
});