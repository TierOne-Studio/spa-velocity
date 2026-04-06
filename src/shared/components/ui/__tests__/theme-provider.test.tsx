import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import { ThemeProvider, useTheme } from '../theme-provider';

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset document classes
    document.documentElement.classList.remove('light', 'dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <span>Hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('uses defaultTheme="system" and applies system theme (light when matchMedia returns false)', () => {
    render(<ThemeProvider defaultTheme="system"><span>child</span></ThemeProvider>);
    // matchMedia mock returns matches: false for all queries, so system = light
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('uses defaultTheme="light" and adds light class', () => {
    render(<ThemeProvider defaultTheme="light"><span>child</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('uses defaultTheme="dark" and adds dark class', () => {
    render(<ThemeProvider defaultTheme="dark"><span>child</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reads initial theme from localStorage using storageKey', () => {
    localStorage.setItem('my-theme-key', 'dark');
    render(<ThemeProvider storageKey="my-theme-key"><span>child</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses default storageKey "vite-ui-theme"', () => {
    localStorage.setItem('vite-ui-theme', 'dark');
    render(<ThemeProvider><span>child</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme light adds light class and saves to localStorage', () => {
    const TestConsumer = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('light')}>Set Light</button>;
    };

    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText('Set Light').click();
    });

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('vite-ui-theme')).toBe('light');
  });

  it('setTheme dark adds dark class and saves to localStorage', () => {
    const TestConsumer = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('dark')}>Set Dark</button>;
    };

    render(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText('Set Dark').click();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
  });

  it('setTheme saves to custom storageKey', () => {
    const TestConsumer = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('light')}>Set Light</button>;
    };

    render(
      <ThemeProvider storageKey="custom-key">
        <TestConsumer />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText('Set Light').click();
    });

    expect(localStorage.getItem('custom-key')).toBe('light');
  });

  it('useTheme returns current theme value', () => {
    const TestConsumer = () => {
      const { theme } = useTheme();
      return <span data-testid="theme">{theme}</span>;
    };

    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('useTheme returns setTheme function', () => {
    const TestConsumer = () => {
      const { setTheme, theme } = useTheme();
      return (
        <>
          <span data-testid="theme">{theme}</span>
          <button onClick={() => setTheme('dark')}>Set Dark</button>
        </>
      );
    };

    render(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme').textContent).toBe('light');
    act(() => {
      screen.getByText('Set Dark').click();
    });
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it('setTheme system applies light class when matchMedia returns false for dark', () => {
    const TestConsumer = () => {
      const { setTheme } = useTheme();
      return <button onClick={() => setTheme('system')}>Set System</button>;
    };

    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText('Set System').click();
    });

    // matchMedia mock returns matches: false, so system resolves to light
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

describe('useTheme outside provider', () => {
  it('returns initial state (does not throw) when used outside ThemeProvider', () => {
    // When used outside provider, useContext returns the default initialState
    // which is { theme: "system", setTheme: () => null }
    // The source checks `context === undefined` but initialState is not undefined
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
    expect(typeof result.current.setTheme).toBe('function');
  });
});
