// Sonido del aviso con Web Audio (sin archivos). Los navegadores solo permiten reproducir sonido
// después de una interacción de la persona, por eso el contexto se habilita en el primer clic o tecla.
let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function habilitarSonido(): void {
  const desbloquear = () => {
    const c = contexto();
    if (c?.state === 'suspended') void c.resume();
  };
  window.addEventListener('pointerdown', desbloquear, { once: true });
  window.addEventListener('keydown', desbloquear, { once: true });
}

/** Tres tonos suaves y claros, repetidos dos veces. */
export function sonarAviso(): void {
  const c = contexto();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const notas = [660, 880, 990];
  const t0 = c.currentTime + 0.05;
  for (let rep = 0; rep < 2; rep++) {
    notas.forEach((f, i) => {
      const t = t0 + rep * 1.4 + i * 0.32;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }
}
