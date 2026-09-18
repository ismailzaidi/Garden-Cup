export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Labels a duration preset button: sub-minute presets read in seconds
// ("30s"), minute-and-up presets keep the existing "Nm" shorthand.
export function formatPreset(secs) {
  return secs < 60 ? `${secs}s` : `${secs / 60}m`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}
