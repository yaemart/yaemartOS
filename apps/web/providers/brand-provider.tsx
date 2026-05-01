'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type Brand = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';

const STORAGE_KEY = 'yaemart-brand';
const VALID_BRANDS: Brand[] = ['homtone', 'spoonlemon', 'davivy', 'tysun'];

function readStoredBrand(fallback: Brand): Brand {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (VALID_BRANDS as string[]).includes(stored)) {
    return stored as Brand;
  }
  return fallback;
}

interface BrandContextValue {
  brand: Brand;
  setBrand: (b: Brand) => void;
}

const BrandContext = createContext<BrandContextValue>({
  brand: 'homtone',
  setBrand: () => {},
});

export function BrandProvider({
  children,
  initialBrand = 'homtone',
}: {
  children: ReactNode;
  initialBrand?: Brand;
}) {
  const [brand, setBrandState] = useState<Brand>(() => readStoredBrand(initialBrand));

  const setBrand = (b: Brand) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, b);
    }
    setBrandState(b);
  };

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      <div data-brand={brand} className="min-h-screen bg-brand-bg transition-colors duration-200">
        {children}
      </div>
    </BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
