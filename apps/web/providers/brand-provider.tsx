'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type Brand = 'homtone' | 'spoonlemon' | 'davivy' | 'tysun';

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
  const [brand, setBrand] = useState<Brand>(initialBrand);

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      <div data-brand={brand} className="min-h-screen bg-brand-bg transition-colors duration-200">
        {children}
      </div>
    </BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
