/* Sound engine: synthesized SFX + procedural music (Web Audio API) */
const Sound = (() => {
    'use strict';

    let ctx = null, master, sfxBus, musicBus, noiseBuf;
    let muted = false, musicEnabled = true;
    const lastPlayed = {};
    const logo = new Audio('audio/epic-hybrid-logo-157092.mp3');
    logo.volume = 0.45;

    try {
        muted = localStorage.getItem('nova.muted') === '1';
        musicEnabled = localStorage.getItem('nova.music') !== '0';
    } catch (e) { /* storage unavailable */ }

    const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

    function init() {
        if (ctx) {
            if (ctx.state === 'suspended') ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();

        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 4;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        musicBus = ctx.createGain();
        musicBus.gain.value = musicEnabled ? 0.3 : 0;
        sfxBus.connect(master);
        musicBus.connect(master);
        master.connect(comp);
        comp.connect(ctx.destination);

        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }

    function throttle(key, ms) {
        const now = performance.now();
        if (lastPlayed[key] && now - lastPlayed[key] < ms) return false;
        lastPlayed[key] = now;
        return true;
    }

    function envelope(g, t, vol, attack, dur) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    function withFilter(src, o, t, dur) {
        if (!o) return src;
        const f = ctx.createBiquadFilter();
        f.type = o.type || 'lowpass';
        f.frequency.setValueAtTime(o.f0, t);
        if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
        f.Q.value = o.q || 1;
        src.connect(f);
        return f;
    }

    function tone(o) {
        if (!ctx || muted) return;
        const t = o.at || ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = o.type || 'square';
        osc.frequency.setValueAtTime(o.f0, t);
        if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
        if (o.detune) osc.detune.value = o.detune;
        envelope(g, t, o.vol || 0.2, o.attack || 0.005, o.dur);
        withFilter(osc, o.filter, t, o.dur).connect(g);
        g.connect(o.bus || sfxBus);
        osc.start(t);
        osc.stop(t + o.dur + 0.05);
    }

    function noise(o) {
        if (!ctx || muted) return;
        const t = o.at || ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        const g = ctx.createGain();
        envelope(g, t, o.vol || 0.2, o.attack || 0.005, o.dur);
        withFilter(src, o.filter, t, o.dur).connect(g);
        g.connect(o.bus || sfxBus);
        src.start(t, Math.random() * 0.5);
        src.stop(t + o.dur + 0.05);
    }

    function arpeggio(notes, gap, type, vol) {
        if (!ctx) return;
        const t = ctx.currentTime;
        notes.forEach((n, i) => {
            tone({ type: type || 'triangle', f0: mtof(n), dur: 0.18, vol: vol || 0.12, at: t + i * gap });
            tone({ type: 'square', f0: mtof(n + 12), dur: 0.1, vol: (vol || 0.12) * 0.25, at: t + i * gap, filter: { f0: 3000 } });
        });
    }

    function sample(src, vol) {
        if (muted) return;
        const a = new Audio(src);
        a.volume = vol;
        a.play().catch(() => {});
    }

    // ---------- SFX ----------
    const sfx = {
        pulse() {
            if (!throttle('pulse', 45)) return;
            tone({ type: 'square', f0: 1700, f1: 380, dur: 0.07, vol: 0.05, filter: { f0: 3200 } });
            tone({ type: 'sine', f0: 900, f1: 220, dur: 0.06, vol: 0.05 });
        },
        missile() {
            if (!throttle('missile', 120)) return;
            noise({ dur: 0.22, vol: 0.05, filter: { type: 'bandpass', f0: 700, f1: 2400, q: 3 } });
        },
        enemyShot() {
            if (!throttle('eshot', 70)) return;
            tone({ type: 'triangle', f0: 760, f1: 330, dur: 0.1, vol: 0.05 });
        },
        bossShot() {
            if (!throttle('bshot', 110)) return;
            tone({ type: 'sawtooth', f0: 320, f1: 140, dur: 0.14, vol: 0.05, filter: { f0: 1600 } });
        },
        hit() {
            if (!throttle('hit', 40)) return;
            noise({ dur: 0.04, vol: 0.06, filter: { type: 'highpass', f0: 2800 } });
            tone({ type: 'square', f0: 320, f1: 160, dur: 0.035, vol: 0.025 });
        },
        graze() {
            if (!throttle('graze', 80)) return;
            tone({ type: 'sine', f0: 2400, f1: 3000, dur: 0.04, vol: 0.025 });
        },
        explode(size) {
            if (!throttle('boom' + Math.round(size), 35)) return;
            size = size || 1;
            noise({ dur: 0.3 + 0.22 * size, vol: Math.min(0.5, 0.18 + 0.1 * size), filter: { f0: 2600 + 800 * size, f1: 90 } });
            tone({ type: 'sine', f0: 150, f1: 32, dur: 0.22 + 0.15 * size, vol: Math.min(0.6, 0.25 + 0.12 * size) });
        },
        dive() {
            if (!throttle('dive', 150)) return;
            tone({ type: 'sawtooth', f0: 1100, f1: 180, dur: 0.45, vol: 0.035, filter: { f0: 2000 } });
        },
        playerHit() {
            tone({ type: 'square', f0: 260, f1: 55, dur: 0.32, vol: 0.16, filter: { f0: 1800 } });
            noise({ dur: 0.3, vol: 0.22, filter: { f0: 1400, f1: 200 } });
        },
        shieldHit() {
            tone({ type: 'sine', f0: 1300, f1: 500, dur: 0.2, vol: 0.12 });
            tone({ type: 'triangle', f0: 650, f1: 250, dur: 0.2, vol: 0.08 });
        },
        playerDie() {
            sfx.explode(3);
            tone({ type: 'sawtooth', f0: 820, f1: 40, dur: 1.2, vol: 0.12, filter: { f0: 2400, f1: 200 } });
        },
        powerup() { arpeggio([72, 76, 79, 84], 0.055); },
        oneUp() { arpeggio([72, 76, 79, 84, 88, 91], 0.05, 'square', 0.08); },
        bomb() {
            noise({ dur: 1.6, vol: 0.45, attack: 0.02, filter: { f0: 6000, f1: 70 } });
            tone({ type: 'sine', f0: 90, f1: 24, dur: 1.4, vol: 0.55 });
            sample('audio/blaster-2-81267.mp3', 0.35);
        },
        weaponSwitch() {
            tone({ type: 'square', f0: 520, f1: 1300, dur: 0.07, vol: 0.05, filter: { f0: 3000 } });
            tone({ type: 'sine', f0: 1300, dur: 0.06, vol: 0.04, at: ctx ? ctx.currentTime + 0.06 : 0 });
        },
        overheat() {
            tone({ type: 'sawtooth', f0: 420, f1: 70, dur: 0.55, vol: 0.12, filter: { f0: 1500 } });
            noise({ dur: 0.5, vol: 0.08, filter: { type: 'highpass', f0: 4000 } });
        },
        ui() { tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.06, vol: 0.06 }); },
        warning() {
            if (!ctx) return;
            const t = ctx.currentTime;
            for (let i = 0; i < 8; i++) {
                tone({ type: 'square', f0: i % 2 ? 330 : 440, dur: 0.22, vol: 0.07, at: t + i * 0.25, filter: { f0: 1400 } });
            }
        },
        bossRoar() {
            tone({ type: 'sawtooth', f0: 70, f1: 45, dur: 1.0, vol: 0.25, filter: { f0: 500 } });
            noise({ dur: 0.9, vol: 0.15, filter: { type: 'bandpass', f0: 300, f1: 120, q: 2 } });
        },
        stageClear() { arpeggio([67, 71, 74, 79, 83, 86, 91], 0.08, 'triangle', 0.13); },
        gameOver() {
            if (!ctx) return;
            const t = ctx.currentTime;
            [64, 60, 57, 52].forEach((n, i) => tone({ type: 'triangle', f0: mtof(n), dur: 0.45, vol: 0.14, at: t + i * 0.32 }));
        },
        logo() {
            if (muted) return;
            logo.currentTime = 0;
            logo.play().catch(() => {});
        }
    };

    // ---------- Continuous plasma beam hum ----------
    let beam = null;
    sfx.beamOn = function () {
        if (!ctx || muted || beam) return;
        const t = ctx.currentTime;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.1, t + 0.06);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1300;
        f.Q.value = 7;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        o1.type = 'sawtooth'; o1.frequency.value = 110;
        o2.type = 'sawtooth'; o2.frequency.value = 221; o2.detune.value = 12;
        lfo.frequency.value = 14; lfoGain.gain.value = 650;
        lfo.connect(lfoGain); lfoGain.connect(f.frequency);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
        [o1, o2, lfo].forEach(o => o.start(t));
        beam = { g, nodes: [o1, o2, lfo] };
        tone({ type: 'sine', f0: 2200, f1: 280, dur: 0.18, vol: 0.08 });
    };
    sfx.beamOff = function () {
        if (!beam) return;
        const t = ctx.currentTime;
        beam.g.gain.cancelScheduledValues(t);
        beam.g.gain.setValueAtTime(Math.max(0.0001, beam.g.gain.value), t);
        beam.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        beam.nodes.forEach(n => n.stop(t + 0.15));
        beam = null;
    };

    // ---------- Procedural music ----------
    // A minor progression i - VI - III - VII, 16 steps per bar
    const PROG = [[0, false], [-4, true], [3, true], [-2, true]];
    const music = { playing: false, step: 0, next: 0, intensity: 0, root: 0, timer: null, bpm: 128 };

    function kick(t) { tone({ type: 'sine', f0: 160, f1: 38, dur: 0.24, vol: 0.55, at: t, bus: musicBus }); }
    function snare(t) {
        noise({ dur: 0.16, vol: 0.22, at: t, bus: musicBus, filter: { type: 'highpass', f0: 1500 } });
        tone({ type: 'triangle', f0: 210, f1: 120, dur: 0.1, vol: 0.12, at: t, bus: musicBus });
    }
    function hat(t, vol) { noise({ dur: 0.04, vol, at: t, bus: musicBus, filter: { type: 'highpass', f0: 7500 } }); }

    function playStep(s, t, spb) {
        const I = music.intensity;
        const [off, major] = PROG[s >> 4];
        const root = 45 + music.root + off;
        const triad = major ? [0, 4, 7] : [0, 3, 7];

        if (I >= 1) {
            if (s % 4 === 0) kick(t);
            if (s % 8 === 4) snare(t);
            if (s % 2 === 1) hat(t, 0.05);
            if (I >= 2) {
                if (s % 2 === 0) hat(t, 0.025);
                if (s % 16 === 14) kick(t);
                if (s % 16 === 15) snare(t);
            }
            if (s % 2 === 0) {
                tone({ type: 'sawtooth', f0: mtof(root + (s % 4 === 2 ? 12 : 0)), dur: spb * 1.8, vol: 0.13, at: t, bus: musicBus, filter: { f0: I >= 2 ? 1100 : 700, q: 4 } });
            }
        } else if (s % 16 === 0) {
            tone({ type: 'sawtooth', f0: mtof(root), dur: spb * 15, vol: 0.08, attack: 0.3, at: t, bus: musicBus, filter: { f0: 400 } });
        }

        const every = I === 0 ? 2 : 1;
        if (s % every === 0) {
            const order = [0, 1, 2, 1];
            const idx = (s / every) % 4;
            const lift = I >= 2 && s % 8 >= 4 ? 12 : 0;
            tone({ type: 'square', f0: mtof(root + 24 + triad[order[idx]] + lift), dur: spb * 0.9, vol: I === 0 ? 0.03 : 0.04, at: t, bus: musicBus, filter: { f0: 2400, q: 2 } });
        }

        if (s % 16 === 0 && I < 2) {
            triad.forEach(iv => tone({ type: 'triangle', f0: mtof(root + 12 + iv), dur: spb * 16, vol: 0.035, attack: 0.5, at: t, bus: musicBus }));
        }
        if (I >= 2 && s % 4 === 0) {
            const lead = [12, 15, 19, 17, 15, 12, 10, 7];
            tone({ type: 'sawtooth', f0: mtof(root + 24 + lead[(s / 4) % 8]), dur: spb * 3.5, vol: 0.035, at: t, bus: musicBus, filter: { f0: 1800, q: 3 } });
        }
    }

    function schedule() {
        if (!ctx) return;
        const spb = 60 / music.bpm / 4;
        if (music.next < ctx.currentTime - 0.2) music.next = ctx.currentTime + 0.05;
        while (music.next < ctx.currentTime + 0.12) {
            if (musicEnabled && !muted) playStep(music.step, music.next, spb);
            music.next += spb;
            music.step = (music.step + 1) % 64;
        }
    }

    function setMusic(intensity, root) {
        init();
        if (!ctx) return;
        music.intensity = intensity;
        if (root !== undefined) music.root = root;
        music.bpm = intensity >= 2 ? 148 : intensity === 1 ? 128 : 100;
        if (!music.playing) {
            music.playing = true;
            music.step = 0;
            music.next = ctx.currentTime + 0.1;
            music.timer = setInterval(schedule, 25);
        }
    }

    function stopMusic() {
        clearInterval(music.timer);
        music.playing = false;
    }

    function save() {
        try {
            localStorage.setItem('nova.muted', muted ? '1' : '0');
            localStorage.setItem('nova.music', musicEnabled ? '1' : '0');
        } catch (e) { /* storage unavailable */ }
    }

    function toggleMute() {
        muted = !muted;
        if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
        if (muted) { sfx.beamOff(); logo.pause(); }
        save();
        return muted;
    }

    function toggleMusic() {
        musicEnabled = !musicEnabled;
        if (musicBus) musicBus.gain.setTargetAtTime(musicEnabled ? 0.3 : 0, ctx.currentTime, 0.05);
        save();
        return musicEnabled;
    }

    return Object.assign(sfx, {
        init, setMusic, stopMusic, toggleMute, toggleMusic,
        get muted() { return muted; },
        get musicEnabled() { return musicEnabled; }
    });
})();
