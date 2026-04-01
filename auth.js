// auth.js - Incluir en todas las páginas protegidas
(function () {
    const token = sessionStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    const BASE_URL = 'https://backend-protocolos-de-calidad.onrender.com';
    const originalFetch = window.fetch.bind(window);

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

    // Inyectar estilos para previsualización de fotos
    const style = document.createElement('style');
    style.textContent = `
        .foto-preview-wrap { position: relative; display: inline-block; margin-top: 6px; }
        .foto-preview-wrap img { max-width: 100%; max-height: 140px; border-radius: 4px; border: 1px solid #ccc; display: block; }
        .btn-rotar { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white;
            border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 16px;
            cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-rotar:hover { background: rgba(0,74,153,0.85); }
    `;
    document.head.appendChild(style);

    // Activar previsualización con botón de rotación en todos los inputs de foto
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('input[type="file"][accept*="image"]').forEach(inp => {
            inp.addEventListener('change', () => mostrarPreview(inp));
        });
    });
})();

function mostrarPreview(inp) {
    const prevWrap = inp.parentElement.querySelector('.foto-preview-wrap');
    if (prevWrap) prevWrap.remove();
    if (!inp.files[0]) return;

    // Leer EXIF y corregir orientación, luego mostrar preview
    const file = inp.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const fr2 = new FileReader();
            fr2.onload = function(e2) {
                let orientation = 1;
                try {
                    const dv = new DataView(e2.target.result);
                    let off = 0, littleEndian = false;
                    if (dv.getUint16(0) === 0xFFD8) {
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
                    }
                } catch(_) {}

                // Generar canvas con EXIF corregido
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                const w = img.naturalWidth, h = img.naturalHeight;
                const swap = orientation >= 5;
                c.width = swap ? h : w;
                c.height = swap ? w : h;
                ctx.save();
                switch (orientation) {
                    case 2: ctx.transform(-1,0,0,1,w,0); break;
                    case 3: ctx.transform(-1,0,0,-1,w,h); break;
                    case 4: ctx.transform(1,0,0,-1,0,h); break;
                    case 5: ctx.transform(0,1,1,0,0,0); break;
                    case 6: ctx.transform(0,1,-1,0,h,0); break;
                    case 7: ctx.transform(0,-1,-1,0,h,w); break;
                    case 8: ctx.transform(0,-1,1,0,0,w); break;
                    default: break;
                }
                ctx.drawImage(img, 0, 0);
                ctx.restore();

                const correctedSrc = c.toDataURL('image/jpeg', 0.92);

                // Guardar el src corregido en el input para que leerFotoCorregida lo use directamente
                inp._correctedSrc = correctedSrc;
                inp._correctedW = c.width;
                inp._correctedH = c.height;

                // Mostrar preview con la imagen ya corregida
                const wrap = document.createElement('div');
                wrap.className = 'foto-preview-wrap';
                wrap.dataset.rotation = '0';

                const previewImg = document.createElement('img');
                previewImg.src = correctedSrc;
                previewImg.style.transform = 'rotate(0deg)';
                previewImg.style.transition = 'transform 0.3s';

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-rotar';
                btn.title = 'Girar imagen';
                btn.innerHTML = '🔄';
                btn.addEventListener('click', () => {
                    const sw = inp._correctedW, sh = inp._correctedH;
                    const cRot = document.createElement('canvas');
                    const ctxRot = cRot.getContext('2d');
                    cRot.width = sh;
                    cRot.height = sw;
                    ctxRot.translate(sh / 2, sw / 2);
                    ctxRot.rotate(90 * Math.PI / 180);
                    const imgRot = new Image();
                    imgRot.onload = function() {
                        ctxRot.drawImage(imgRot, -sw / 2, -sh / 2);
                        inp._correctedSrc = cRot.toDataURL('image/jpeg', 0.92);
                        inp._correctedW = cRot.width;
                        inp._correctedH = cRot.height;
                        previewImg.src = inp._correctedSrc;
                    };
                    imgRot.src = inp._correctedSrc;
                });

                wrap.appendChild(previewImg);
                wrap.appendChild(btn);
                inp.parentElement.appendChild(wrap);
            };
            fr2.readAsArrayBuffer(file);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

/**
 * Lee un archivo de imagen, corrige EXIF y aplica rotación manual del usuario.
 * Devuelve { src, w, h, label } listo para insertar en jsPDF.
 */
window.leerFotoCorregida = function(file, label, inputElement) {
    return new Promise(resolve => {
        // Si ya tenemos el canvas corregido desde la preview, usarlo directamente
        if (inputElement && inputElement._correctedSrc) {
            const wrap = inputElement.parentElement.querySelector('.foto-preview-wrap');
            const manualDeg = wrap ? (parseInt(wrap.dataset.rotation) || 0) : 0;
            if (manualDeg === 0) {
                resolve({ src: inputElement._correctedSrc, w: inputElement._correctedW, h: inputElement._correctedH, label });
                return;
            }
            // Aplicar rotación manual sobre el canvas ya corregido
            const img2 = new Image();
            img2.onload = function() {
                const sw = inputElement._correctedW, sh = inputElement._correctedH;
                const c2 = document.createElement('canvas');
                const ctx2 = c2.getContext('2d');
                const rad = manualDeg * Math.PI / 180;
                if (manualDeg === 90 || manualDeg === 270) { c2.width = sh; c2.height = sw; }
                else { c2.width = sw; c2.height = sh; }
                ctx2.translate(c2.width / 2, c2.height / 2);
                ctx2.rotate(rad);
                ctx2.drawImage(img2, -sw / 2, -sh / 2);
                resolve({ src: c2.toDataURL('image/jpeg', 0.92), w: c2.width, h: c2.height, label });
            };
            img2.src = inputElement._correctedSrc;
            return;
        }

        // Fallback: leer archivo y corregir EXIF (cuando no hay preview)
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const fr2 = new FileReader();
                fr2.onload = function(e2) {
                    let orientation = 1;
                    try {
                        const dv = new DataView(e2.target.result);
                        let off = 0, littleEndian = false;
                        if (dv.getUint16(0) === 0xFFD8) {
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
                        }
                    } catch(_) {}
                    const wrap = inputElement && inputElement.parentElement.querySelector('.foto-preview-wrap');
                    const manualDeg = wrap ? (parseInt(wrap.dataset.rotation) || 0) : 0;
                    dibujar(img, orientation, manualDeg, e.target.result, resolve, label);
                };
                fr2.readAsArrayBuffer(file);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

window.insertarFotosEnPDF = function(doc, fotos, tituloY) {
    if (!fotos || fotos.length === 0) return;
    doc.addPage();
    doc.setFontSize(11); doc.setTextColor(0, 74, 153);
    doc.text("REGISTRO FOTOGRÁFICO", 105, tituloY || 15, { align: "center" });
    doc.setTextColor(0);

    const CELL_W = 88, CELL_H = 72, GAP_X = 8, GAP_Y = 18;
    const START_X = 10, START_Y = (tituloY || 15) + 8;
    const COLS = 2;

    fotos.forEach((f, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cellX = START_X + col * (CELL_W + GAP_X);
        const cellY = START_Y + row * (CELL_H + GAP_Y);

        // Nueva página si no cabe
        if (row > 0 && col === 0) {
            const neededY = cellY + CELL_H + GAP_Y;
            if (neededY > 285) {
                doc.addPage();
                doc.setFontSize(11); doc.setTextColor(0, 74, 153);
                doc.text("REGISTRO FOTOGRÁFICO (continuación)", 105, 12, { align: "center" });
                doc.setTextColor(0);
                // Recalcular posición en nueva página
                const newRow = 0;
                const newCellY = 20;
                const ratio = Math.min(CELL_W / f.w, CELL_H / f.h);
                const fw = f.w * ratio, fh = f.h * ratio;
                const imgX = cellX + (CELL_W - fw) / 2;
                const imgY = newCellY + (CELL_H - fh) / 2;
                doc.rect(cellX, newCellY, CELL_W, CELL_H);
                doc.addImage(f.src, 'JPEG', imgX, imgY, fw, fh, undefined, 'FAST');
                doc.setFontSize(7); doc.text(f.label, cellX + CELL_W / 2, newCellY + CELL_H + 5, { align: "center", maxWidth: CELL_W });
                return;
            }
        }

        const ratio = Math.min(CELL_W / f.w, CELL_H / f.h);
        const fw = f.w * ratio, fh = f.h * ratio;
        const imgX = cellX + (CELL_W - fw) / 2;
        const imgY = cellY + (CELL_H - fh) / 2;
        doc.rect(cellX, cellY, CELL_W, CELL_H);
        doc.addImage(f.src, 'JPEG', imgX, imgY, fw, fh, undefined, 'FAST');
        doc.setFontSize(7); doc.text(f.label, cellX + CELL_W / 2, cellY + CELL_H + 5, { align: "center", maxWidth: CELL_W });
    });
};
    // Paso 1: corregir EXIF
    const c1 = document.createElement('canvas');
    const ctx1 = c1.getContext('2d');
    const w = img.naturalWidth, h = img.naturalHeight;
    const swap = orientation >= 5;
    c1.width  = swap ? h : w;
    c1.height = swap ? w : h;
    ctx1.save();
    switch (orientation) {
        case 2: ctx1.transform(-1, 0, 0, 1, w, 0); break;
        case 3: ctx1.transform(-1, 0, 0, -1, w, h); break;
        case 4: ctx1.transform(1, 0, 0, -1, 0, h); break;
        case 5: ctx1.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx1.transform(0, 1, -1, 0, h, 0); break;
        case 7: ctx1.transform(0, -1, -1, 0, h, w); break;
        case 8: ctx1.transform(0, -1, 1, 0, 0, w); break;
        default: break;
    }
    ctx1.drawImage(img, 0, 0);
    ctx1.restore();

    if (manualDeg === 0) {
        resolve({ src: c1.toDataURL('image/jpeg', 0.92), w: c1.width, h: c1.height, label });
        return;
    }

    // Paso 2: aplicar rotación manual
    const c2 = document.createElement('canvas');
    const ctx2 = c2.getContext('2d');
    const sw = c1.width, sh = c1.height;
    const rad = manualDeg * Math.PI / 180;
    if (manualDeg === 90 || manualDeg === 270) {
        c2.width = sh; c2.height = sw;
    } else {
        c2.width = sw; c2.height = sh;
    }
    ctx2.translate(c2.width / 2, c2.height / 2);
    ctx2.rotate(rad);
    ctx2.drawImage(c1, -sw / 2, -sh / 2);
    resolve({ src: c2.toDataURL('image/jpeg', 0.92), w: c2.width, h: c2.height, label });
}
