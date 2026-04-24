// Shared helpers for ElevenLabs voice cloning & TTS.
// The API key is read from env first (so it can be rotated without a redeploy),
// with a hard-coded fallback as a convenience for staging bring-up.
// TODO: once ELEVENLABS_API_KEY is set in the VPS .env on prod,
// delete the fallback string below and rotate the key in the ElevenLabs cabinet.
export const ELEVENLABS_API_KEY =
  process.env.ELEVENLABS_API_KEY ??
  "sk_82f8d1f12d3ac27d765d35d87d10a03402e1984395194653";

export const ELEVENLABS_DEFAULT_MODEL = "eleven_multilingual_v2";
