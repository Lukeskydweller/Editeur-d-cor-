// Lecture prioritaire depuis localStorage, fallback import.meta.env
function readFlag(key: string, fallback = "false"): boolean {
  try {
    const ls = localStorage.getItem(key);
    if (ls !== null) return ls === "true";
  } catch {}
  const env = (import.meta as any).env?.[key.replace(/\./g,"_").toUpperCase()];
  return String(env ?? fallback) === "true";
}

export const flags = {
  "ui.toolbar.v2": readFlag("flags.ui.toolbar.v2"),
  "ui.sidebar.material.v2": readFlag("flags.ui.sidebar.material.v2"),
  "ui.ghost.overlay.v2": readFlag("flags.ui.ghost.overlay.v2")
} as const;
