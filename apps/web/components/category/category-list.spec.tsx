import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryList } from './category-list';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('CategoryList', () => {
  it('renders category rows', () => {
    render(
      <CategoryList
        locale="en"
        categories={[
          {
            id: 'cat_1',
            brandId: 'homtone',
            parentId: null,
            name: '厨电·慢炖锅',
            slug: 'slow-cooker',
            isActive: true,
            requiresRecipe: true,
            _count: { products: 4 },
          },
        ]}
      />,
    );

    expect(screen.getByText('厨电·慢炖锅')).toBeDefined();
    expect(screen.getByText('需要')).toBeDefined();
  });

  it('shows empty state when no categories', () => {
    render(<CategoryList locale="en" categories={[]} />);
    expect(screen.getByText('还没有品类')).toBeDefined();
  });
});
