import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '../table';

describe('Table components', () => {
  describe('Table', () => {
    it('renders a table element with data-slot', () => {
      const { container } = render(<Table />);
      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
      expect(table).toHaveAttribute('data-slot', 'table');
    });

    it('renders children', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByText('Cell content')).toBeInTheDocument();
    });
  });

  describe('TableHeader', () => {
    it('renders a thead with data-slot', () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
      expect(thead).toHaveAttribute('data-slot', 'table-header');
      expect(screen.getByText('Header')).toBeInTheDocument();
    });
  });

  describe('TableBody', () => {
    it('renders a tbody with data-slot', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Body cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      const tbody = container.querySelector('tbody');
      expect(tbody).toBeInTheDocument();
      expect(tbody).toHaveAttribute('data-slot', 'table-body');
    });
  });

  describe('TableFooter', () => {
    it('renders a tfoot with data-slot', () => {
      const { container } = render(
        <Table>
          <TableFooter>
            <TableRow>
              <TableCell>Footer content</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      const tfoot = container.querySelector('tfoot');
      expect(tfoot).toBeInTheDocument();
      expect(tfoot).toHaveAttribute('data-slot', 'table-footer');
    });

    it('renders children in footer', () => {
      render(
        <Table>
          <TableFooter>
            <TableRow>
              <TableCell>Total: 42</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      expect(screen.getByText('Total: 42')).toBeInTheDocument();
    });
  });

  describe('TableRow', () => {
    it('renders a tr with data-slot', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>row</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      const tr = container.querySelector('tr');
      expect(tr).toBeInTheDocument();
      expect(tr).toHaveAttribute('data-slot', 'table-row');
    });
  });

  describe('TableHead', () => {
    it('renders a th with data-slot', () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      const th = container.querySelector('th');
      expect(th).toBeInTheDocument();
      expect(th).toHaveAttribute('data-slot', 'table-head');
    });
  });

  describe('TableCell', () => {
    it('renders a td with data-slot', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>cell value</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      const td = container.querySelector('td');
      expect(td).toBeInTheDocument();
      expect(td).toHaveAttribute('data-slot', 'table-cell');
    });

    it('renders children', () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>My cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByText('My cell')).toBeInTheDocument();
    });
  });

  describe('TableCaption', () => {
    it('renders a caption with data-slot', () => {
      const { container } = render(
        <Table>
          <TableCaption>Table title</TableCaption>
        </Table>,
      );
      const caption = container.querySelector('caption');
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveAttribute('data-slot', 'table-caption');
    });

    it('renders caption text', () => {
      render(
        <Table>
          <TableCaption>A list of invoices</TableCaption>
        </Table>,
      );
      expect(screen.getByText('A list of invoices')).toBeInTheDocument();
    });
  });

  describe('full table render', () => {
    it('renders a complete table structure', () => {
      render(
        <Table>
          <TableCaption>Invoice list</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>INV-001</TableCell>
              <TableCell>$100</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell>$100</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(screen.getByText('Invoice list')).toBeInTheDocument();
      expect(screen.getByText('Invoice')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getAllByText('$100')).toHaveLength(2);
      expect(screen.getByText('Total')).toBeInTheDocument();
    });
  });
});
