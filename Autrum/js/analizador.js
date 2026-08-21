let audioContext;
let analyser;
let microphone;
let isRecording = false;
let animationId;
let mediaRecorder;
let recordedChunks = [];

// Referencias a los Canvas
const canvasTiempo = document.getElementById('canvas-tiempo');
const ctxTiempo = canvasTiempo.getContext('2d');
const canvasFrecuencia = document.getElementById('canvas-frecuencia');
const ctxFrecuencia = canvasFrecuencia.getContext('2d');

// Se ajustan los canvas al arrancar y al cambiar el tamaño de la ventana.
// Si no se está grabando pero hay un analizador activo, se redibuja el estado
// actual para que la gráfica no se pierda al hacer zoom con el navegador.
function ajustarCanvasAnalizador() {
    ajustarCanvas(canvasTiempo);
    ajustarCanvas(canvasFrecuencia);
    
    if (!isRecording) {
        if (analyser) {
            const bufferLength  = analyser.frequencyBinCount;
            
            const dataArrayTime = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArrayTime);
            dibujarOndaTiempo(ctxTiempo, dataArrayTime, canvasTiempo.width, canvasTiempo.height);
            
            const dataArrayFreq = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArrayFreq);
            dibujarEspectroFrecuencia(ctxFrecuencia, dataArrayFreq, canvasFrecuencia.width, canvasFrecuencia.height);
        } else {
            limpiarCanvas(ctxTiempo,      canvasTiempo.width,      canvasTiempo.height);
            limpiarCanvas(ctxFrecuencia,  canvasFrecuencia.width,  canvasFrecuencia.height);
        }
    }
}
window.addEventListener('resize', ajustarCanvasAnalizador);
window.addEventListener('load',   ajustarCanvasAnalizador);

// Referencias a Botones y UI
const btnIniciar = document.getElementById('btn-iniciar-mic');
const btnPausar = document.getElementById('btn-pausar-mic');
const btnDetener = document.getElementById('btn-detener-mic');
const btnExportar = document.getElementById('btn-exportar-atm');

const inputWav = document.getElementById('input-wav');
const labelWav = document.querySelector('label[for="input-wav"]');
const btnPausarWav = document.getElementById('btn-pausar-wav');
const btnCancelarWav = document.getElementById('btn-cancelar-wav');
const batchStatus = document.getElementById('batch-status');
const batchFilename = document.getElementById('batch-filename');

// Función que permite la exclusión mutua entre los dos modos
function toggleModo(modo, activo) {
    if (modo === 'streaming') {
        inputWav.disabled = activo;
        labelWav.style.opacity = activo ? '0.5' : '1';
        labelWav.style.pointerEvents = activo ? 'none' : 'auto';
    } else if (modo === 'batch') {
        btnIniciar.disabled = activo;
    }
}

// Estructura para guardar datos (para el .atm)
let atmData = {
    audioOriginal: null, // Aqui se guarda el Blob si se quiere grabar
    trazosFrecuencia: [] // Aqui se guarda las muestras de FFT
};

// Iniciar Captura de Micrófono
btnIniciar.addEventListener('click', async () => {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Pedir permiso de micrófono
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // Tamaño de la ventana para Fourier

        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        // Nota: No se conecta a destination para no crear feedback (eco)

        // Configurar MediaRecorder para guardar el audio real
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
            atmData.audioOriginal = new Blob(recordedChunks, { type: 'audio/webm' }); // Chrome por defecto graba en webm
        };
        recordedChunks = [];
        mediaRecorder.start();

        isRecording = true;
        btnIniciar.disabled = true;
        btnPausar.disabled = false;
        btnDetener.disabled = false;
        btnExportar.disabled = true;
        
        toggleModo('streaming', true);
        
        atmData.trazosFrecuencia = []; // Reiniciar datos
        
        dibujarGraficos();
    } catch (err) {
        console.error('Error al acceder al micrófono:', err);
        alert('No se pudo acceder al micrófono. Asegúrese de dar permisos.');
    }
});

// Boton de continuar y de pausa
btnPausar.addEventListener('click', () => {
    if (isRecording) {
        isRecording = false;
        btnPausar.innerHTML = '<i class="fas fa-play"></i> Continuar';
        cancelAnimationFrame(animationId);
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.pause();
    } else {
        isRecording = true;
        btnPausar.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        if (mediaRecorder && mediaRecorder.state === 'paused') mediaRecorder.resume();
        dibujarGraficos();
    }
});

// Boton de detener
btnDetener.addEventListener('click', () => {
    isRecording = false;
    cancelAnimationFrame(animationId);
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (microphone) {
        microphone.mediaStream.getTracks().forEach(track => track.stop());
        microphone.disconnect();
    }
    
    btnIniciar.disabled = false;
    btnPausar.disabled = true;
    btnPausar.innerHTML = '<i class="fas fa-pause"></i> Pausar';
    btnDetener.disabled = true;
    btnExportar.disabled = false; // Habilitar exportación
    
    toggleModo('streaming', false);
});


// BATCH: Cargar y analizar un archivo WAV
let batchSource = null; // Referencia a la fuente de audio del WAV

inputWav.addEventListener('change', async (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;

    // Leer el archivo como ArrayBuffer
    const arrayBuffer = await archivo.arrayBuffer();

    // Crear un nuevo AudioContext limpio para cada WAV
    if (audioContext) {
        audioContext.close();
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Decodificar el audio del WAV
    let audioBuffer;
    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
        alert('Error al decodificar el archivo. Asegúrese de que sea un WAV válido.');
        return;
    }

    // Configurar el AnalyserNode
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    // Crear una fuente a partir del buffer decodificado
    batchSource = audioContext.createBufferSource();
    batchSource.buffer = audioBuffer;
    batchSource.connect(analyser);
    analyser.connect(audioContext.destination);
    batchSource.start(0);

    // Guardar el Blob original para el .atm
    atmData.audioOriginal = archivo;
    atmData.trazosFrecuencia = [];

    // Actualizar UI
    isRecording = true;
    btnExportar.disabled = true;
    btnPausarWav.disabled = false;
    btnCancelarWav.disabled = false;
    batchFilename.textContent = archivo.name;
    batchStatus.style.display = 'flex';
    
    toggleModo('batch', true);

    dibujarGraficos();

    // Cuando el audio termine de forma natural
    batchSource.onended = () => {
        // Solo actuar si no fue cancelado manualmente
        if (isRecording) {
            isRecording = false;
            cancelAnimationFrame(animationId);
            btnExportar.disabled = false;
            btnPausarWav.disabled = true;
            btnCancelarWav.disabled = true;
            batchStatus.style.display = 'none';
            inputWav.value = ''; // Permitir cargar el mismo archivo de nuevo
            toggleModo('batch', false);
        }
    };
});

// Pausar / Reanudar WAV
btnPausarWav.addEventListener('click', async () => {
    if (audioContext.state === 'running') {
        await audioContext.suspend();
        isRecording = false;
        cancelAnimationFrame(animationId);
        btnPausarWav.innerHTML = '<i class="fas fa-play"></i> Reanudar';
    } else if (audioContext.state === 'suspended') {
        await audioContext.resume();
        isRecording = true;
        btnPausarWav.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        dibujarGraficos();
    }
});

// Cancelar WAV
btnCancelarWav.addEventListener('click', () => {
    if (batchSource) {
        batchSource.onended = null; // Evitar que onended active la exportación
        batchSource.stop();
        batchSource = null;
    }
    isRecording = false;
    cancelAnimationFrame(animationId);

    // Resetear UI del batch
    btnPausarWav.disabled = true;
    btnPausarWav.innerHTML = '<i class="fas fa-pause"></i> Pausar';
    btnCancelarWav.disabled = true;
    batchStatus.style.display = 'none';
    inputWav.value = '';
    
    toggleModo('batch', false);

    // Limpiar canvas
    ctxTiempo.clearRect(0, 0, canvasTiempo.width, canvasTiempo.height);
    ctxFrecuencia.clearRect(0, 0, canvasFrecuencia.width, canvasFrecuencia.height);
});


// MODAL Y EXPORTACIÓN DEL ARCHIVO .ATM
const modalExportar = document.getElementById('modal-exportar');
const inputFilename = document.getElementById('input-filename');
const modalLoading = document.getElementById('modal-loading');
const btnCancelarExport = document.getElementById('btn-cancelar-export');
const btnConfirmarExport = document.getElementById('btn-confirmar-export');

// Abrir Modal
btnExportar.addEventListener('click', () => {
    if (!atmData.audioOriginal) return;
    modalLoading.style.display = 'none';
    btnConfirmarExport.disabled = false;
    btnCancelarExport.disabled = false;
    modalExportar.style.display = 'flex';
    inputFilename.focus();
});

// Cerrar Modal
btnCancelarExport.addEventListener('click', () => {
    modalExportar.style.display = 'none';
});

// Confirmar Guardado
btnConfirmarExport.addEventListener('click', () => {
    if (!atmData.audioOriginal) return;

    // Mostrar Spinner de carga
    modalLoading.style.display = 'flex';
    btnConfirmarExport.disabled = true;
    btnCancelarExport.disabled = true;

    const nombreArchivo = (inputFilename.value.trim() || 'grabacion') + '.atm';

    // Pequeño delay de 500ms para mostrar la animación de la ruletita (spinner)
    setTimeout(() => {
        const reader = new FileReader();
        reader.readAsDataURL(atmData.audioOriginal);
        reader.onloadend = () => {
            const atmJSON = {
                metadata: {
                    nombre: nombreArchivo,
                    fecha: new Date().toISOString(),
                    muestrasFrecuencia: atmData.trazosFrecuencia.length
                },
                frecuencias: atmData.trazosFrecuencia,
                audioBase64: reader.result
            };

            const blob = new Blob([JSON.stringify(atmJSON)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = nombreArchivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            // Ocultar modal al finalizar
            modalExportar.style.display = 'none';
        };
    }, 600);
});

function dibujarGraficos() {
    if (!isRecording) return;

    animationId = requestAnimationFrame(dibujarGraficos);

    const bufferLength  = analyser.frequencyBinCount;

    // Se obtienen los datos del dominio del tiempo y se dibuja la onda.
    const dataArrayTime = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArrayTime);
    dibujarOndaTiempo(ctxTiempo, dataArrayTime, canvasTiempo.width, canvasTiempo.height);

    // Se obtienen los datos de frecuencia y se dibuja el espectro.
    const dataArrayFreq = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArrayFreq);
    dibujarEspectroFrecuencia(ctxFrecuencia, dataArrayFreq, canvasFrecuencia.width, canvasFrecuencia.height);

    // Se guarda exactamente el 10% de los frames de forma determinista (cada 10 frames).
    dibujarGraficos.frameCount = (dibujarGraficos.frameCount || 0) + 1;
    if (dibujarGraficos.frameCount % 10 === 0) {
        atmData.trazosFrecuencia.push(Array.from(dataArrayFreq));
    }

}
