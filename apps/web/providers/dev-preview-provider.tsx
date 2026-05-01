'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Brand } from './brand-provider';

export type ViewMode = 'admin' | 'portal';
export type Locale = 'en' | 'es' | 'fr' | 'de' | 'it' | 'zh';
export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface DevPreviewState {
  mode: ViewMode;
  brand: Brand;
  locale: Locale;
  viewport: Viewport;
}

interface DevPreviewContextValue {
  state: DevPreviewState;
  setMode: (m: ViewMode) => void;
  setBrand: (b: Brand) => void;
  setLocale: (l: Locale) => void;
  setViewport: (v: Viewport) => void;
  switchTo: (preset: DevPreviewState) => void;
}

const DevPreviewContext = createContext<DevPreviewContextValue | null>(null);

const DEFAULT_STATE: DevPreviewState = {
  mode: 'admin',
  brand: 'homtone',
  locale: 'zh',
  viewport: 'desktop',
};

export function DevPreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DevPreviewState>(DEFAULT_STATE);

  const setMode = useCallback((mode: ViewMode) => {
    setState((s) => ({
      ...s,
      mode,
      locale: mode === 'admin' ? 'zh' : 'en',
    }));
  }, []);

  const setBrand = useCallback((brand: Brand) => {
    setState((s) => ({ ...s, brand }));
  }, []);

  const setLocale = useCallback((locale: Locale) => {
    setState((s) => ({ ...s, locale }));
  }, []);

  const setViewport = useCallback((viewport: Viewport) => {
    setState((s) => ({ ...s, viewport }));
  }, []);

  const switchTo = useCallback((preset: DevPreviewState) => {
    setState(preset);
  }, []);

  return (
    <DevPreviewContext.Provider
      value={{ state, setMode, setBrand, setLocale, setViewport, switchTo }}
    >
      {children}
    </DevPreviewContext.Provider>
  );
}

export function useDevPreview() {
  const ctx = useContext(DevPreviewContext);
  if (!ctx) {
    throw new Error('useDevPreview must be used within DevPreviewProvider');
  }
  return ctx;
}
