/* NOVA STRIKE: canvas vertical shooter */
(() => {
    'use strict';

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, DPR = 1;

    // ===================== utils =====================
    const TAU = Math.PI * 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const fmt = n => Math.floor(n).toLocaleString('en-US');
    const FONT = 'Orbitron, Rajdhani, sans-serif';

    function weighted(table) {
        let total = 0;
        for (const k in table) total += table[k];
        let r = Math.random() * total;
        for (const k in table) {
            r -= table[k];
            if (r <= 0) return k;
        }
        return Object.keys(table)[0];
    }

    function compact(arr, keep) {
        let j = 0;
        for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
        arr.length = j;
    }

    function roundRect(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    function poly(g, pts) {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
    }

    const storage = {
        get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
    };

    // ===================== sprites =====================
    const SPRITE_SCALE = 2;

    function makeSprite(w, h, pad, draw) {
        const c = document.createElement('canvas');
        c.width = Math.ceil((w + pad * 2) * SPRITE_SCALE);
        c.height = Math.ceil((h + pad * 2) * SPRITE_SCALE);
        const g = c.getContext('2d');
        g.scale(SPRITE_SCALE, SPRITE_SCALE);
        g.translate(w / 2 + pad, h / 2 + pad);
        draw(g);
        return { img: c, w: w + pad * 2, h: h + pad * 2 };
    }

    function whiteOf(s) {
        const c = document.createElement('canvas');
        c.width = s.img.width;
        c.height = s.img.height;
        const g = c.getContext('2d');
        g.drawImage(s.img, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        return { img: c, w: s.w, h: s.h };
    }

    function drawSprite(s, x, y, rot, alpha, scale) {
        if (!rot && (alpha === undefined || alpha === 1) && !scale) {
            ctx.drawImage(s.img, x - s.w / 2, y - s.h / 2, s.w, s.h);
            return;
        }
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (scale) ctx.scale(scale, scale);
        if (alpha !== undefined) ctx.globalAlpha = alpha;
        ctx.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h);
        ctx.restore();
    }

    function core(g, x, y, r, inner, outer) {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, '#fff');
        gr.addColorStop(0.4, inner);
        gr.addColorStop(1, outer);
        g.save();
        g.shadowColor = outer;
        g.shadowBlur = 8;
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.restore();
    }

    function shaded(g, pts, dark, light, glow) {
        const gr = g.createLinearGradient(0, -30, 0, 30);
        gr.addColorStop(0, dark);
        gr.addColorStop(1, light);
        g.save();
        g.shadowColor = glow;
        g.shadowBlur = 12;
        g.fillStyle = gr;
        poly(g, pts);
        g.fill();
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 1.1;
        poly(g, pts);
        g.stroke();
    }

    // Hero ship + boss shapes come from the original SVG artwork
    const HERO = {
        wingL: new Path2D('M94.96,146.812c-0.3-4.494,0.946-18.344-3.883-13.857c-11.532,10.717-22.584,24.722-22.584,24.722c-2.969,2.821-5.4,8.48-5.4,12.579v104.281c0,4.096,2.432,5.141,5.4,2.314l43.839-45.804c2.851-2.879,0.512-5.724-0.389-7.542C103.089,205.607,97.039,177.782,94.96,146.812z'),
        wingR: new Path2D('M292.815,157.676c0,0-11.051-14.005-22.584-24.722c-4.826-4.486-3.582,9.364-3.881,13.857c-2.082,30.97-8.129,58.796-16.984,76.692c-0.9,1.819-3.238,4.664-0.389,7.542l43.838,45.804c2.971,2.826,5.4,1.781,5.4-2.315V170.255C298.218,166.157,295.786,160.498,292.815,157.676z'),
        body: new Path2D('M180.71,236.783c43.977,0,54.656-10.348,54.656-10.348c12.748-21.398,20.566-62.267,20.566-105.767C255.933,54.682,197.978,0,180.55,0c-17.355,0-75.384,54.682-75.384,120.669c0,42.211,7.822,84.368,20.571,105.767C125.738,226.436,135.775,236.783,180.71,236.783z M179.747,57.526c21.216,0,38.417,17.199,38.417,38.413c0,21.218-17.2,38.416-38.417,38.416c-21.215,0-38.411-17.198-38.411-38.416C141.336,74.725,158.532,57.526,179.747,57.526z'),
        flame: new Path2D('M234.536,240.931c-1.857-7.202-2.916,6.584-54.354,6.665c-51.44-0.081-52.495-13.867-54.354-6.665c-0.364,1.406-2.108,16.785-2.649,22.345c-0.688,7.14-2.158,15.922-2.158,25.168c0,21.789,12.241,39.844,18.209,39.844c6.377,0,12.418-15.99,12.418-15.99c0.756-1.24,1.826-1.152,2.378,0.189c0,0,13.96,48.822,25.71,48.822c0.149,0,0.3-0.041,0.447-0.057c0.147,0.016,0.299,0.057,0.445,0.057c11.752,0,25.71-48.822,25.71-48.822c0.554-1.342,1.624-1.43,2.379-0.189c0,0,6.042,15.99,12.416,15.99c5.97,0,18.213-18.055,18.213-39.844c0-9.246-1.473-18.028-2.16-25.168C236.646,257.716,234.901,242.337,234.536,240.931z')
    };
    const HERO_K = 0.2, HERO_CX = 180.65, HERO_CY = 150;
    const BOSS_PATH = new Path2D('M64.601,236.822c0,157.434,128.185,375.178,241.4,375.178c106.581,0,241.399-217.744,241.399-375.178S439.322,0,306,0S64.601,79.388,64.601,236.822z M368.721,353.237c29.475-29.475,70.598-40.195,108.552-32.173c8.021,37.954-2.698,79.077-32.173,108.552c-29.475,29.475-70.598,40.195-108.552,32.173C328.526,423.834,339.246,382.711,368.721,353.237z M134.727,321.063c37.954-8.021,79.077,2.698,108.552,32.173c29.475,29.475,40.195,70.598,32.173,108.552c-37.954,8.021-79.077-2.698-108.552-32.173C137.425,400.139,126.706,359.017,134.727,321.063z');
    const BOSS_K = 0.27, BOSS_CX = 306, BOSS_CY = 280;

    const SPR = {};
    const glowCache = {}, orbCache = {}, powerCache = {}, bossCache = {};

    function buildSprites() {
        SPR.hero = makeSprite(72, 72, 12, g => {
            g.scale(HERO_K, HERO_K);
            g.translate(-HERO_CX, -HERO_CY);
            g.shadowColor = '#3ff6ff';
            g.shadowBlur = 40;
            const wg = g.createLinearGradient(60, 130, 300, 280);
            wg.addColorStop(0, '#9ffcff');
            wg.addColorStop(1, '#2bb7c9');
            g.fillStyle = wg;
            g.fill(HERO.wingL);
            g.fill(HERO.wingR);
            const bg = g.createLinearGradient(0, 0, 0, 240);
            bg.addColorStop(0, '#3fe0e3');
            bg.addColorStop(1, '#0d4f55');
            g.fillStyle = bg;
            g.fill(HERO.body, 'evenodd');
            g.shadowBlur = 0;
            g.lineWidth = 5;
            g.strokeStyle = 'rgba(220,255,255,0.7)';
            g.stroke(HERO.body);
            const cg = g.createRadialGradient(170, 85, 4, 180, 96, 40);
            cg.addColorStop(0, '#ffffff');
            cg.addColorStop(0.3, '#ffb37a');
            cg.addColorStop(1, '#ff4815');
            g.fillStyle = cg;
            g.beginPath();
            g.arc(179.75, 95.94, 38.4, 0, TAU);
            g.fill();
        });

        SPR.drone = makeSprite(36, 36, 10, g => {
            shaded(g, [[0, 17], [-6, 5], [-17, -1], [-14, -13], [-5, -8], [0, -15], [5, -8], [14, -13], [17, -1], [6, 5]], '#4a0a1c', '#ff4d6d', '#ff4d6d');
            core(g, 0, -1, 4.5, '#ffd0da', '#ff2d55');
        });
        SPR.weaver = makeSprite(42, 32, 10, g => {
            shaded(g, [[0, 15], [-8, 6], [-21, 9], [-17, -4], [-7, -13], [0, -8], [7, -13], [17, -4], [21, 9], [8, 6]], '#0b4a24', '#5dff9a', '#5dff9a');
            core(g, -9, 1, 3, '#d8ffe6', '#2bff7a');
            core(g, 9, 1, 3, '#d8ffe6', '#2bff7a');
            core(g, 0, 0, 4, '#fff', '#5dff9a');
        });
        SPR.diver = makeSprite(30, 40, 10, g => {
            shaded(g, [[0, 21], [-5, 5], [-14, -15], [-4, -9], [0, -18], [4, -9], [14, -15], [5, 5]], '#5a4300', '#ffd84d', '#ffcc00');
            core(g, 0, 2, 3.5, '#fff6c8', '#ffb700');
        });
        SPR.gunship = makeSprite(66, 50, 12, g => {
            g.fillStyle = '#3a1f5c';
            g.fillRect(-21, 6, 6, 18);
            g.fillRect(15, 6, 6, 18);
            g.fillStyle = '#e2c8ff';
            g.fillRect(-20, 20, 4, 4);
            g.fillRect(16, 20, 4, 4);
            shaded(g, [[-32, -6], [-23, -21], [23, -21], [32, -6], [25, 10], [10, 17], [-10, 17], [-25, 10]], '#26104a', '#b46bff', '#a05bff');
            g.strokeStyle = 'rgba(255,255,255,0.25)';
            g.beginPath();
            g.moveTo(-22, -8); g.lineTo(22, -8);
            g.moveTo(-12, -21); g.lineTo(-8, 12);
            g.moveTo(12, -21); g.lineTo(8, 12);
            g.stroke();
            core(g, 0, 2, 6, '#f3e6ff', '#9b4dff');
        });
        SPR.spinner = makeSprite(52, 52, 10, g => {
            const spikes = [];
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * TAU, r = i % 2 ? 15 : 26;
                spikes.push([Math.cos(a) * r, Math.sin(a) * r]);
            }
            shaded(g, spikes, '#5a2300', '#ff9a3c', '#ff7a00');
            const hex = [];
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU + Math.PI / 6;
                hex.push([Math.cos(a) * 12, Math.sin(a) * 12]);
            }
            shaded(g, hex, '#7a3300', '#ffc27a', '#ff9a3c');
            core(g, 0, 0, 6, '#fff1dc', '#ff6a00');
        });
        for (const k of ['drone', 'weaver', 'diver', 'gunship', 'spinner']) SPR[k + 'W'] = whiteOf(SPR[k]);

        SPR.bolt = makeSprite(5, 24, 6, g => {
            g.shadowColor = '#3ff6ff';
            g.shadowBlur = 10;
            const gr = g.createLinearGradient(0, -12, 0, 12);
            gr.addColorStop(0, '#ffffff');
            gr.addColorStop(0.5, '#7ffbff');
            gr.addColorStop(1, 'rgba(0,200,255,0)');
            g.fillStyle = gr;
            roundRect(g, -2.5, -12, 5, 24, 2.5);
            g.fill();
        });
        SPR.missile = makeSprite(8, 16, 6, g => {
            g.shadowColor = '#ffd84d';
            g.shadowBlur = 8;
            g.fillStyle = '#ffe9a8';
            poly(g, [[0, -8], [4, -2], [3, 8], [-3, 8], [-4, -2]]);
            g.fill();
        });
        SPR.life = makeSprite(18, 18, 2, g => {
            g.scale(0.055, 0.055);
            g.translate(-HERO_CX, -HERO_CY);
            g.fillStyle = '#7ffbff';
            g.fill(HERO.wingL); g.fill(HERO.wingR); g.fill(HERO.body, 'evenodd');
        });
    }

    function getGlow(color) {
        if (!glowCache[color]) {
            glowCache[color] = makeSprite(64, 64, 0, g => {
                const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32);
                gr.addColorStop(0, color);
                gr.addColorStop(0.35, color + '88');
                gr.addColorStop(1, color + '00');
                g.fillStyle = gr;
                g.fillRect(-32, -32, 64, 64);
            });
        }
        return glowCache[color];
    }

    function getOrb(color, r) {
        const key = color + r;
        if (!orbCache[key]) {
            orbCache[key] = makeSprite(r * 2, r * 2, r * 1.8, g => {
                const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.8);
                gr.addColorStop(0, color + 'aa');
                gr.addColorStop(1, color + '00');
                g.fillStyle = gr;
                g.beginPath(); g.arc(0, 0, r * 2.8, 0, TAU); g.fill();
                const ig = g.createRadialGradient(0, 0, 0, 0, 0, r);
                ig.addColorStop(0, '#ffffff');
                ig.addColorStop(0.55, '#ffffff');
                ig.addColorStop(1, color);
                g.fillStyle = ig;
                g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
            });
        }
        return orbCache[key];
    }

    const POWER_KINDS = {
        P: { color: '#ff3d6e', label: 'P', name: 'POWER UP' },
        S: { color: '#3fa9ff', label: 'S', name: 'SHIELD' },
        E: { color: '#c56bff', label: 'E', name: 'ENERGY FULL' },
        H: { color: '#3dff8b', label: '+', name: 'HULL REPAIR' },
        B: { color: '#ff9a2e', label: 'B', name: 'NOVA BOMB' },
        L: { color: '#ffe14d', label: '1UP', name: 'EXTRA SHIP' }
    };

    function getPowerSprite(kind) {
        if (!powerCache[kind]) {
            const k = POWER_KINDS[kind];
            powerCache[kind] = makeSprite(30, 30, 10, g => {
                const hex = [];
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * TAU + Math.PI / 6;
                    hex.push([Math.cos(a) * 15, Math.sin(a) * 15]);
                }
                g.shadowColor = k.color;
                g.shadowBlur = 14;
                const gr = g.createRadialGradient(0, -4, 2, 0, 0, 16);
                gr.addColorStop(0, '#ffffff');
                gr.addColorStop(0.35, k.color);
                gr.addColorStop(1, '#111');
                g.fillStyle = gr;
                poly(g, hex); g.fill();
                g.shadowBlur = 0;
                g.lineWidth = 2;
                g.strokeStyle = '#fff';
                poly(g, hex); g.stroke();
                g.fillStyle = '#fff';
                g.font = `900 ${k.label.length > 1 ? 9 : 14}px ${FONT}`;
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                g.fillText(k.label, 0, 1);
            });
        }
        return powerCache[kind];
    }

    function getBossSprite(color, dark) {
        if (!bossCache[color]) {
            const s = makeSprite(210, 180, 24, g => {
                // side cannon pods
                for (const side of [-1, 1]) {
                    g.save();
                    g.translate(side * 80, -6);
                    g.fillStyle = '#222';
                    g.fillRect(-7, 10, 14, 30);
                    g.fillStyle = color;
                    g.fillRect(-4, 34, 8, 6);
                    shaded(g, [[-20, -26], [20, -26], [24, 6], [12, 22], [-12, 22], [-24, 6]], dark, color, color);
                    core(g, 0, -4, 6, '#fff', color);
                    g.restore();
                }
                g.fillStyle = dark;
                g.fillRect(-70, -18, 140, 16);
                // eye glow sits behind the transparent eye cut-outs
                for (const side of [-1, 1]) core(g, side * 28, 32, 15, '#ffe0e0', '#ff1a1a');
                g.save();
                g.scale(BOSS_K, BOSS_K);
                g.translate(-BOSS_CX, -BOSS_CY);
                g.shadowColor = color;
                g.shadowBlur = 60;
                const gr = g.createLinearGradient(0, 0, 0, 612);
                gr.addColorStop(0, color);
                gr.addColorStop(0.55, dark);
                gr.addColorStop(1, '#050505');
                g.fillStyle = gr;
                g.fill(BOSS_PATH, 'evenodd');
                g.shadowBlur = 0;
                g.lineWidth = 7;
                g.strokeStyle = 'rgba(255,255,255,0.5)';
                g.stroke(BOSS_PATH);
                g.restore();
                g.strokeStyle = 'rgba(255,255,255,0.18)';
                g.lineWidth = 1.5;
                g.beginPath();
                g.moveTo(0, -75); g.lineTo(0, 0);
                g.moveTo(-40, -40); g.lineTo(-20, 10);
                g.moveTo(40, -40); g.lineTo(20, 10);
                g.stroke();
            });
            bossCache[color] = { s, w: whiteOf(s) };
        }
        return bossCache[color];
    }

    // ===================== background =====================
    let bgCanvas = null, bgPrev = null, bgFade = 0, bgTileH = 0, bgScroll = 0, vignette = null;
    const stars = [];
    const STAR_SPEED = [22, 55, 130], STAR_SIZE = [0.8, 1.3, 2], STAR_ALPHA = [0.35, 0.65, 1];
    let warp = 1, warpTarget = 1;
    const hexA = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

    // procedural nebula tinted per stage; tiles vertically so it can scroll forever
    function buildNebula(st, seedBase) {
        const th = Math.max(H, 800);
        const c = document.createElement('canvas');
        c.width = W;
        c.height = th;
        const g = c.getContext('2d');
        g.fillStyle = '#03040c';
        g.fillRect(0, 0, W, th);
        let seed = seedBase * 7919 + 13;
        const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) {
            const x = rnd() * W, y = rnd() * th, r = (0.18 + rnd() * 0.35) * Math.max(W, th);
            const accent = i % 4 === 0;
            const col = accent ? st.color : i % 2 ? st.tint : '#1a0b3d';
            const a = accent ? 0.06 : 0.2;
            for (const oy of [-th, 0, th]) {
                const gr = g.createRadialGradient(x, y + oy, 0, x, y + oy, r);
                gr.addColorStop(0, hexA(col, a));
                gr.addColorStop(1, hexA(col, 0));
                g.fillStyle = gr;
                g.fillRect(0, 0, W, th);
            }
        }
        g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 500; i++) {
            g.fillStyle = `rgba(220,235,255,${rnd() * 0.45})`;
            g.fillRect(rnd() * W, rnd() * th, 1, 1);
        }
        bgTileH = th;
        return c;
    }

    function buildBackground(crossfade) {
        if (crossfade && bgCanvas) { bgPrev = bgCanvas; bgFade = 1; }
        bgCanvas = buildNebula(currentStage(), run.stage + 1);
        vignette = document.createElement('canvas');
        vignette.width = W;
        vignette.height = H;
        const v = vignette.getContext('2d');
        const gr = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(1, 'rgba(0,0,10,0.75)');
        v.fillStyle = gr;
        v.fillRect(0, 0, W, H);
    }

    function initStars() {
        stars.length = 0;
        const n = Math.floor((W * H) / 5000);
        for (let i = 0; i < n; i++) stars.push({ x: rand(0, W), y: rand(0, H), z: i % 3, tw: rand(0, TAU) });
    }

    function updateBackground(dt) {
        warp = lerp(warp, warpTarget, Math.min(1, dt * 2));
        if (bgTileH) bgScroll = (bgScroll + dt * 14 * warp) % bgTileH;
        if (bgFade > 0) bgFade = Math.max(0, bgFade - dt * 0.6);
        for (const s of stars) {
            s.y += STAR_SPEED[s.z] * warp * dt;
            s.tw += dt * 3;
            if (s.y > H) { s.y -= H + 4; s.x = rand(0, W); }
        }
    }

    function drawBackground() {
        ctx.drawImage(bgCanvas, 0, bgScroll - bgTileH);
        ctx.drawImage(bgCanvas, 0, bgScroll);
        if (bgFade > 0 && bgPrev) {
            ctx.globalAlpha = bgFade;
            ctx.drawImage(bgPrev, 0, bgScroll - bgTileH);
            ctx.drawImage(bgPrev, 0, bgScroll);
            ctx.globalAlpha = 1;
        }

        for (const s of stars) {
            const a = STAR_ALPHA[s.z] * (0.75 + Math.sin(s.tw) * 0.25);
            ctx.fillStyle = `rgba(200,235,255,${a})`;
            const len = warp > 1.5 ? STAR_SPEED[s.z] * warp * 0.04 : STAR_SIZE[s.z];
            ctx.fillRect(s.x, s.y, STAR_SIZE[s.z], len);
        }
    }

    // ===================== stage design =====================
    // x / y values are fractions of the screen so levels scale to any window
    const range = n => Array.from({ length: n }, (_, i) => i);
    const F = {
        line: (type, n, y, o) => range(n).map(i => ({ t: i * 0.12, type, x: (i + 1) / (n + 1), y: -0.06, path: 'drop', ty: y, ...o })),
        vee: (type, n, y, o) => range(n).map(i => {
            const d = i - (n - 1) / 2;
            return { t: Math.abs(d) * 0.15, type, x: 0.5 + d * (0.8 / n), y: -0.06, path: 'drop', ty: y - Math.abs(d) * 0.035, ...o };
        }),
        snake: (type, n, side, y, o) => range(n).map(i => ({ t: i * 0.32, type, x: side > 0 ? -0.06 : 1.06, y, path: 'snake', dir: side, ...o })),
        swoop: (type, n, fromLeft, o) => range(n).map(i => {
            const pts = [[-0.08, 0.0], [0.35, 0.85], [0.7, 0.0], [1.08, 0.38]];
            return { t: i * 0.22, type, path: 'bezier', pts: fromLeft ? pts : pts.map(p => [1 - p[0], p[1]]), dur: 3.4, ...o };
        }),
        rain: (type, n, dur, o) => range(n).map(i => ({ t: (i * dur) / n + rand(0, 0.3), type, x: rand(0.08, 0.92), y: -0.06, path: 'sine', amp: rand(10, 45), ...o })),
        divers: (n, o) => range(n).map(i => ({ t: i * 0.5, type: 'diver', x: rand(0.1, 0.9), y: -0.06, path: 'dive', ty: rand(0.1, 0.3), wait: rand(0.6, 1.3), ...o })),
        column: (type, n, x, o) => range(n).map(i => ({ t: i * 0.35, type, x, y: -0.06, path: 'sine', amp: 30, ...o })),
        heavy: (type, xs, y, o) => xs.map((x, i) => ({ t: i * 0.6, type, x, y: -0.1, path: 'drop', ty: y, hover: 14, ...o }))
    };
    const D = (d, arr) => arr.map(s => ({ ...s, t: s.t + d }));

    const STAGES = [
        {
            name: 'OUTER RIM', bullet: '#ff7a3d', boss: 'SENTINEL MK-I', color: '#36e6ff', dark: '#0b3550', tint: '#0b4f8a', key: 0,
            waves: [
                () => [F.line('drone', 5, 0.16, { noFire: true })],
                () => [F.snake('drone', 6, 1, 0.14, { noFire: true })],
                () => [F.snake('drone', 6, -1, 0.24), D(1.2, F.snake('drone', 6, 1, 0.1))],
                () => [F.vee('drone', 7, 0.26)],
                () => [F.swoop('drone', 6, true), D(1.6, F.swoop('drone', 6, false))],
                () => [F.heavy('gunship', [0.5], 0.2), D(1, F.rain('drone', 8, 6))],
                () => [F.line('weaver', 4, 0.18), D(2, F.divers(3))]
            ]
        },
        {
            name: 'ASTEROID BELT', bullet: '#d4ff3d', boss: 'GORGON', color: '#7dff6b', dark: '#1d4a12', tint: '#2a5a12', key: -2,
            waves: [
                () => [F.vee('weaver', 5, 0.22)],
                () => [F.snake('drone', 8, 1, 0.12), D(0.8, F.snake('drone', 8, -1, 0.3))],
                () => [F.divers(5)],
                () => [F.swoop('weaver', 6, false), D(2, F.line('drone', 6, 0.12))],
                () => [F.heavy('gunship', [0.3, 0.7], 0.18)],
                () => [F.column('weaver', 5, 0.22), F.column('weaver', 5, 0.78)],
                () => [F.rain('drone', 14, 7), D(3, F.divers(4))]
            ]
        },
        {
            name: 'CRIMSON NEBULA', bullet: '#ff3d9a', boss: 'HYDRA', color: '#ff5a8a', dark: '#5a0f2c', tint: '#6b0f3a', key: 3,
            waves: [
                () => [F.heavy('spinner', [0.5], 0.2), D(1, F.snake('drone', 7, 1, 0.34))],
                () => [F.swoop('weaver', 7, true), D(1.2, F.swoop('weaver', 7, false))],
                () => [F.vee('drone', 9, 0.28), D(2, F.divers(4))],
                () => [F.heavy('gunship', [0.25, 0.75], 0.17), D(1.5, F.line('weaver', 5, 0.3))],
                () => [F.rain('weaver', 12, 7)],
                () => [F.heavy('spinner', [0.3, 0.7], 0.18), D(2, F.snake('drone', 8, -1, 0.36))],
                () => [F.divers(6), D(1, F.swoop('drone', 8, true))]
            ]
        },
        {
            name: 'IRON FLEET', bullet: '#ffcc33', boss: 'LEVIATHAN', color: '#ffb340', dark: '#5a3205', tint: '#6b3a05', key: 1,
            waves: [
                () => [F.heavy('gunship', [0.2, 0.5, 0.8], 0.16)],
                () => [F.snake('weaver', 8, 1, 0.12), D(0.6, F.snake('weaver', 8, -1, 0.26))],
                () => [F.heavy('spinner', [0.5], 0.25), D(0.5, F.divers(5))],
                () => [F.vee('drone', 11, 0.3), D(1.5, F.vee('weaver', 5, 0.14))],
                () => [F.divers(8)],
                () => [F.heavy('gunship', [0.3, 0.7], 0.15), F.heavy('spinner', [0.5], 0.3)],
                () => [F.swoop('weaver', 8, true), D(1, F.swoop('weaver', 8, false)), D(3, F.rain('drone', 10, 5))]
            ]
        },
        {
            name: 'VOID CORE', bullet: '#c77dff', boss: 'THE DEVOURER', color: '#b47bff', dark: '#2c0f5a', tint: '#3a127a', key: 5,
            waves: [
                () => [F.heavy('spinner', [0.25, 0.75], 0.2), D(1, F.line('weaver', 6, 0.1))],
                () => [F.snake('drone', 10, 1, 0.12), D(0.4, F.snake('drone', 10, -1, 0.22)), D(0.8, F.snake('weaver', 6, 1, 0.32))],
                () => [F.divers(8), D(2, F.heavy('gunship', [0.5], 0.15))],
                () => [F.swoop('drone', 8, true), D(0.8, F.swoop('drone', 8, false)), D(2, F.vee('weaver', 7, 0.25))],
                () => [F.heavy('gunship', [0.2, 0.8], 0.14), F.heavy('spinner', [0.5], 0.26)],
                () => [F.rain('weaver', 16, 8), D(2, F.divers(6))],
                () => [F.heavy('spinner', [0.2, 0.5, 0.8], 0.2)]
            ]
        }
    ];

    const ENEMY_TYPES = {
        drone:   { r: 15, hp: 2,  score: 100, color: '#ff4d6d', fire: 'aim',     rate: 2.6, speed: 150, drop: 0.05, boom: 1,   strafe: 30 },
        weaver:  { r: 17, hp: 4,  score: 150, color: '#5dff9a', fire: 'spread3', rate: 3.0, speed: 120, drop: 0.08, boom: 1.1, strafe: 40 },
        diver:   { r: 14, hp: 2,  score: 200, color: '#ffd84d', fire: null,      rate: 0,   speed: 140, drop: 0.06, boom: 1,   strafe: 20 },
        gunship: { r: 28, hp: 22, score: 700, color: '#b46bff', fire: 'burst',   rate: 2.0, speed: 100, drop: 0.6,  boom: 2,   strafe: 0.16 },
        spinner: { r: 24, hp: 30, score: 900, color: '#ff9a3c', fire: 'ring',    rate: 2.4, speed: 90,  drop: 0.7,  boom: 2.2, strafe: 50 }
    };

    const DROP_TABLE = { P: 34, S: 16, E: 14, H: 18, B: 12, L: 4 };

    // ===================== game state =====================
    let state = 'title';           // title | playing | paused | gameover
    let time = 0, timeScale = 1, slowmo = 0;
    let score = 0, hiScore = parseInt(storage.get('nova.hi', '0'), 10) || 0;
    let combo = 0, comboT = 0, maxCombo = 0;
    let shake = 0, damageFlash = 0, bombFlash = 0;
    const enemies = [], bolts = [], bullets = [], particles = [], powerups = [], texts = [];
    let player = null;
    let diff = null;
    const run = { stage: 0, loop: 0, phase: 'intro', phaseT: 0, waveIdx: -1, pending: [], waveT: 0, gap: 0, groups: [], noDamage: true, bonus: null, boss: null };

    function currentStage() { return STAGES[run.stage]; }
    function multiplier() { return 1 + Math.min(4, Math.floor(combo / 8) * 0.5); }

    function computeDifficulty() {
        const s = run.stage, L = run.loop;
        diff = {
            fire: 0.65 + s * 0.15 + L * 0.4,
            bullet: 1 + s * 0.06 + L * 0.15,
            hp: 1 + s * 0.12 + L * 0.6,
            level: s + L * 5
        };
    }

    function newPlayer() {
        return {
            x: W / 2, y: H - 90, vx: 0, vy: 0, bank: 0,
            hp: 100, lives: 3, bombs: 2, shield: 0,
            weapon: 0, power: 1, energy: 100, energyDelay: 0, overheat: 0,
            fireCD: 0, missileCD: 0, inv: 2, dead: false, respawn: 0, beaming: false
        };
    }

    // ===================== input =====================
    const keys = new Set();
    const mouse = { x: 0, y: 0, active: false, down: false };
    const touch = { active: false, x: 0, y: 0 };
    const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    const BLOCK_KEYS = new Set([...MOVE_KEYS, 'Space', 'Tab']);

    window.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT') return;
        if (BLOCK_KEYS.has(e.code)) e.preventDefault();
        if (!e.repeat) handleShortcut(e.code);
        keys.add(e.code);
        if (MOVE_KEYS.includes(e.code)) mouse.active = false;
    });
    window.addEventListener('keyup', e => keys.delete(e.code));
    window.addEventListener('blur', () => { keys.clear(); mouse.down = false; if (state === 'playing') setPaused(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') setPaused(true); });

    canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
    canvas.addEventListener('mousedown', e => {
        Sound.init();
        if (e.button === 0) mouse.down = true;
        if (e.button === 2 && state === 'playing') useBomb();
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { if (state === 'playing') { e.preventDefault(); switchWeapon(); } }, { passive: false });

    function onTouch(e) {
        e.preventDefault();
        Sound.init();
        if (e.touches.length >= 2 && e.type === 'touchstart' && state === 'playing') useBomb();
        const t = e.touches[0];
        if (!t) { touch.active = false; return; }
        touch.active = true;
        touch.x = t.clientX;
        touch.y = t.clientY - 70;
    }
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchend', onTouch, { passive: false });

    function handleShortcut(code) {
        Sound.init();
        if (code === 'KeyM') { toast(Sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON'); return; }
        if (code === 'KeyN') { toast(Sound.toggleMusic() ? 'MUSIC ON' : 'MUSIC OFF'); return; }
        if (code === 'KeyF') { toggleFullscreen(); return; }

        if (state === 'title') {
            if (code === 'Enter' || code === 'Space') startGame();
        } else if (state === 'playing') {
            if (code === 'KeyP' || code === 'Escape') setPaused(true);
            else if (code === 'KeyH') setPaused(true);
            else if (code === 'KeyQ' || code === 'Tab') switchWeapon();
            else if (code === 'Digit1' || code === 'Numpad1') switchWeapon(0);
            else if (code === 'Digit2' || code === 'Numpad2') switchWeapon(1);
            else if (code === 'KeyB' || code === 'KeyX') useBomb();
        } else if (state === 'paused') {
            if (code === 'KeyP' || code === 'Escape' || code === 'Enter') setPaused(false);
            else if (code === 'KeyR') startGame();
            else if (code === 'KeyT') toTitle();
        } else if (state === 'gameover') {
            if (code === 'KeyR' || code === 'Enter') startGame();
            else if (code === 'Escape') toTitle();
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.();
    }

    // ===================== screens (DOM) =====================
    const $ = id => document.getElementById(id);
    const screens = { title: $('title'), pause: $('pause'), gameover: $('gameover') };

    function showScreen(name) {
        for (const k in screens) screens[k].classList.toggle('show', k === name);
    }

    document.querySelectorAll('.controls-slot').forEach(slot => slot.appendChild($('controlsTpl').content.cloneNode(true)));
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        Sound.init();
        const a = btn.dataset.action;
        if (a === 'start' || a === 'restart') startGame();
        else if (a === 'resume') setPaused(false);
        else if (a === 'title') toTitle();
    });

    let toastT = 0, toastMsg = '';
    function toast(msg) { toastMsg = msg; toastT = 1.4; }

    function toTitle() {
        state = 'title';
        Sound.beamOff();
        Sound.setMusic(0, 0);
        clearWorld();
        $('titleHi').textContent = fmt(hiScore);
        showScreen('title');
    }

    function setPaused(p) {
        if (p && state === 'playing') {
            state = 'paused';
            Sound.beamOff();
            if (player) player.beaming = false;
            showScreen('pause');
        } else if (!p && state === 'paused') {
            state = 'playing';
            showScreen(null);
        }
    }

    // ===================== game flow =====================
    function clearWorld() {
        enemies.length = bolts.length = bullets.length = particles.length = powerups.length = texts.length = 0;
    }

    function startGame() {
        Sound.init();
        Sound.ui();
        Sound.logo();
        clearWorld();
        score = 0;
        combo = comboT = maxCombo = 0;
        run.stage = 0;
        run.loop = 0;
        run.hiShown = false;
        player = newPlayer();
        state = 'playing';
        showScreen(null);
        resetGameOverPanel();
        // ?stage=N in the URL jumps straight to a sector (handy for practice)
        const startAt = clamp((parseInt(new URLSearchParams(location.search).get('stage'), 10) || 1) - 1, 0, STAGES.length - 1);
        startStage(startAt);
    }

    function startStage(i) {
        run.stage = i;
        run.phase = 'intro';
        run.phaseT = 0;
        run.waveIdx = -1;
        run.pending = [];
        run.noDamage = true;
        run.boss = null;
        run.bossDeadT = 0;
        computeDifficulty();
        buildBackground(true);
        warpTarget = 6;
        Sound.setMusic(1, STAGES[i].key);
    }

    function nextWave() {
        const st = currentStage();
        run.waveIdx++;
        if (run.waveIdx >= st.waves.length) {
            run.phase = 'warning';
            run.phaseT = 0;
            Sound.warning();
            return;
        }
        run.pending = [];
        run.groups = [];
        run.waveT = 0;
        st.waves[run.waveIdx]().forEach(formation => {
            const group = { total: formation.length, killed: 0, x: 0, y: 0 };
            run.groups.push(group);
            formation.forEach(spec => run.pending.push({ spec, group }));
        });
        run.pending.sort((a, b) => a.spec.t - b.spec.t);
    }

    function waveAlive() {
        for (const e of enemies) if (!e.isBoss && !e.dead) return true;
        return false;
    }

    function updateStage(dt) {
        run.phaseT += dt;
        if (run.phase === 'intro') {
            if (run.phaseT > 1.6) warpTarget = 1;
            if (run.phaseT > 2.8) { run.phase = 'waves'; nextWave(); }
        } else if (run.phase === 'waves') {
            run.waveT += dt;
            while (run.pending.length && run.pending[0].spec.t <= run.waveT) {
                const p = run.pending.shift();
                spawnEnemy(p.spec, p.group);
            }
            if (!run.pending.length && (!waveAlive() || run.waveT > 28)) {
                run.gap += dt;
                if (run.gap > 1.1) { run.gap = 0; nextWave(); }
            }
        } else if (run.phase === 'warning') {
            if (run.phaseT > 3.4) {
                run.phase = 'boss';
                run.phaseT = 0;
                spawnBoss();
                Sound.setMusic(2);
            }
        } else if (run.phase === 'boss') {
            if (run.boss && run.boss.dead) {
                run.bossDeadT += dt;
                if (run.bossDeadT > 1.4) stageCleared();
            }
        } else if (run.phase === 'clear') {
            for (const p of powerups) p.magnet = true;
            if (run.phaseT > 5) {
                let next = run.stage + 1;
                if (next >= STAGES.length) { next = 0; run.loop++; toast(`LOOP ${run.loop + 1}: DIFFICULTY UP`); }
                startStage(next);
            }
        }
    }

    function stageCleared() {
        const s = run.stage;
        const bonus = { stage: 10000 * (s + 1) * (run.loop + 1), perfect: run.noDamage ? 20000 * (run.loop + 1) : 0, combo: maxCombo };
        run.bonus = bonus;
        addScore(bonus.stage + bonus.perfect, false);
        run.phase = 'clear';
        run.phaseT = 0;
        Sound.setMusic(0);
        Sound.stageClear();
        for (const b of bullets) burstSpark(b.x, b.y, '#ffffff', 2);
        bullets.length = 0;
    }

    function gameOver() {
        state = 'gameover';
        Sound.beamOff();
        Sound.setMusic(0);
        Sound.gameOver();
        const isHi = score > hiScore;
        if (isHi) { hiScore = score; storage.set('nova.hi', String(hiScore)); }
        $('finalScore').textContent = fmt(score);
        $('finalStage').textContent = `${run.stage + 1 + run.loop * STAGES.length}`;
        $('finalCombo').textContent = maxCombo;
        $('newHi').style.display = isHi ? 'block' : 'none';
        showScreen('gameover');
        loadLeaderboard();
    }

    // ===================== leaderboard =====================
    function resetGameOverPanel() {
        $('saveNameGroup').style.display = '';
        $('saveStatus').textContent = '';
    }

    function renderBoard(rows) {
        const body = $('scoreTable').querySelector('tbody');
        body.textContent = '';
        rows.forEach((r, i) => {
            const tr = document.createElement('tr');
            for (const v of [i + 1, String(r.name || '???').slice(0, 16), fmt(Number(r.score) || 0)]) {
                const td = document.createElement('td');
                td.textContent = v;
                tr.appendChild(td);
            }
            body.appendChild(tr);
        });
        $('scoreBoard').style.display = rows.length ? '' : 'none';
    }

    function loadLeaderboard() {
        if (!window.Leaderboard) return;
        Leaderboard.top(10).then(renderBoard).catch(() => {});
    }

    $('saveNameGroup').addEventListener('submit', e => {
        e.preventDefault();
        const name = $('playerName').value.trim().slice(0, 16);
        if (!name || !window.Leaderboard) return;
        $('saveStatus').textContent = 'Saving...';
        Leaderboard.save(name, score, run.stage + 1 + run.loop * STAGES.length)
            .then(() => {
                $('saveNameGroup').style.display = 'none';
                $('saveStatus').textContent = 'Score saved!';
                loadLeaderboard();
            })
            .catch(() => { $('saveStatus').textContent = 'Could not save. Check your connection.'; });
    });

    // ===================== spawning =====================
    function spawnEnemy(spec, group) {
        const T = ENEMY_TYPES[spec.type];
        const hp = Math.ceil(T.hp * diff.hp);
        const e = {
            kind: spec.type, T, spec, group,
            x: (spec.x !== undefined ? spec.x : 0) * W, y: (spec.y !== undefined ? spec.y : 0) * H,
            r: T.r, hp, maxHp: hp, t: 0, phase: 0, vx: 0, vy: 0, rot: 0, flash: 0,
            seed: rand(0, TAU), entered: false, dead: false,
            fireT: rand(0.8, 1.6) + (T.rate / diff.fire) * rand(0.3, 0.8),
            noFire: !!spec.noFire, burst: 0, burstT: 0
        };
        if (spec.path === 'bezier') {
            e.pts = spec.pts.map(p => [p[0] * W, p[1] * H]);
            e.x = e.pts[0][0];
            e.y = e.pts[0][1];
        } else if (spec.path === 'snake') {
            e.y0 = e.y;
            e.speed = Math.max(180, W * 0.26);
        } else if (spec.path === 'sine') {
            e.x0 = e.x;
            e.speed = T.speed * (0.9 + diff.level * 0.04);
        }
        enemies.push(e);
    }

    function spawnBoss() {
        const st = currentStage();
        const hp = Math.round((450 + 220 * run.stage) * (1 + 0.6 * run.loop));
        const art = getBossSprite(st.color, st.dark);
        const e = {
            kind: 'boss', isBoss: true, T: { color: st.color, bullet: st.bullet, score: 10000 * (run.stage + 1) * (run.loop + 1) },
            name: st.boss, art, x: W / 2, y: -140, r: 72, hp, maxHp: hp, t: 0, phase: 0, mode: 0, at: 0,
            tA: 1, tB: 1.5, tC: 6, spin: 0, cycle: 0, flash: 0, entered: true, dead: false, dying: 0, invuln: true
        };
        run.boss = e;
        enemies.push(e);
        Sound.bossRoar();
        shake = 12;
    }

    // ===================== enemy behaviour =====================
    function fireBullet(x, y, angle, speed, color, r, dmg) {
        bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: r || 5, color: color || '#ff3d7f', dmg: dmg || 20, grazed: false });
    }

    function aimAngle(x, y) {
        if (!player || player.dead) return Math.PI / 2;
        return Math.atan2(player.y - y, player.x - x);
    }

    function enemyFire(e) {
        const bs = diff.bullet;
        const a = aimAngle(e.x, e.y);
        switch (e.T.fire) {
            case 'aim':
                fireBullet(e.x, e.y + 12, a, 200 * bs, '#ff3d7f');
                break;
            case 'spread3':
                for (const off of [-0.25, 0, 0.25]) fireBullet(e.x, e.y + 12, a + off, 180 * bs, '#4dffb0');
                break;
            case 'burst':
                e.burst = 3;
                e.burstT = 0;
                break;
            case 'ring': {
                const n = 10 + Math.min(8, diff.level * 2);
                e.rot += 0.3;
                for (let i = 0; i < n; i++) fireBullet(e.x, e.y, e.rot + (i / n) * TAU, 140 * bs, '#ffa630', 6);
                break;
            }
        }
        spawnParticle({ type: 'glow', x: e.x, y: e.y + 10, size: 26, life: 0.15, color: e.T.color });
        Sound.enemyShot();
    }

    function updateEnemyBurst(e, dt) {
        if (e.burst <= 0) return;
        e.burstT -= dt;
        if (e.burstT > 0) return;
        e.burstT = 0.13;
        e.burst--;
        for (const side of [-18, 18]) {
            fireBullet(e.x + side, e.y + 22, aimAngle(e.x + side, e.y + 22), 230 * diff.bullet, '#c77dff');
        }
        Sound.enemyShot();
    }

    function moveEnemy(e, dt) {
        const T = e.T;
        switch (e.spec.path) {
            case 'drop': {
                if (e.phase === 0) {
                    const ty = e.spec.ty * H, dy = ty - e.y;
                    e.y += Math.sign(dy) * Math.min(Math.abs(dy), Math.max(Math.abs(dy) * 2.4, 40) * dt);
                    if (Math.abs(dy) < 2) { e.phase = 1; e.t2 = 0; e.hx = e.x; }
                } else if (e.phase === 1) {
                    e.t2 += dt;
                    const amp = T.strafe < 1 ? T.strafe * W : T.strafe;
                    e.x = clamp(e.hx + Math.sin(e.t2 * 0.9 + e.seed) * amp, e.r, W - e.r);
                    e.y += Math.sin(e.t2 * 2 + e.seed) * 10 * dt;
                    if (e.t2 > (e.spec.hover || 4 + (e.seed % 2))) e.phase = 2;
                } else {
                    e.vy = Math.min(e.vy + 240 * dt, 320);
                    e.y += e.vy * dt;
                }
                break;
            }
            case 'sine':
                e.y += e.speed * dt;
                e.x = e.x0 + Math.sin(e.t * 2 + e.seed) * e.spec.amp;
                break;
            case 'snake':
                e.x += e.spec.dir * e.speed * dt;
                e.y = e.y0 + Math.sin(e.t * 2.6) * H * 0.06 + e.t * 10;
                break;
            case 'bezier': {
                const u = e.t / e.spec.dur;
                if (u < 1 && dt > 0) {
                    const p = e.pts, m = 1 - u;
                    const nx = m * m * m * p[0][0] + 3 * m * m * u * p[1][0] + 3 * m * u * u * p[2][0] + u * u * u * p[3][0];
                    const ny = m * m * m * p[0][1] + 3 * m * m * u * p[1][1] + 3 * m * u * u * p[2][1] + u * u * u * p[3][1];
                    e.vx = (nx - e.x) / dt;
                    e.vy = (ny - e.y) / dt;
                    e.x = nx;
                    e.y = ny;
                } else {
                    e.x += e.vx * dt;
                    e.y += e.vy * dt;
                }
                e.rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
                break;
            }
            case 'dive': {
                if (e.phase === 0) {
                    const ty = e.spec.ty * H;
                    e.y += Math.max((ty - e.y) * 2.5, 30) * dt;
                    if (e.y >= ty - 2) { e.phase = 1; e.t2 = 0; }
                } else if (e.phase === 1) {
                    e.t2 += dt;
                    const a = aimAngle(e.x, e.y);
                    e.rot = a - Math.PI / 2;
                    e.x += Math.sin(e.t2 * 40) * 0.8;
                    if (e.t2 > e.spec.wait) {
                        e.phase = 2;
                        const sp = 380 * (0.9 + diff.level * 0.05);
                        e.vx = Math.cos(a) * sp;
                        e.vy = Math.sin(a) * sp;
                        Sound.dive();
                        if (diff.level >= 2) fireBullet(e.x, e.y, a, 240 * diff.bullet, '#ffe14d');
                    }
                } else {
                    e.vx *= 1 + dt * 0.6;
                    e.vy *= 1 + dt * 0.6;
                    e.x += e.vx * dt;
                    e.y += e.vy * dt;
                    if (Math.random() < 0.6) spawnParticle({ type: 'spark', x: e.x, y: e.y, vx: -e.vx * 0.2, vy: -e.vy * 0.2, life: 0.25, size: 2, color: '#ffd84d' });
                }
                break;
            }
        }
        if (e.kind === 'spinner') e.rot += dt * 2.2;
    }

    function updateEnemy(e, dt) {
        e.t += dt;
        if (e.flash > 0) e.flash -= dt;
        if (e.isBoss) { updateBoss(e, dt); return; }
        moveEnemy(e, dt);

        const onScreen = e.x > -e.r && e.x < W + e.r && e.y > -e.r && e.y < H + e.r;
        if (onScreen) e.entered = true;
        else if (e.entered || e.t > 30) { e.dead = true; e.escaped = true; return; }

        updateEnemyBurst(e, dt);
        if (e.T.fire && !e.noFire && e.entered && e.y > 20 && e.y < H * 0.68 && player && !player.dead && run.phase !== 'clear') {
            e.fireT -= dt;
            if (e.fireT <= 0) {
                enemyFire(e);
                e.fireT = (e.T.rate / diff.fire) * rand(0.8, 1.25);
            }
        }
    }

    function updateBoss(e, dt) {
        if (e.dying > 0) {
            e.dying -= dt;
            e.x += Math.sin(e.dying * 50) * 1.5;
            if (Math.random() < 0.35) explosion(e.x + rand(-90, 90), e.y + rand(-70, 70), rand(0.8, 1.6), pick([e.T.color, '#ffffff', '#ffb340']));
            shake = Math.max(shake, 6);
            if (e.dying <= 0) {
                e.dead = true;
                explosion(e.x, e.y, 5, e.T.color);
                explosion(e.x, e.y, 3, '#ffffff');
                spawnParticle({ type: 'ring', x: e.x, y: e.y, r0: 10, r1: Math.max(W, H), life: 0.9, color: '#ffffff', width: 6 });
                shake = 30;
                bombFlash = 0.8;
                slowmo = 0.8;
                for (let i = 0; i < 5; i++) dropPowerup(e.x + rand(-60, 60), e.y + rand(-30, 30), i === 0 ? 'P' : null);
            }
            return;
        }
        if (e.phase === 0) {
            e.y = lerp(-140, H * 0.2, easeOut(Math.min(1, e.t / 3)));
            if (e.t >= 3) { e.phase = 1; e.invuln = false; e.at = 0; }
            return;
        }
        e.at += dt;
        const ratio = e.hp / e.maxHp;
        const mode = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
        if (mode !== e.mode) {
            e.mode = mode;
            e.tA = 1.2; e.tB = 1.6; e.tC = 3;
            Sound.bossRoar();
            shake = 14;
            explosion(e.x - 60, e.y, 1.5, e.T.color);
            explosion(e.x + 60, e.y, 1.5, e.T.color);
            toast(mode === 2 ? 'BOSS ENRAGED!' : 'ARMOR BREACHED');
        }
        const sp = [0.45, 0.6, 0.85][mode];
        e.x = W / 2 + Math.sin(e.at * sp) * W * 0.3;
        e.y = H * 0.2 + Math.sin(e.at * sp * 2) * H * 0.04;

        if (!player || player.dead) return;
        const lvl = diff.level, bs = diff.bullet;
        const pods = [[e.x - 80, e.y + 32], [e.x + 80, e.y + 32]];
        const mouth = [e.x, e.y + 60];
        e.tA -= dt; e.tB -= dt; e.tC -= dt;

        if (mode === 0) {
            if (e.tA <= 0) {
                e.tA = 1.5 / diff.fire;
                const n = 5 + Math.min(4, lvl), a0 = aimAngle(mouth[0], mouth[1]);
                for (let i = 0; i < n; i++) fireBullet(mouth[0], mouth[1], a0 + (i - (n - 1) / 2) * 0.17, 200 * bs, e.T.bullet, 7);
                Sound.bossShot();
            }
            if (e.tB <= 0) {
                e.tB = 1.0 / diff.fire;
                for (const p of pods) fireBullet(p[0], p[1], aimAngle(p[0], p[1]), 260 * bs, '#ff3d7f');
                Sound.enemyShot();
            }
        } else if (mode === 1) {
            e.cycle += dt;
            if (e.cycle % 4.4 < 3 && e.tA <= 0) {
                e.tA = 0.085;
                const arms = 3 + Math.min(3, Math.floor(lvl / 2));
                e.spin += 0.21;
                for (let k = 0; k < arms; k++) fireBullet(mouth[0], mouth[1] - 20, e.spin + (k / arms) * TAU, 150 * bs, '#ffa630', 6);
                Sound.bossShot();
            }
            if (e.tB <= 0) {
                e.tB = 2.2 / diff.fire;
                for (const p of pods) {
                    const a0 = aimAngle(p[0], p[1]);
                    for (const off of [-0.2, 0, 0.2]) fireBullet(p[0], p[1], a0 + off, 220 * bs, '#ff3d7f');
                }
            }
        } else {
            if (e.tA <= 0) {
                e.tA = 1.2 / Math.sqrt(diff.fire);
                const n = 20 + Math.min(12, lvl * 2);
                e.spin += 0.35;
                for (let i = 0; i < n; i++) fireBullet(mouth[0], mouth[1] - 20, e.spin + (i / n) * TAU, 150 * bs, e.T.bullet, 7);
                Sound.bossShot();
            }
            if (e.tB <= 0) {
                e.tB = 0.55 / diff.fire;
                const p = pods[Math.floor(e.at * 2) % 2];
                fireBullet(p[0], p[1], aimAngle(p[0], p[1]), 300 * bs, '#ff3d7f');
                Sound.enemyShot();
            }
            if (e.tC <= 0) {
                e.tC = 7;
                const group = { total: 2, killed: 0 };
                for (const x of [0.15, 0.85]) spawnEnemy({ t: 0, type: 'drone', x, y: -0.06, path: 'drop', ty: 0.32, hover: 5 }, group);
            }
        }
    }

    // ===================== player =====================
    const PULSE_PATTERNS = [
        null,
        [[-7, 0], [7, 0]],
        [[-12, 0], [0, 0], [12, 0]],
        [[-12, 0], [0, 0], [12, 0], [-10, -0.14], [10, 0.14]],
        [[-14, 0], [-5, 0], [5, 0], [14, 0], [-10, -0.14], [10, 0.14]],
        [[-14, 0], [-5, 0], [5, 0], [14, 0], [-10, -0.14], [10, 0.14], [-12, -0.3], [12, 0.3]]
    ];

    function firePulse(p) {
        for (const [dx, a] of PULSE_PATTERNS[p.power]) {
            bolts.push({ x: p.x + dx, y: p.y - 28, vx: Math.sin(a) * 950, vy: -Math.cos(a) * 950, dmg: 1, r: 6, rot: a });
        }
        spawnParticle({ type: 'glow', x: p.x, y: p.y - 30, size: 26, life: 0.07, color: '#7ffbff' });
        Sound.pulse();
        if (p.power >= 4 && p.missileCD <= 0) {
            p.missileCD = 0.45;
            for (const s of [-1, 1]) bolts.push({ x: p.x + s * 18, y: p.y, vx: s * 160, vy: -180, dmg: 3, r: 7, homing: true, rot: 0 });
            Sound.missile();
        }
    }

    function beamWidth(p) { return 16 + p.power * 5; }

    function updateBeam(p, dt) {
        const bw = beamWidth(p), dps = 30 + p.power * 8;
        for (const e of enemies) {
            if (e.dead || e.y > p.y || e.y < -e.r) continue;
            if (Math.abs(e.x - p.x) < e.r * 0.8 + bw / 2) {
                hurtEnemy(e, dps * dt, e.x, e.y + e.r * 0.6, true);
                if (Math.random() < 0.4) burstSpark(e.x + rand(-6, 6), e.y + e.r * 0.6, '#ff8adf', 2);
            }
        }
        for (const b of bullets) {
            if (b.y < p.y && Math.abs(b.x - p.x) < bw / 2 + b.r) {
                b.dead = true;
                burstSpark(b.x, b.y, '#ffd0f0', 2);
            }
        }
    }

    function stopBeam(p) {
        if (p.beaming) {
            p.beaming = false;
            Sound.beamOff();
        }
    }

    function switchWeapon(w) {
        if (!player || player.dead) return;
        const next = w === undefined ? 1 - player.weapon : w;
        if (next === player.weapon) return;
        player.weapon = next;
        stopBeam(player);
        Sound.weaponSwitch();
        toast(next === 0 ? 'PULSE LASER' : 'PLASMA BEAM');
    }

    function useBomb() {
        const p = player;
        if (!p || p.dead || p.bombs <= 0 || state !== 'playing') return;
        p.bombs--;
        p.inv = Math.max(p.inv, 1.6);
        bombFlash = 1;
        shake = 22;
        Sound.bomb();
        spawnParticle({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: Math.hypot(W, H), life: 0.8, color: '#ffb36b', width: 14 });
        spawnParticle({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: Math.hypot(W, H) * 0.7, life: 0.6, color: '#ffffff', width: 6 });
        for (const b of bullets) {
            burstSpark(b.x, b.y, '#ffe9a8', 2);
            score += 10;
        }
        bullets.length = 0;
        for (const e of enemies) if (!e.dead && e.entered) hurtEnemy(e, e.isBoss ? 40 : 25, e.x, e.y);
    }

    function updatePlayer(dt) {
        const p = player;
        if (p.dead) {
            p.respawn -= dt;
            if (p.respawn <= 0) {
                if (p.lives > 0) respawnPlayer();
                else gameOver();
            }
            return;
        }
        p.inv -= dt;
        p.fireCD -= dt;
        p.missileCD -= dt;
        if (p.overheat > 0) p.overheat -= dt;

        let ix = 0, iy = 0;
        if (keys.has('ArrowLeft') || keys.has('KeyA')) ix -= 1;
        if (keys.has('ArrowRight') || keys.has('KeyD')) ix += 1;
        if (keys.has('ArrowUp') || keys.has('KeyW')) iy -= 1;
        if (keys.has('ArrowDown') || keys.has('KeyS')) iy += 1;
        const focus = keys.has('ShiftLeft') || keys.has('ShiftRight');
        p.focus = focus;

        const pointer = touch.active ? touch : mouse.active ? mouse : null;
        if (pointer && !ix && !iy) {
            const dx = pointer.x - p.x, dy = pointer.y - p.y;
            const d = Math.hypot(dx, dy), step = (focus ? 400 : 1100) * dt;
            const k = d > step ? step / d : 1;
            p.vx = (dx * k) / dt;
            p.x += dx * k;
            p.y += dy * k;
        } else {
            const len = Math.hypot(ix, iy) || 1, speed = focus ? 180 : 390;
            p.vx = lerp(p.vx, (ix / len) * speed, Math.min(1, dt * 16));
            p.vy = lerp(p.vy, (iy / len) * speed, Math.min(1, dt * 16));
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
        p.x = clamp(p.x, 22, W - 22);
        p.y = clamp(p.y, 50, H - 34);
        p.bank = lerp(p.bank, clamp(p.vx / 420, -1, 1), Math.min(1, dt * 10));

        const firing = keys.has('Space') || keys.has('KeyJ') || keys.has('KeyK') || mouse.down || touch.active;
        if (p.weapon === 0) {
            stopBeam(p);
            if (firing && p.fireCD <= 0) { firePulse(p); p.fireCD = 0.085; }
        } else if (firing && p.overheat <= 0 && p.energy > 0) {
            if (!p.beaming) { p.beaming = true; Sound.beamOn(); }
            p.energy -= 26 * dt;
            p.energyDelay = 0.5;
            if (p.energy <= 0) {
                p.energy = 0;
                p.overheat = 1.8;
                stopBeam(p);
                Sound.overheat();
                floatText(p.x, p.y - 50, 'OVERHEAT', '#ff5a5a', 16);
            } else {
                updateBeam(p, dt);
            }
        } else {
            stopBeam(p);
        }
        if (!p.beaming) {
            p.energyDelay -= dt;
            if (p.energyDelay <= 0) p.energy = Math.min(100, p.energy + 22 * dt);
        }

        // engine exhaust
        if (Math.random() < 0.9) {
            spawnParticle({ type: 'spark', x: p.x + rand(-4, 4), y: p.y + 30, vx: rand(-20, 20), vy: rand(160, 260), life: rand(0.15, 0.3), size: rand(1.5, 3), color: pick(['#ff7a2e', '#ffd36b', '#ff4815']) });
        }
    }

    function respawnPlayer() {
        const p = player;
        p.dead = false;
        p.hp = 100;
        p.x = W / 2;
        p.y = H - 90;
        p.vx = p.vy = 0;
        p.inv = 2.6;
        p.energy = 100;
        p.overheat = 0;
        p.power = Math.max(1, p.power - 1);
        p.bombs = Math.max(p.bombs, 2);
        floatText(p.x, p.y - 60, 'READY!', '#7ffbff', 20);
    }

    function damagePlayer(amount) {
        const p = player;
        if (!p || p.dead || p.inv > 0) return;
        run.noDamage = false;
        combo = 0;
        if (p.shield > 0) {
            p.shield--;
            p.inv = 1;
            Sound.shieldHit();
            spawnParticle({ type: 'ring', x: p.x, y: p.y, r0: 30, r1: 90, life: 0.4, color: '#3fa9ff', width: 4 });
            return;
        }
        p.hp -= amount;
        p.inv = 1.3;
        shake = Math.max(shake, 12);
        damageFlash = 1;
        Sound.playerHit();
        burstSpark(p.x, p.y, '#7ffbff', 14);
        if (p.hp <= 0) {
            p.hp = 0;
            p.dead = true;
            p.lives--;
            p.respawn = 2.2;
            stopBeam(p);
            explosion(p.x, p.y, 3, '#7ffbff');
            spawnParticle({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: 260, life: 0.7, color: '#7ffbff', width: 5 });
            Sound.playerDie();
            shake = 26;
            slowmo = 0.6;
            // clear nearby bullets so the respawn is fair
            for (const b of bullets) b.dead = true;
        }
    }

    // ===================== damage / scoring =====================
    function addScore(points, useMult = true) {
        score += Math.round(points * (useMult ? multiplier() : 1));
    }

    function hurtEnemy(e, dmg, x, y, continuous) {
        if (e.dead || e.invuln || e.dying > 0) return;
        e.hp -= dmg;
        if (!continuous || e.flash <= -0.05) e.flash = 0.05;
        if (!continuous) {
            burstSpark(x, y, '#bffcff', 3);
            Sound.hit();
        }
        if (e.hp <= 0) killEnemy(e);
    }

    function killEnemy(e) {
        if (e.isBoss) {
            e.dying = 2.2;
            e.hp = 0;
            for (const b of bullets) burstSpark(b.x, b.y, '#fff', 1);
            bullets.length = 0;
            addScore(e.T.score);
            floatText(e.x, e.y, '+' + fmt(e.T.score * multiplier()), '#ffe14d', 28);
            Sound.explode(3);
            return;
        }
        e.dead = true;
        combo++;
        comboT = 2.6;
        maxCombo = Math.max(maxCombo, combo);
        const pts = Math.round(e.T.score * multiplier());
        addScore(e.T.score);
        explosion(e.x, e.y, e.T.boom, e.T.color);
        floatText(e.x, e.y - 10, String(pts), e.T.boom > 1.5 ? '#ffe14d' : '#ffffff', e.T.boom > 1.5 ? 18 : 13);
        if (Math.random() < e.T.drop) dropPowerup(e.x, e.y);

        const g = e.group;
        if (g) {
            g.killed++;
            if (g.killed === g.total && g.total >= 4) {
                const bonus = 500 * g.total;
                addScore(bonus, false);
                floatText(e.x, e.y - 34, `FORMATION BONUS +${fmt(bonus)}`, '#7dff6b', 15);
                dropPowerup(e.x, e.y, Math.random() < 0.6 ? 'P' : null);
            }
        }
    }

    function dropPowerup(x, y, kind) {
        if (!kind) {
            kind = weighted(DROP_TABLE);
            if (kind === 'P' && player && player.power >= 5) kind = pick(['S', 'E', 'H']);
        }
        powerups.push({ x, y, kind, vy: -60, t: 0, magnet: false });
    }

    function collectPowerup(pu) {
        const p = player, k = POWER_KINDS[pu.kind];
        switch (pu.kind) {
            case 'P':
                if (p.power < 5) p.power++;
                else addScore(2000, false);
                break;
            case 'S': p.shield = Math.min(3, p.shield + 1); break;
            case 'E': p.energy = 100; p.overheat = 0; break;
            case 'H': p.hp = Math.min(100, p.hp + 40); break;
            case 'B': p.bombs = Math.min(5, p.bombs + 1); break;
            case 'L': p.lives = Math.min(6, p.lives + 1); break;
        }
        addScore(250, false);
        floatText(p.x, p.y - 46, pu.kind === 'P' ? (p.power >= 5 ? 'MAX POWER' : `POWER LV ${p.power}`) : k.name, k.color, 15);
        spawnParticle({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: 60, life: 0.35, color: k.color, width: 3 });
        if (pu.kind === 'L') Sound.oneUp(); else Sound.powerup();
    }

    // ===================== particles =====================
    function spawnParticle(o) {
        if (particles.length > 1600) return;
        o.t = 0;
        o.maxLife = o.life;
        particles.push(o);
    }

    function burstSpark(x, y, color, n) {
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU), s = rand(60, 220);
            spawnParticle({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.35), size: rand(1, 2.2), color });
        }
    }

    function explosion(x, y, scale, color) {
        const n = Math.round(14 * scale);
        spawnParticle({ type: 'glow', x, y, size: 50 * scale, life: 0.2, color: '#ffffff' });
        spawnParticle({ type: 'glow', x, y, size: 90 * scale, life: 0.45, color });
        spawnParticle({ type: 'ring', x, y, r0: 6, r1: 55 * scale, life: 0.4, color, width: 3 });
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU), s = rand(80, 360) * Math.sqrt(scale);
            spawnParticle({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.75), size: rand(1.5, 3), color: pick([color, '#ffffff', '#ffcf6b']), drag: 2.5 });
        }
        for (let i = 0; i < n / 3; i++) {
            const a = rand(0, TAU), s = rand(40, 160);
            spawnParticle({ type: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1), size: rand(2, 4.5), color, spin: rand(-10, 10), rot: 0, drag: 1 });
        }
        for (let i = 0; i < 3 * scale; i++) {
            spawnParticle({ type: 'smoke', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-20, 30), life: rand(0.6, 1.1), size: rand(10, 20) * scale, color: 'rgba(40,30,50,' });
        }
        shake = Math.max(shake, 2.5 * scale);
        Sound.explode(scale);
    }

    function floatText(x, y, text, color, size) {
        texts.push({ x, y, text, color, size: size || 14, t: 0, life: 1.1 });
    }

    function updateParticles(dt) {
        for (const p of particles) {
            p.t += dt;
            if (p.vx !== undefined) {
                if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
            if (p.spin) p.rot += p.spin * dt;
        }
        compact(particles, p => p.t < p.maxLife);
        for (const t of texts) { t.t += dt; t.y -= 34 * dt; }
        compact(texts, t => t.t < t.life);
    }

    // ===================== world update =====================
    function updateWorld(dt) {
        const p = player;
        for (const e of enemies) if (!e.dead) updateEnemy(e, dt);

        // player bolts
        for (const b of bolts) {
            if (b.homing) {
                let best = null, bd = 1e9;
                for (const e of enemies) {
                    if (e.dead || !e.entered || e.dying > 0) continue;
                    const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
                    if (d < bd) { bd = d; best = e; }
                }
                const sp = Math.min(750, Math.hypot(b.vx, b.vy) + 900 * dt);
                let ang = Math.atan2(b.vy, b.vx);
                if (best) {
                    let diffA = Math.atan2(best.y - b.y, best.x - b.x) - ang;
                    diffA = Math.atan2(Math.sin(diffA), Math.cos(diffA));
                    ang += clamp(diffA, -6 * dt, 6 * dt);
                }
                b.vx = Math.cos(ang) * sp;
                b.vy = Math.sin(ang) * sp;
                b.rot = ang + Math.PI / 2;
                if (Math.random() < 0.7) spawnParticle({ type: 'spark', x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1, life: 0.2, size: 1.5, color: '#ffd84d' });
            }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y < -30 || b.x < -30 || b.x > W + 30 || b.y > H + 30) { b.dead = true; continue; }
            for (const e of enemies) {
                if (e.dead || e.dying > 0) continue;
                const rr = e.r + b.r;
                if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
                    if (!e.invuln) hurtEnemy(e, b.dmg, b.x, b.y);
                    b.dead = true;
                    break;
                }
            }
        }
        compact(bolts, b => !b.dead);

        // enemy bullets
        for (const b of bullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y > H + 30 || b.y < -40 || b.x < -30 || b.x > W + 30) { b.dead = true; continue; }
            if (p && !p.dead) {
                const d2 = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
                const hit = b.r + 5;
                if (d2 < hit * hit && p.inv <= 0) {
                    b.dead = true;
                    damagePlayer(b.dmg);
                } else if (!b.grazed && d2 < 26 * 26) {
                    b.grazed = true;
                    score += 20;
                    burstSpark(b.x, b.y, '#ffffff', 2);
                    Sound.graze();
                }
            }
        }
        compact(bullets, b => !b.dead);

        // body collisions
        if (p && !p.dead) {
            for (const e of enemies) {
                if (e.dead || e.dying > 0 || e.phase === 0 && e.isBoss) continue;
                const rr = e.r * 0.8 + 12;
                if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) {
                    if (p.inv <= 0) damagePlayer(e.isBoss ? 40 : 30);
                    if (!e.isBoss) hurtEnemy(e, e.T.hp > 10 ? 6 : 99, e.x, e.y);
                }
            }
        }
        compact(enemies, e => !e.dead);

        // powerups
        for (const pu of powerups) {
            pu.t += dt;
            if (p && !p.dead) {
                const dx = p.x - pu.x, dy = p.y - pu.y, d = Math.hypot(dx, dy);
                if (d < 130 || pu.magnet) {
                    const s = 520 * dt;
                    pu.x += (dx / d) * s;
                    pu.y += (dy / d) * s;
                }
                if (d < 30) { pu.dead = true; collectPowerup(pu); continue; }
            }
            pu.vy = Math.min(pu.vy + 120 * dt, 85);
            pu.y += pu.vy * dt;
            pu.x += Math.sin(pu.t * 3) * 20 * dt;
            if (pu.y > H + 30) pu.dead = true;
        }
        compact(powerups, pu => !pu.dead);
    }

    function update(dt) {
        time += dt;
        if (comboT > 0) {
            comboT -= dt;
            if (comboT <= 0) combo = 0;
        }
        updatePlayer(dt);
        if (state !== 'playing') return; // gameOver() may fire from updatePlayer
        updateStage(dt);
        updateWorld(dt);
        if (score > hiScore && !run.hiShown) { run.hiShown = true; toast('NEW HIGH SCORE!'); }
    }

    // ===================== render =====================
    function drawPlayer() {
        const p = player;
        if (!p || p.dead) return;
        if (p.inv > 0 && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.35;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1 - Math.abs(p.bank) * 0.18, 1);
        ctx.rotate(p.bank * 0.12);

        // animated engine flame (original SVG flame path)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fl = 0.85 + Math.random() * 0.3 + (p.vy < -50 ? 0.25 : 0);
        ctx.scale(HERO_K, HERO_K * fl);
        ctx.translate(-HERO_CX, -HERO_CY);
        const fg = ctx.createLinearGradient(0, 240, 0, 360);
        fg.addColorStop(0, '#fff2c0');
        fg.addColorStop(0.4, '#ff8a2e');
        fg.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = fg;
        ctx.fill(HERO.flame);
        ctx.restore();

        ctx.drawImage(SPR.hero.img, -SPR.hero.w / 2, -SPR.hero.h / 2, SPR.hero.w, SPR.hero.h);
        ctx.restore();
        ctx.globalAlpha = 1;

        if (p.shield > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const r = 40 + Math.sin(time * 6) * 1.5;
            const g = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r);
            g.addColorStop(0, 'rgba(63,169,255,0)');
            g.addColorStop(1, `rgba(63,169,255,${0.25 + p.shield * 0.12})`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
            ctx.strokeStyle = 'rgba(150,210,255,0.7)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < p.shield; i++) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, time * 2 + (i * TAU) / 3, time * 2 + (i * TAU) / 3 + 1.2);
                ctx.stroke();
            }
            ctx.restore();
        }
        if (p.focus) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#ff3d6e';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill(); ctx.stroke();
        }
    }

    function drawBeam() {
        const p = player;
        if (!p || !p.beaming || p.dead) return;
        const bw = beamWidth(p) * (0.9 + Math.random() * 0.2);
        const top = 0, bottom = p.y - 26;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const outer = ctx.createLinearGradient(p.x - bw, 0, p.x + bw, 0);
        outer.addColorStop(0, 'rgba(255,40,180,0)');
        outer.addColorStop(0.5, 'rgba(255,60,200,0.55)');
        outer.addColorStop(1, 'rgba(255,40,180,0)');
        ctx.fillStyle = outer;
        ctx.fillRect(p.x - bw, top, bw * 2, bottom - top);
        const inner = ctx.createLinearGradient(p.x - bw / 2, 0, p.x + bw / 2, 0);
        inner.addColorStop(0, 'rgba(255,120,230,0)');
        inner.addColorStop(0.5, 'rgba(255,230,250,1)');
        inner.addColorStop(1, 'rgba(255,120,230,0)');
        ctx.fillStyle = inner;
        ctx.fillRect(p.x - bw / 2, top, bw, bottom - top);
        // energy rings travelling up the beam
        ctx.strokeStyle = 'rgba(255,200,245,0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            const y = bottom - ((time * 900 + i * 140) % bottom);
            ctx.beginPath();
            ctx.ellipse(p.x, y, bw * 0.7, 4, 0, 0, TAU);
            ctx.stroke();
        }
        drawSprite(getGlow('#ff5ad2'), p.x, bottom, 0, 1, 1.2 + Math.random() * 0.3);
        ctx.restore();
    }

    function drawEnemies() {
        for (const e of enemies) {
            if (e.isBoss) {
                drawSprite(e.art.s, e.x, e.y);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                if (e.flash > 0) drawSprite(e.art.w, e.x, e.y, 0, 0.25);
                const pulse = 0.6 + Math.sin(time * 8) * 0.3 + (e.mode === 2 ? 0.4 : 0);
                const eye = getGlow('#ff2020');
                drawSprite(eye, e.x - 28, e.y + 32, 0, Math.min(1, pulse), 0.8);
                drawSprite(eye, e.x + 28, e.y + 32, 0, Math.min(1, pulse), 0.8);
                ctx.restore();
                continue;
            }
            drawSprite(SPR[e.kind], e.x, e.y, e.rot);
            if (e.flash > 0) drawSprite(SPR[e.kind + 'W'], e.x, e.y, e.rot, 0.6);
            if (e.maxHp >= 10 && e.hp < e.maxHp) {
                const w = e.r * 2;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
                ctx.fillStyle = e.T.color;
                ctx.fillRect(e.x - w / 2, e.y - e.r - 10, (w * e.hp) / e.maxHp, 4);
            }
            if (e.spec.path === 'dive' && e.phase === 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                drawSprite(getGlow('#ffd84d'), e.x, e.y, 0, 0.5 + Math.sin(time * 30) * 0.5, 0.8);
                ctx.restore();
            }
        }
    }

    function drawParticles() {
        for (const p of particles) {
            if (p.type !== 'smoke') continue;
            const k = p.t / p.maxLife;
            ctx.fillStyle = p.color + (0.35 * (1 - k)) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, TAU);
            ctx.fill();
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of particles) {
            const k = p.t / p.maxLife, a = 1 - k;
            switch (p.type) {
                case 'spark':
                    ctx.strokeStyle = p.color;
                    ctx.globalAlpha = a;
                    ctx.lineWidth = p.size;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
                    ctx.stroke();
                    break;
                case 'glow':
                    drawSprite(getGlow(p.color), p.x, p.y, 0, a, (p.size / 64) * (0.6 + k * 0.6));
                    break;
                case 'ring':
                    ctx.strokeStyle = p.color;
                    ctx.globalAlpha = a;
                    ctx.lineWidth = p.width * a + 0.5;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, lerp(p.r0, p.r1, easeOut(k)), 0, TAU);
                    ctx.stroke();
                    break;
                case 'debris':
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = a;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    ctx.restore();
                    break;
            }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawBolts() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of bolts) drawSprite(b.homing ? SPR.missile : SPR.bolt, b.x, b.y, b.rot);
        ctx.restore();
    }

    function drawBullets() {
        for (const b of bullets) drawSprite(getOrb(b.color, b.r), b.x, b.y);
    }

    function drawPowerups() {
        for (const pu of powerups) {
            const s = 1 + Math.sin(pu.t * 6) * 0.08;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            drawSprite(getGlow(POWER_KINDS[pu.kind].color), pu.x, pu.y, 0, 0.5, 1.1);
            ctx.restore();
            drawSprite(getPowerSprite(pu.kind), pu.x, pu.y, Math.sin(pu.t * 2) * 0.3, 1, s);
        }
    }

    function drawTexts() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const t of texts) {
            const k = t.t / t.life;
            ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            const pop = k < 0.12 ? 1 + (0.12 - k) * 4 : 1;
            ctx.font = `700 ${Math.round(t.size * pop)}px ${FONT}`;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    }

    function bar(x, y, w, h, frac, color, bg) {
        ctx.fillStyle = bg || 'rgba(255,255,255,0.12)';
        roundRect(ctx, x, y, w, h, h / 2);
        ctx.fill();
        if (frac > 0) {
            ctx.fillStyle = color;
            roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
            ctx.fill();
        }
    }

    function label(text, x, y, size, color, align, weight) {
        ctx.font = `${weight || 700} ${size}px ${FONT}`;
        ctx.fillStyle = color;
        ctx.textAlign = align || 'left';
        ctx.fillText(text, x, y);
    }

    function drawHUD() {
        const p = player;
        ctx.textBaseline = 'top';
        const small = W < 640;

        // score
        label('SCORE', 20, 14, 10, 'rgba(160,230,255,0.7)');
        label(fmt(score), 20, 27, small ? 20 : 26, '#ffffff', 'left', 900);
        label('HI ' + fmt(Math.max(hiScore, score)), 20, small ? 52 : 58, 11, 'rgba(255,225,77,0.85)');

        // stage
        const st = currentStage();
        label(`STAGE ${run.stage + 1}${run.loop ? ' · LOOP ' + (run.loop + 1) : ''}`, W / 2, 14, 11, st.color, 'center');
        if (!small) label(st.name, W / 2, 30, 10, 'rgba(255,255,255,0.55)', 'center', 500);

        // boss bar
        const boss = run.boss;
        if (boss && !boss.dead && boss.phase === 1) {
            const bw = Math.min(520, W - 220), bx = (W - bw) / 2, by = 48;
            label(boss.name, W / 2, by, 11, '#ff6b6b', 'center', 900);
            bar(bx, by + 17, bw, 9, boss.hp / boss.maxHp, boss.mode === 2 ? (Math.floor(time * 8) % 2 ? '#ff3030' : '#ffb340') : '#ff4d6d');
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(bx + bw * 0.33, by + 17, 2, 9);
            ctx.fillRect(bx + bw * 0.66, by + 17, 2, 9);
        }

        // lives & bombs (top right)
        for (let i = 0; i < p.lives; i++) drawSprite(SPR.life, W - 24 - i * 22, 24);
        for (let i = 0; i < p.bombs; i++) {
            const x = W - 24 - i * 22, y = 50;
            ctx.fillStyle = '#ff9a2e';
            ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
            label('B', x, y - 5, 9, '#2a1300', 'center', 900);
        }

        // combo
        if (combo >= 3) {
            const m = multiplier();
            label(`x${m.toFixed(1)}`, W - 20, 68, small ? 20 : 26, m >= 3 ? '#ff5ad2' : '#ffe14d', 'right', 900);
            label(`${combo} COMBO`, W - 20, small ? 92 : 98, 10, 'rgba(255,255,255,0.75)', 'right');
            bar(W - 100, small ? 106 : 112, 80, 3, comboT / 2.6, '#ffe14d');
        }

        // hull / shield / power (bottom left)
        const by = H - 52;
        label('HULL', 20, by, 10, 'rgba(160,230,255,0.75)');
        const hpColor = p.hp > 50 ? '#3dff8b' : p.hp > 25 ? '#ffd84d' : (Math.floor(time * 6) % 2 ? '#ff3030' : '#ff8080');
        bar(64, by + 1, small ? 100 : 160, 9, p.hp / 100, hpColor);
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i < p.shield ? '#3fa9ff' : 'rgba(255,255,255,0.12)';
            ctx.beginPath(); ctx.arc((small ? 176 : 236) + i * 15, by + 5.5, 5, 0, TAU); ctx.fill();
        }
        label('PWR', 20, by + 20, 10, 'rgba(160,230,255,0.75)');
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = i < p.power ? (p.power === 5 ? '#ff5ad2' : '#ff3d6e') : 'rgba(255,255,255,0.12)';
            ctx.fillRect(64 + i * 19, by + 20, 15, 9);
        }

        // weapon panel (bottom right)
        const cw = small ? 92 : 118, ch = 38, wx = W - cw * 2 - 28, wy = H - 54;
        [['1', 'PULSE', '#7ffbff'], ['2', 'BEAM', '#ff5ad2']].forEach(([key, name, col], i) => {
            const x = wx + i * (cw + 8), active = p.weapon === i;
            ctx.fillStyle = active ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.35)';
            roundRect(ctx, x, wy, cw, ch, 6);
            ctx.fill();
            ctx.strokeStyle = active ? col : 'rgba(255,255,255,0.15)';
            ctx.lineWidth = active ? 2 : 1;
            ctx.stroke();
            label(key, x + 8, wy + 6, 10, active ? col : 'rgba(255,255,255,0.4)', 'left', 900);
            const oh = i === 1 && p.overheat > 0;
            label(oh ? 'OVERHEAT' : name, x + 22, wy + 6, small ? 10 : 12, oh ? '#ff6060' : active ? '#ffffff' : 'rgba(255,255,255,0.45)', 'left', 700);
            if (i === 0) {
                label('LV ' + p.power, x + 8, wy + 22, 10, 'rgba(255,255,255,0.6)', 'left', 500);
            } else {
                bar(x + 8, wy + 25, cw - 16, 6, p.energy / 100, oh ? (Math.floor(time * 10) % 2 ? '#ff3030' : '#661111') : '#ff5ad2');
            }
        });
        label('Q / TAB  SWITCH', wx + cw + 4, wy - 14, 9, 'rgba(255,255,255,0.35)', 'center', 500);
    }

    function drawBanners() {
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const st = currentStage();
        const t = run.phaseT;
        if (run.phase === 'intro') {
            const a = t < 0.4 ? t / 0.4 : t > 2.3 ? Math.max(0, 1 - (t - 2.3) / 0.5) : 1;
            const slide = (1 - easeOut(Math.min(1, t / 0.5))) * 60;
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, H / 2 - 70, W, 140);
            ctx.save();
            ctx.shadowColor = st.color;
            ctx.shadowBlur = 24;
            label(`STAGE ${run.stage + 1}`, W / 2 - slide, H / 2 - 22, Math.min(64, W / 9), '#ffffff', 'center', 900);
            ctx.restore();
            label(st.name, W / 2 + slide, H / 2 + 28, Math.min(22, W / 22), st.color, 'center', 700);
            ctx.fillStyle = st.color;
            const lw = Math.min(260, W * 0.3) * easeOut(Math.min(1, t / 0.8));
            ctx.fillRect(W / 2 - lw, H / 2 + 50, lw * 2, 2);
            ctx.globalAlpha = 1;
        } else if (run.phase === 'warning') {
            const blink = Math.floor(t * 4) % 2 === 0;
            ctx.fillStyle = `rgba(255,0,40,${0.08 + Math.sin(t * 12) * 0.05})`;
            ctx.fillRect(0, 0, W, H);
            for (const y of [H / 2 - 80, H / 2 + 64]) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, y, W, 16);
                ctx.clip();
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(0, y, W, 16);
                ctx.fillStyle = '#111';
                const off = (t * 120) % 40;
                for (let x = -40; x < W + 40; x += 40) {
                    ctx.beginPath();
                    ctx.moveTo(x + off, y); ctx.lineTo(x + off + 20, y); ctx.lineTo(x + off + 4, y + 16); ctx.lineTo(x + off - 16, y + 16);
                    ctx.fill();
                }
                ctx.restore();
            }
            if (blink) {
                ctx.save();
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 30;
                label('WARNING', W / 2, H / 2 - 18, Math.min(72, W / 8), '#ff3b3b', 'center', 900);
                ctx.restore();
            }
            label(`${st.boss} APPROACHING`, W / 2, H / 2 + 34, Math.min(18, W / 26), '#ffffff', 'center', 700);
        } else if (run.phase === 'clear' && run.bonus) {
            const a = Math.min(1, t / 0.4) * (t > 4.4 ? Math.max(0, 1 - (t - 4.4) / 0.5) : 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, H / 2 - 110, W, 220);
            ctx.save();
            ctx.shadowColor = st.color;
            ctx.shadowBlur = 24;
            label('SECTOR CLEARED', W / 2, H / 2 - 66, Math.min(48, W / 12), '#ffffff', 'center', 900);
            ctx.restore();
            const rows = [
                ['STAGE BONUS', '+' + fmt(run.bonus.stage), '#ffe14d'],
                ['NO DAMAGE', run.bonus.perfect ? '+' + fmt(run.bonus.perfect) : '—', run.bonus.perfect ? '#3dff8b' : 'rgba(255,255,255,0.4)'],
                ['MAX COMBO', String(run.bonus.combo), '#ff5ad2']
            ];
            rows.forEach((r, i) => {
                if (t < 0.6 + i * 0.4) return;
                const y = H / 2 - 10 + i * 30;
                label(r[0], W / 2 - 20, y, 15, 'rgba(255,255,255,0.75)', 'right', 700);
                label(r[1], W / 2 + 20, y, 17, r[2], 'left', 900);
            });
            ctx.globalAlpha = 1;
        }

        if (toastT > 0) {
            ctx.globalAlpha = Math.min(1, toastT * 3);
            label(toastMsg, W / 2, H * 0.36, 16, '#ffffff', 'center', 900);
            ctx.globalAlpha = 1;
        }
    }

    function drawTitleShip() {
        const x = W / 2, y = H * 0.82 + Math.sin(time * 2) * 6;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawSprite(getGlow('#ff7a2e'), x, y + 34, 0, 0.8, 0.8 + Math.random() * 0.2);
        ctx.restore();
        drawSprite(SPR.hero, x, y);
    }

    function render() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        drawBackground();

        ctx.save();
        if (shake > 0.3) ctx.translate(rand(-shake, shake), rand(-shake, shake));
        drawPowerups();
        drawEnemies();
        drawBolts();
        drawBeam();
        if (state === 'title') drawTitleShip();
        else drawPlayer();
        drawParticles();
        drawBullets();
        drawTexts();
        ctx.restore();

        if (vignette) ctx.drawImage(vignette, 0, 0, W, H);
        if (damageFlash > 0) {
            ctx.fillStyle = `rgba(255,0,30,${damageFlash * 0.3})`;
            ctx.fillRect(0, 0, W, H);
        }
        if (bombFlash > 0) {
            ctx.fillStyle = `rgba(255,245,230,${bombFlash * 0.7})`;
            ctx.fillRect(0, 0, W, H);
        }
        if (state !== 'title' && player) {
            drawHUD();
            drawBanners();
        } else if (toastT > 0) {
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = Math.min(1, toastT * 3);
            label(toastMsg, W / 2, H - 40, 14, '#ffffff', 'center', 900);
            ctx.globalAlpha = 1;
        }
    }

    // ===================== main loop =====================
    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        buildBackground();
        initStars();
        if (player) {
            player.x = clamp(player.x, 22, W - 22);
            player.y = clamp(player.y, 50, H - 34);
        }
    }

    let last = performance.now();
    function frame(now) {
        const raw = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (slowmo > 0) { slowmo -= raw; timeScale = 0.3; } else timeScale = 1;
        const dt = raw * timeScale;

        if (state === 'playing') update(dt);
        else if (state === 'gameover') { time += dt; updateWorld(dt); }
        else if (state === 'title') time += dt;
        if (state !== 'paused') {
            updateBackground(raw);
            updateParticles(dt);
            shake = Math.max(0, shake - raw * 40);
            damageFlash = Math.max(0, damageFlash - raw * 2.5);
            bombFlash = Math.max(0, bombFlash - raw * 1.6);
        }
        if (toastT > 0) toastT -= raw;
        render();
        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    buildSprites();
    computeDifficulty();
    $('titleHi').textContent = fmt(hiScore);
    // first user gesture unlocks audio; start title music then
    const unlock = () => {
        Sound.init();
        if (state === 'title') Sound.setMusic(0, 0);
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const k in powerCache) delete powerCache[k]; });
    requestAnimationFrame(frame);
})();
