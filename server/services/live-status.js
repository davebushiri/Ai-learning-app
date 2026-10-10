// What /api/health reports about the live path, so a bad key doesn't hide behind "LIVE".
export const liveStatus = { lastLiveOkAt: null, lastLiveError: null };
export function noteLive(what, err) {
  const at = new Date().toISOString();
  if (err) liveStatus.lastLiveError = `${at} ${what}: ${err.message}`;
  else liveStatus.lastLiveOkAt = at;
}
