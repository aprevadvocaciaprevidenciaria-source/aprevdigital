// Beep sintetizado via Web Audio API - sem depender de nenhum arquivo de
// áudio externo. Toca dois tons curtos (tipo "novo WhatsApp").
export function tocarSomNotificacao() {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx()
    const tocarTom = (freq, inicioSeg, duracaoSeg) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + inicioSeg)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + inicioSeg + 0.02)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + inicioSeg + duracaoSeg)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + inicioSeg)
      osc.stop(ctx.currentTime + inicioSeg + duracaoSeg)
    }
    tocarTom(880, 0, 0.12)
    tocarTom(1180, 0.13, 0.15)
    setTimeout(() => ctx.close(), 500)
  } catch {
    // Ambiente sem suporte a áudio (ou bloqueado) - silencioso de propósito.
  }
}
