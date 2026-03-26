// auth.js - Incluir en todas las páginas protegidas
(function () {
    const token = sessionStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        if (typeof url === 'string' && url.includes('onrender.com')) {
            if (!options.headers) options.headers = {};
            // Si headers es un objeto plano
            if (typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
                options.headers['Authorization'] = `Bearer ${token}`;
            } else {
                const h = new Headers(options.headers);
                h.set('Authorization', `Bearer ${token}`);
                options.headers = h;
            }
        }
        return originalFetch(url, options).then(async res => {
            if (res.status === 401) {
                sessionStorage.clear();
                window.location.href = 'login.html';
            }
            return res;
        });
    };
})();

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}
