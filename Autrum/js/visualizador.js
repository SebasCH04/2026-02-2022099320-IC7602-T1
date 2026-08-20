// ============================================================
// Funciones compartidas para dibujar en los canvas
// ============================================================

const CANVAS_BG = '#0f172a'; // Color de fondo base

// Rellena el canvas con el color oscuro
function limpiarCanvas(ctx, w, h) {
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, w, h);
}

// Ajusta el canvas al tamaño real en pantalla para que no se vea borroso
function ajustarCanvas(canvas) {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return { w: canvas.width, h: canvas.height };
}

// Dibuja las barras de frecuencia con un gradiente
function dibujarEspectroFrecuencia(ctx, datos, w, h) {
    limpiarCanvas(ctx, w, h);

    const barWidth = (w / datos.length) * 2.5;
    let x = 0;

    for (let i = 0; i < datos.length; i++) {
        const barHeight = datos[i];
        
        // Calcular color de la barra
        const r = barHeight + (25 * (i / datos.length));
        const g = 250 * (i / datos.length);
        const b = 50;
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, h - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
    }
}

// Dibuja la línea de la onda en tiempo real (como osciloscopio)
function dibujarOndaTiempo(ctx, datos, w, h) {
    limpiarCanvas(ctx, w, h);

    ctx.lineWidth   = 2;
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();

    const sliceWidth = w / datos.length;
    let x = 0;

    for (let i = 0; i < datos.length; i++) {
        const v = datos[i] / 128.0;
        const y = v * h / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
    }
    ctx.lineTo(w, h / 2);
    ctx.stroke();
}

// Dibuja la onda completa del archivo .atm y permite hacer zoom
function dibujarOndaBuffer(ctx, buffer, w, h, viewStart, viewDuration) {
    limpiarCanvas(ctx, w, h);

    const datos       = buffer.getChannelData(0);
    const sampleRate  = buffer.sampleRate;
    const mitad       = h / 2;

    const muestraInicio    = Math.floor(viewStart * sampleRate);
    const muestraFin       = Math.min(datos.length, Math.floor((viewStart + viewDuration) * sampleRate));
    const muestrasPorPixel = Math.max(1, Math.floor((muestraFin - muestraInicio) / w));

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth   = 1;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
        const inicio = muestraInicio + x * muestrasPorPixel;
        let min = 1.0, max = -1.0;

        // Buscar el pico más alto y más bajo en este pixel
        for (let j = 0; j < muestrasPorPixel; j++) {
            const idx = inicio + j;
            if (idx >= datos.length) break;
            const v = datos[idx];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        
        if (min > max) { min = 0; max = 0; }
        
        ctx.moveTo(x, mitad + min * mitad);
        ctx.lineTo(x, mitad + max * mitad);
    }
    ctx.stroke();
}
