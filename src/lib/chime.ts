import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * In-app chime for the foreground confirmation (the native engine only plays it with the notification).
 * Check-in rises D5 → A5, check-out falls. Respects the silent switch (playsInSilentMode: false).
 */
const sources = {
  in: require('../../assets/timo_checkin.wav') as number,
  out: require('../../assets/timo_checkout.wav') as number,
};
const players: Partial<Record<'in' | 'out', AudioPlayer>> = {};
let moded = false;

export async function playChime(kind: 'in' | 'out') {
  try {
    if (!moded) {
      moded = true;
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false, allowsRecording: false });
    }
    const p = players[kind] ?? (players[kind] = createAudioPlayer(sources[kind]));
    await p.seekTo(0);
    p.play();
  } catch {
    // Audio is a nicety; never break the confirmation over it.
  }
}
