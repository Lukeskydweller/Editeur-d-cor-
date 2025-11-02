// Synchronise la scène Draft (UI) vers SceneV1 (editorStore) avec un debounce.
import { setScene } from "../store/editorStore";
import { projectDraftToV1 } from "./projector";
import { useSceneStore } from "../state/useSceneStore";

const DEBOUNCE_MS = 75;
let timer: any = null;
let unsub: null | (() => void) = null;

export function startValidationBridge() {
  try {
    // Projection initiale
    const draft = useSceneStore.getState();
    const v1 = projectDraftToV1(draft);
    setScene(v1); // Fire and forget - don't block initialization

    // Abonner les mutations Draft
    unsub = useSceneStore.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const draftNow = useSceneStore.getState();
        const v1Now = projectDraftToV1(draftNow);
        await setScene(v1Now);
      }, DEBOUNCE_MS);
    });
  } catch (e) {
    // En dev uniquement : ne pas planter l'app si la projection n'est pas prête
    console.warn("[bridge] startValidationBridge failed:", e);
  }
}

export function stopValidationBridge() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
