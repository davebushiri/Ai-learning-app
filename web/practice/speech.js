// The practice engine's only door to the shared speech module (ADR 0008 ARCH-6, C8).
// F1a-T15 rewrites this one file when the web/speech/ facade lands.
export { speak, stopSpeaking, wait, canListen, listen } from '/speech.js';
