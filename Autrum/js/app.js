// Manejo básico de la navegación entre pestañas.
// Se registra un mapa de callbacks de inicialización por sección: cada módulo
// puede necesitar re-ajustar sus canvas cuando la sección pasa de display:none
// a display:block por primera vez (los canvas tienen offsetWidth=0 mientras
// están ocultos y deben recalcularse al hacerse visibles).
const seccionInitCallbacks = {
    'section-reproductor': () => typeof ajustarCanvasReproductor === 'function' && ajustarCanvasReproductor(),
    'section-analizador':  () => typeof ajustarCanvasAnalizador  === 'function' && ajustarCanvasAnalizador(),
    'section-comparador':  () => typeof ajustarCanvasComparador  === 'function' && ajustarCanvasComparador()
};

document.addEventListener('DOMContentLoaded', () => {
    const navBtns  = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('main > section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Se quita la clase activa de todos los botones y secciones.
            navBtns.forEach(b  => b.classList.remove('active'));
            sections.forEach(s => s.style.display = 'none');

            // Se activa la sección seleccionada.
            btn.classList.add('active');
            const targetId = btn.id.replace('nav-', 'section-');
            document.getElementById(targetId).style.display = 'block';

            // Se llama al callback de inicialización de la sección, si existe.
            seccionInitCallbacks[targetId]?.();
        });
    });
});
