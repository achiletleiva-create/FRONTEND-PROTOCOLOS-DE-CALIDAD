// auth.js - Incluir en todas las páginas protegidas
(function () {
    const token = sessionStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    const BASE_URL = 'https://backend-protocolos-de-calidad.onrender.com';
    const originalFetch = window.fetch.bind(window);

    // Despertar el servidor al cargar la página
    originalFetch(`${BASE_URL}/api/auth/ping`).catch(() => {});

    window.fetch = async function (url, options) {
        options = options || {};

        if (typeof url === 'string' && url.includes('onrender.com')) {
            // No tocar headers si el body es FormData (multer lo maneja solo)
            if (!(options.body instanceof FormData)) {
                options.headers = Object.assign({}, options.headers, {
                    'Authorization': `Bearer ${token}`
                });
            } else {
                // FormData: solo agregar Authorization sin Content-Type
                const h = new Headers(options.headers || {});
                h.set('Authorization', `Bearer ${token}`);
                options.headers = h;
            }
        }

        const MAX_INTENTOS = 3;
        for (let i = 0; i < MAX_INTENTOS; i++) {
            try {
                const res = await originalFetch(url, options);
                if (res.status === 401) {
                    sessionStorage.clear();
                    window.location.href = 'login.html';
                }
                return res;
            } catch (err) {
                if (i < MAX_INTENTOS - 1) {
                    await new Promise(r => setTimeout(r, 3000));
                } else {
                    throw err;
                }
            }
        }
    };
})();

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}
