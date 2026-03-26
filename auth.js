// auth.js - Incluir en todas las páginas protegidas
(function () {
    const token = sessionStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    // Agregar token a todas las peticiones fetch
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        if (typeof url === 'string' && url.includes('onrender.com')) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
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
