import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '../breadcrumb';

describe('Breadcrumb components', () => {
  describe('Breadcrumb', () => {
    it('renders a nav element with aria-label breadcrumb', () => {
      render(<Breadcrumb />);
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    });

    it('has data-slot attribute', () => {
      const { container } = render(<Breadcrumb />);
      expect(container.querySelector('[data-slot="breadcrumb"]')).toBeInTheDocument();
    });
  });

  describe('BreadcrumbList', () => {
    it('renders an ol element with data-slot', () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbList />
        </Breadcrumb>,
      );
      const ol = container.querySelector('ol');
      expect(ol).toBeInTheDocument();
      expect(ol).toHaveAttribute('data-slot', 'breadcrumb-list');
    });
  });

  describe('BreadcrumbItem', () => {
    it('renders an li element with data-slot', () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>item</BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );
      const li = container.querySelector('li');
      expect(li).toBeInTheDocument();
      expect(li).toHaveAttribute('data-slot', 'breadcrumb-item');
    });
  });

  describe('BreadcrumbLink', () => {
    it('renders as an anchor tag when asChild is false', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/home">Home</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/home');
    });

    it('has data-slot attribute', () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/home">Home</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );
      expect(container.querySelector('[data-slot="breadcrumb-link"]')).toBeInTheDocument();
    });

    it('renders as Slot when asChild is true', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <a href="/about">About</a>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'About' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/about');
    });
  });

  describe('BreadcrumbPage', () => {
    it('renders a span with aria-current page', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Current Page</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );
      const page = screen.getByText('Current Page');
      expect(page).toBeInTheDocument();
      expect(page).toHaveAttribute('aria-current', 'page');
      expect(page).toHaveAttribute('data-slot', 'breadcrumb-page');
    });

    it('has aria-disabled true', () => {
      render(<BreadcrumbPage>Page</BreadcrumbPage>);
      const el = screen.getByText('Page');
      expect(el).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('BreadcrumbSeparator', () => {
    it('renders default ChevronRight icon when no children', () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbSeparator />
          </BreadcrumbList>
        </Breadcrumb>,
      );
      // The separator li exists
      const sep = container.querySelector('[data-slot="breadcrumb-separator"]');
      expect(sep).toBeInTheDocument();
      // Has an svg (ChevronRight)
      expect(sep?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders custom children instead of default icon', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbSeparator>
              <span data-testid="custom-sep">/</span>
            </BreadcrumbSeparator>
          </BreadcrumbList>
        </Breadcrumb>,
      );
      expect(screen.getByTestId('custom-sep')).toBeInTheDocument();
    });

    it('has role presentation and aria-hidden', () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbSeparator />
          </BreadcrumbList>
        </Breadcrumb>,
      );
      const sep = container.querySelector('[data-slot="breadcrumb-separator"]');
      expect(sep).toHaveAttribute('role', 'presentation');
      expect(sep).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('BreadcrumbEllipsis', () => {
    it('renders MoreHorizontal icon', () => {
      const { container } = render(<BreadcrumbEllipsis />);
      const el = container.querySelector('[data-slot="breadcrumb-ellipsis"]');
      expect(el).toBeInTheDocument();
      expect(el?.querySelector('svg')).toBeInTheDocument();
    });

    it('has sr-only text "More"', () => {
      render(<BreadcrumbEllipsis />);
      const srOnly = screen.getByText('More');
      expect(srOnly).toBeInTheDocument();
      expect(srOnly).toHaveClass('sr-only');
    });

    it('has role presentation', () => {
      const { container } = render(<BreadcrumbEllipsis />);
      const el = container.querySelector('[data-slot="breadcrumb-ellipsis"]');
      expect(el).toHaveAttribute('role', 'presentation');
    });

    it('has aria-hidden', () => {
      const { container } = render(<BreadcrumbEllipsis />);
      const el = container.querySelector('[data-slot="breadcrumb-ellipsis"]');
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('full breadcrumb usage', () => {
    it('renders a complete breadcrumb trail', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Users</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      );

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
      expect(screen.getByText('Users')).toHaveAttribute('aria-current', 'page');
    });
  });
});
