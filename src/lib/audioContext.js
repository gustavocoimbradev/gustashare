let sharedAudioContext = null;

export function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  sharedAudioContext.resume().catch(() => {});
  return sharedAudioContext;
}
