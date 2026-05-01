import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductList } from './product-list';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ProductList', () => {
  it('renders product rows with source badge', () => {
    render(
      <ProductList
        locale="en"
        products={[
          {
            id: 'prd_1',
            brandId: 'homtone',
            categoryId: 'cat_1',
            sku: 'SKU-1',
            title: '6QT Slow Cooker',
            description: null,
            category: { id: 'cat_1', name: '慢炖锅' },
            contents: [{ source: 'category_inherit' }],
            _count: { listings: 3 },
          },
        ]}
      />,
    );

    expect(screen.getByText('6QT Slow Cooker')).toBeDefined();
    expect(screen.getByText('继承自品类模板')).toBeDefined();
  });

  it('shows empty state when no products', () => {
    render(<ProductList locale="en" products={[]} />);
    expect(screen.getByText('还没有产品')).toBeDefined();
  });
});
