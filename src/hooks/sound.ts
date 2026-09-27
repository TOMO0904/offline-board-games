let context: AudioContext | null = null
export function playMoveSound() {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const oscillator = context.createOscillator(),
      gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 580
    gain.gain.setValueAtTime(0.06, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.09)
  } catch {
    /* Sound is optional; the game remains playable. */
  }
}
