import type { Meta, StoryObj } from '@storybook/react';

const CardDemo = ({
  brand,
  title,
  description,
}: {
  brand: string;
  title: string;
  description: string;
}) => (
  <div data-brand={brand} className="p-4 max-w-sm">
    <div className="rounded-lg border border-[var(--brand-surface)] bg-[var(--brand-bg)] p-6 shadow-sm">
      <h3 className="font-semibold text-lg text-[var(--brand-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  </div>
);

const meta: Meta<typeof CardDemo> = {
  title: 'Design System/Card',
  component: CardDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Homtone: Story = {
  args: {
    brand: 'homtone',
    title: 'Homtone Card',
    description: 'Warm amber kitchen appliance brand',
  },
};

export const Spoonlemon: Story = {
  args: {
    brand: 'spoonlemon',
    title: 'Spoonlemon Card',
    description: 'Fresh emerald kitchenware brand',
  },
};

export const Davivy: Story = {
  args: { brand: 'davivy', title: 'Davivy Card', description: 'Premium zinc electronics brand' },
};

export const Tysun: Story = {
  args: { brand: 'tysun', title: 'Tysun Card', description: 'Professional blue power tools brand' },
};
