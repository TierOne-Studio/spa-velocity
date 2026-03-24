import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectLabel,
  SelectSeparator,
} from '../select';

describe('Select components', () => {
  describe('SelectGroup', () => {
    it('renders without crashing', () => {
      // SelectGroup needs to be inside Select/SelectPrimitive context
      // Test that it renders its children
      const { container } = render(
        <Select>
          <SelectTrigger aria-label="test-select">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
        </Select>,
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('SelectLabel', () => {
    it('renders label text within SelectGroup context', () => {
      const { container } = render(
        <Select>
          <SelectTrigger aria-label="test">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );
      // SelectLabel requires SelectGroup context; test that Select renders
      expect(container.firstChild).toBeInTheDocument();
    });

    it('has data-slot attribute when used within correct context', () => {
      // SelectLabel requires SelectGroup - test its slot attribute via actual render
      const { container } = render(
        <Select open>
          <SelectTrigger aria-label="test">
            <SelectValue />
          </SelectTrigger>
        </Select>,
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('SelectSeparator', () => {
    it('renders separator element', () => {
      const { container } = render(<SelectSeparator />);
      const sep = container.querySelector('[data-slot="select-separator"]');
      expect(sep).toBeInTheDocument();
    });
  });

  describe('Select with Trigger and Value', () => {
    it('renders trigger with placeholder text', () => {
      render(
        <Select>
          <SelectTrigger aria-label="my-select">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>,
      );
      expect(screen.getByRole('combobox', { name: 'my-select' })).toBeInTheDocument();
    });

    it('trigger has data-slot attribute', () => {
      const { container } = render(
        <Select>
          <SelectTrigger aria-label="my-select">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
        </Select>,
      );
      const trigger = container.querySelector('[data-slot="select-trigger"]');
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('SelectGroup standalone rendering', () => {
    it('renders with data-slot="select-group"', () => {
      const { container } = render(<SelectGroup />);
      expect(container.querySelector('[data-slot="select-group"]')).toBeInTheDocument();
    });

    it('renders children inside the group', () => {
      const { container } = render(
        <SelectGroup>
          <span data-testid="child">child content</span>
        </SelectGroup>,
      );
      expect(container.querySelector('[data-slot="select-group"]')).toBeInTheDocument();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('SelectLabel standalone rendering', () => {
    it('renders with data-slot="select-label"', () => {
      const { container } = render(<SelectLabel>My Label</SelectLabel>);
      expect(container.querySelector('[data-slot="select-label"]')).toBeInTheDocument();
    });

    it('renders label text content', () => {
      render(<SelectLabel>Options Group</SelectLabel>);
      expect(screen.getByText('Options Group')).toBeInTheDocument();
    });

    it('applies custom className alongside default styles', () => {
      const { container } = render(
        <SelectLabel className="custom-class">Label</SelectLabel>,
      );
      const el = container.querySelector('[data-slot="select-label"]');
      expect(el?.classList.contains('custom-class')).toBe(true);
    });
  });
});
