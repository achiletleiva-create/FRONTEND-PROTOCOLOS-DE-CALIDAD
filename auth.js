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
            if (!(options.body instanceof FormData)) {
                options.headers = Object.assign({}, options.headers, { 'Authorization': `Bearer ${token}` });
            } else {
                const h = new Headers(options.headers || {});
                h.set('Authorization', `Bearer ${token}`);
                options.headers = h;
            }
        }
        const MAX_INTENTOS = 3;
        for (let i = 0; i < MAX_INTENTOS; i++) {
            try {
                const res = await originalFetch(url, options);
                if (res.status === 401) { sessionStorage.clear(); window.location.href = 'login.html'; }
                return res;
            } catch (err) {
                if (i < MAX_INTENTOS - 1) await new Promise(r => setTimeout(r, 3000));
                else throw err;
            }
        }
    };
})();

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

/**
 * Lee un archivo de imagen, corrige su orientación EXIF usando canvas,
 * y devuelve { src, w, h, label } listo para insertar en jsPDF.
 */
window.leerFotoCorregida = function(file, label) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Leer orientación EXIF manualmente desde los bytes del archivo
                const view = new DataView(e.target.result instanceof ArrayBuffer ? e.target.result : new ArrayBuffer(0));
                let orientation = 1;
                try {
                    const buf = e.target.result;
                    // Necesitamos leer el ArrayBuffer para EXIF, re-leemos
                    const fr2 = new FileReader();
                    fr2.onload = function(e2) {
                        const dv = new DataView(e2.target.result);
                        let off = 0, littleEndian = false;
                        if (dv.getUint16(0) !== 0xFFD8) { orientation = 1; dibujar(img, orientation, e.target.result, resolve, label); return; }
                        off = 2;
                        while (off < dv.byteLength) {
                            const marker = dv.getUint16(off); off += 2;
                            if (marker === 0xFFE1) {
                                off += 2;
                                if (dv.getUint32(off) !== 0x45786966) break;
                                off += 6;
                                littleEndian = dv.getUint16(off) === 0x4949;
                                const ifdOff = off + dv.getUint32(off + 4, littleEndian);
                                const entries = dv.getUint16(ifdOff, littleEndian);
                                for (let i = 0; i < entries; i++) {
                                    if (dv.getUint16(ifdOff + 2 + i * 12, littleEndian) === 0x0112) {
                                        orientation = dv.getUint16(ifdOff + 2 + i * 12 + 8, littleEndian);
                                        break;
                                    }
                                }
                                break;
                            } else if ((marker & 0xFF00) !== 0xFF00) break;
                            else off += dv.getUint16(off);
                        }
                        dibujar(img, orientation, e.target.result, resolve, label);
                    };
                    fr2.readAsArrayBuffer(file);
                } catch(_) {
                    dibujar(img, 1, e.target.result, resolve, label);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

function dibujar(img, orientation, originalSrc, resolve, label) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = img.naturalWidth, h = img.naturalHeight;
    // Orientaciones 5,6,7,8 implican rotación de 90° o 270° (ancho y alto se intercambian)
    const swap = orientation >= 5;
    canvas.width  = swap ? h : w;
    canvas.height = swap ? w : h;
    ctx.save();
    switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, h, w); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
        default: break;
    }
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    resolve({ src: canvas.toDataURL('image/jpeg', 0.92), w: canvas.width, h: canvas.height, label });
}
