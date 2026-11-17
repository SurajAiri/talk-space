import { useCallback, useState } from "react";

const KEY = "ts.minimap";

function initiallyVisible(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch {
    /* private mode: fall through to the default */
  }
  // // a phone's screen is small: start hidden there, shown on a laptop
  // return !window.matchMedia('(pointer: coarse)').matches
  return true;
}

/**
 * Whether the mini map is shown. It lives in the room page (not in the map itself) because the switch is in the
 * three-dot menu, far from the map. Remembered across rooms and visits.
 */
export function useMiniMapVisible() {
  const [visible, setVisible] = useState(initiallyVisible);
  const set = useCallback((next: boolean) => {
    setVisible(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* it just won't be remembered */
    }
  }, []);
  return [visible, set] as const;
}
