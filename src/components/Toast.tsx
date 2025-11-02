import { useEffect, useState } from 'react';
import { useSceneStore } from '../state/useSceneStore';

export default function Toast() {
  const toast = useSceneStore((s) => s.ui.toast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast && toast.until > Date.now()) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, toast.until - Date.now());
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [toast]);

  if (!visible || !toast) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2"
      role="alert"
      data-testid="toast"
    >
      {toast.message}
    </div>
  );
}
