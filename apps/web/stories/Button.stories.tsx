import type { Meta, StoryObj } from '@storybook/react';

const ButtonDemo = ({
  brand,
  label,
  variant,
}: {
  brand: string;
  label: string;
  variant?: string;
}) => (
  <div data-brand={brand} className="p-4">
    <button
      className={`px-4 py-2 rounded-md font-medium ${
        variant === 'outline'
          ? 'border border-[var(--brand-primary)] text-[var(--brand-primary)]'
          : 'bg-[var(--brand-primary)] text-white hover:opacity-90'
      }`}
    >
      {label}
    </button>
  </div>
);

const meta: Meta<typeof ButtonDemo> = {
  title: 'Design System/Button',
  component: ButtonDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Homtone: Story = {
  args: { brand: 'homtone', label: 'Homtone Button' },
};

export const Spoonlemon: Story = {
  args: { brand: 'spoonlemon', label: 'Spoonlemon Button' },
};

export const Davivy: Story = {
  args: { brand: 'davivy', label: 'Davivy Button' },
};

export const Tysun: Story = {
  args: { brand: 'tysun', label: 'Tysun Button' },
};

export const Outline: Story = {
  args: { brand: 'homtone', label: 'Outline Button', variant: 'outline' },
};
