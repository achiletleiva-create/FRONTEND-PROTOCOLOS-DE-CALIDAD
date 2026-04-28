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

                // Generar canvas con EXIF corregido — redimensionar si es muy grande
                const MAX_DIM = 1600;
                const w = img.naturalWidth, h = img.naturalHeight;
                const swap = orientation >= 5;
                let cw = swap ? h : w;
                let ch = swap ? w : h;
                if (cw > MAX_DIM || ch > MAX_DIM) {
                    const scale = MAX_DIM / Math.max(cw, ch);
                    cw = Math.round(cw * scale);
                    ch = Math.round(ch * scale);
                }
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                c.width = cw;
                c.height = ch;
                ctx.save();
                const sc = Math.min(cw / (swap ? h : w), ch / (swap ? w : h));
                switch (orientation) {
                    case 2: ctx.transform(-sc,0,0,sc,cw,0); break;
                    case 3: ctx.transform(-sc,0,0,-sc,cw,ch); break;
                    case 4: ctx.transform(sc,0,0,-sc,0,ch); break;
                    case 5: ctx.transform(0,sc,sc,0,0,0); break;
                    case 6: ctx.transform(0,sc,-sc,0,ch,0); break;
                    case 7: ctx.transform(0,-sc,-sc,0,ch,cw); break;
                    case 8: ctx.transform(0,-sc,sc,0,0,cw); break;
                    default: ctx.scale(sc, sc); break;
                }
                ctx.drawImage(img, 0, 0);
                ctx.restore();

                const correctedSrc = c.toDataURL('image/jpeg', 0.80);
                inp._correctedSrc = correctedSrc;
                inp._correctedW = c.width;
                inp._correctedH = c.height;

                // Mostrar preview con botón de rotación
                const wrap = document.createElement('div');
                wrap.className = 'foto-preview-wrap';
                wrap.dataset.rotation = '0';

                const previewImg = document.createElement('img');
                previewImg.src = correctedSrc;

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
                        inp._correctedSrc = cRot.toDataURL('image/jpeg', 0.80);
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
 * Lee una imagen y devuelve { src, w, h, label } para insertar en jsPDF.
 * Usa el canvas ya corregido del preview si existe, si no corrige EXIF desde el archivo.
 */
window.leerFotoCorregida = function(file, label, inputElement) {
    return new Promise(resolve => {
        // Usar canvas ya corregido del preview directamente
        if (inputElement && inputElement._correctedSrc) {
            resolve({
                src: inputElement._correctedSrc,
                w: inputElement._correctedW,
                h: inputElement._correctedH,
                label
            });
            return;
        }
        // Fallback: corregir EXIF desde el archivo (sin preview)
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
                    dibujar(img, orientation, resolve, label);
                };
                fr2.readAsArrayBuffer(file);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

/**
 * Inserta fotos en el PDF con layout inteligente:
 * 1 foto → centrada, grande, ocupando casi toda la página
 * 2 fotos → una arriba y otra abajo, equitativas
 * 3 fotos → 2 arriba (una al lado de otra) y 1 abajo centrada más grande
 * 4+ fotos → 2x2, 3x2, etc. (usa 2ª página si hay más de 6)
 */
window.insertarFotosEnPDF = function(doc, fotos, tituloY) {
    if (!fotos || fotos.length === 0) return;

    const n = fotos.length;
    const MARGIN = 10, GAP = 6, LABEL_H = 8;
    const PAGE_W = 190, PAGE_H = 277;
    const titleY = tituloY || 15;
    const startY = titleY + 8;
    const areaH = PAGE_H - startY - 10; // altura disponible para fotos

    let pagina = -1;

    // Función auxiliar para insertar una foto en una celda
    function insertarFoto(f, cellX, cellY, cellW, cellH) {
        const ratio = Math.min(cellW / f.w, cellH / f.h);
        const fw = f.w * ratio, fh = f.h * ratio;
        doc.rect(cellX, cellY, cellW, cellH);
        try {
            doc.addImage(f.src, 'JPEG', cellX + (cellW - fw) / 2, cellY + (cellH - fh) / 2, fw, fh, undefined, 'FAST');
        } catch(e) {
            try {
                doc.addImage(f.src, 'PNG', cellX + (cellW - fw) / 2, cellY + (cellH - fh) / 2, fw, fh, undefined, 'FAST');
            } catch(e2) {
                console.error('Error al insertar imagen en PDF:', e2);
            }
        }
        doc.setFontSize(7);
        doc.text(f.label, cellX + cellW / 2, cellY + cellH + 5, { align: 'center', maxWidth: cellW });
    }

    // Layout personalizado según cantidad de fotos
    if (n === 1) {
        // 1 foto: centrada, grande
        pagina++;
        doc.addPage();
        doc.setFontSize(11); doc.setTextColor(0, 74, 153);
        doc.text('REGISTRO FOTOGRÁFICO', 105, titleY, { align: 'center' });
        doc.setTextColor(0);
        const cellW = PAGE_W - MARGIN * 2;
        const cellH = areaH - LABEL_H;
        insertarFoto(fotos[0], MARGIN, startY, cellW, cellH);

    } else if (n === 2) {
        // 2 fotos: una arriba y otra abajo
        pagina++;
        doc.addPage();
        doc.setFontSize(11); doc.setTextColor(0, 74, 153);
        doc.text('REGISTRO FOTOGRÁFICO', 105, titleY, { align: 'center' });
        doc.setTextColor(0);
        const cellW = PAGE_W - MARGIN * 2;
        const cellH = (areaH - GAP - LABEL_H * 2) / 2;
        insertarFoto(fotos[0], MARGIN, startY, cellW, cellH);
        insertarFoto(fotos[1], MARGIN, startY + cellH + GAP + LABEL_H, cellW, cellH);

    } else if (n === 3) {
        // 3 fotos: 2 arriba (una al lado de otra) y 1 abajo centrada más grande
        pagina++;
        doc.addPage();
        doc.setFontSize(11); doc.setTextColor(0, 74, 153);
        doc.text('REGISTRO FOTOGRÁFICO', 105, titleY, { align: 'center' });
        doc.setTextColor(0);

        // Las 2 de arriba ocupan ~40% de la altura cada una
        const supCellW = (PAGE_W - MARGIN * 2 - GAP) / 2;
        const supCellH = areaH * 0.40 - LABEL_H;
        insertarFoto(fotos[0], MARGIN, startY, supCellW, supCellH);
        insertarFoto(fotos[1], MARGIN + supCellW + GAP, startY, supCellW, supCellH);

        // La de abajo centrada, ocupa el ~55% restante
        const infCellW = PAGE_W - MARGIN * 2;
        const infCellH = areaH * 0.55 - LABEL_H;
        const infY = startY + supCellH + GAP + LABEL_H;
        insertarFoto(fotos[2], MARGIN, infY, infCellW, infCellH);

    } else {
        // 4+ fotos: layout en cuadrícula (2x2, 3x2, etc.)
        let cols, rows;
        if      (n <= 4) { cols = 2; rows = 2; }
        else             { cols = 3; rows = 2; }

        const fotasPorPagina = cols * rows;
        const cellW = (PAGE_W - (cols - 1) * GAP) / cols;
        const cellH = (areaH - (rows - 1) * GAP - rows * LABEL_H) / rows;

        fotos.forEach((f, i) => {
            const posEnPagina = i % fotasPorPagina;
            const col = posEnPagina % cols;
            const row = Math.floor(posEnPagina / cols);

            if (posEnPagina === 0) {
                pagina++;
                doc.addPage();
                doc.setFontSize(11); doc.setTextColor(0, 74, 153);
                doc.text(
                    pagina === 0 ? 'REGISTRO FOTOGRÁFICO' : 'REGISTRO FOTOGRÁFICO (continuación)',
                    105, titleY, { align: 'center' }
                );
                doc.setTextColor(0);
            }

            const cellX = MARGIN + col * (cellW + GAP);
            const cellY = startY + row * (cellH + GAP + LABEL_H);
            insertarFoto(f, cellX, cellY, cellW, cellH);
        });
    }
};

function dibujar(img, orientation, resolve, label) {
    const c1 = document.createElement('canvas');
    const ctx1 = c1.getContext('2d');
    const w = img.naturalWidth, h = img.naturalHeight;
    const swap = orientation >= 5;
    
    // Redimensionar a máximo 1200px para evitar problemas con jsPDF
    const MAX_DIM = 1200;
    let cw = swap ? h : w;
    let ch = swap ? w : h;
    if (cw > MAX_DIM || ch > MAX_DIM) {
        const scale = MAX_DIM / Math.max(cw, ch);
        cw = Math.round(cw * scale);
        ch = Math.round(ch * scale);
    }
    
    c1.width = cw;
    c1.height = ch;
    ctx1.save();
    const sc = Math.min(cw / (swap ? h : w), ch / (swap ? w : h));
    switch (orientation) {
        case 2: ctx1.transform(-sc, 0, 0, sc, cw, 0); break;
        case 3: ctx1.transform(-sc, 0, 0, -sc, cw, ch); break;
        case 4: ctx1.transform(sc, 0, 0, -sc, 0, ch); break;
        case 5: ctx1.transform(0, sc, sc, 0, 0, 0); break;
        case 6: ctx1.transform(0, sc, -sc, 0, ch, 0); break;
        case 7: ctx1.transform(0, -sc, -sc, 0, ch, cw); break;
        case 8: ctx1.transform(0, -sc, sc, 0, 0, cw); break;
        default: ctx1.scale(sc, sc); break;
    }
    ctx1.drawImage(img, 0, 0);
    ctx1.restore();
    resolve({ src: c1.toDataURL('image/jpeg', 0.70), w: c1.width, h: c1.height, label });
}
