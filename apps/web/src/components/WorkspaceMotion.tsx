'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MotionContext = createContext({ enabled: true, reduced: false, toggle: () => {} });
const query = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

export function WorkspaceMotion({
  children,
  initialEnabled = true,
}: {
  children: ReactNode;
  initialEnabled?: boolean;
}) {
  const [preference, setPreference] = useState(initialEnabled);
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  const enabled = preference && !reduced;
  useEffect(() => {
    // Dialogs render in a portal outside the workspace root.
    document.documentElement.dataset.workspaceMotion = enabled ? 'on' : 'off';
    return () => {
      delete document.documentElement.dataset.workspaceMotion;
    };
  }, [enabled]);
  const toggle = () => {
    const next = !preference;
    setPreference(next);
    document.cookie = `reven_motion=${next ? 'on' : 'off'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  };
  return (
    <MotionContext.Provider value={{ enabled, reduced, toggle }}>
      <div className="rv-motion-root" data-motion={enabled ? 'on' : 'off'}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export function MotionControl({ compact = false }: { compact?: boolean }) {
  const { enabled, reduced, toggle } = useContext(MotionContext);
  const t = useTranslations('visual');
  const label = reduced ? t('motionReduced') : enabled ? t('pauseMotion') : t('resumeMotion');
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={reduced}
      aria-label={label}
      aria-pressed={!enabled}
      title={label}
      className={`rv-motion-control ${compact ? 'rv-motion-control--compact' : ''}`}
    >
      {enabled ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      {!compact && (
        <span className="hidden xl:inline">{t(enabled ? 'motionOn' : 'motionOff')}</span>
      )}
    </button>
  );
}
