/**
 * Sons de feedback do TaskFlow.
 * Usa Web Audio API — sem dependências externas.
 */

function beep(freq1, freq2, freq3, volume = 0.25) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq1, ctx.currentTime);
    osc.frequency.setValueAtTime(freq2, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(freq3, ctx.currentTime + 0.24);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch {}
}

/** Tom ascendente — conclusão, sucesso */
export function playSuccess() {
  beep(523, 659, 784);
}

/** Tom descendente — timer esgotado, encerramento */
export function playTimerDone() {
  beep(784, 659, 523);
}

/** Tom neutro — notificação simples */
export function playBeep() {
  beep(523, 659, 784);
}

/** Rising arpeggio — new personal record */
export function playNewRecord() {
  beep(523, 784, 1047);
}
