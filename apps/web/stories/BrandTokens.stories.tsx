import type { Meta, StoryObj } from '@storybook/react';
import '../app/globals.css';

const brands = [
  { key: 'homtone', label: 'Homtone', attr: undefined as string | undefined },
  { key: 'spoonlemon', label: 'Spoonlemon', attr: 'spoonlemon' },
  { key: 'davivy', label: 'Davivy', attr: 'davivy' },
  { key: 'tysun', label: 'Tysun', attr: 'tysun' },
] as const;

function BrandSwatch({ label, brandAttr }: { label: string; brandAttr?: string }) {
  return (
    <div
      {...(brandAttr ? { 'data-brand': brandAttr } : {})}
      className="space-y-3 rounded-lg border border-zinc-200 bg-brand-bg p-4 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-text-secondary">
        {label}
      </p>
      <div className="h-14 rounded-md bg-brand-primary shadow-inner" title="primary" />
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded bg-brand-primary-light" title="primary-light" />
        <div className="h-10 flex-1 rounded bg-brand-primary-dark" title="primary-dark" />
      </div>
      <div className="h-8 rounded bg-brand-accent" title="accent" />
    </div>
  );
}

const meta: Meta = {
  title: 'Design System/BrandTokens',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const FourBrandPalette: Story = {
  render: () => (
    <div className="grid gap-4 p-8 md:grid-cols-2 xl:grid-cols-4">
      {brands.map((b) => (
        <BrandSwatch key={b.key} label={b.label} brandAttr={b.attr} />
      ))}
    </div>
  ),
};
