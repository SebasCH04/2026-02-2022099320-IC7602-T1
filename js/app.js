// Manejo básico de la navegación entre pestañas
document.addEventListener('DOMContentLoaded', () => {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('main > section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Quitar clase activa de todos
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.style.display = 'none');

            // Activar la seleccionada
            btn.classList.add('active');
            const targetId = btn.id.replace('nav-', 'section-');
            document.getElementById(targetId).style.display = 'block';
        });
    });
});
