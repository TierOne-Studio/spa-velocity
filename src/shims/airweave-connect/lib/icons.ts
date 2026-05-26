/**
 * Shim — see `./types.ts` for context.
 *
 * The SDK calls `getAppIconUrl('slack')` to render the provider logo next
 * to each source row inside its iframe modal. The official Airweave CDN
 * hosts these icons at a stable URL pattern; we route there directly.
 * If the CDN is unreachable, the SDK's `<img>` falls back to alt text,
 * which is fine — the modal still functions.
 */
import type { IconVariant } from './types';

const ICON_BASE_URL = 'https://cdn.airweave.ai/icons';

/**
 * Returns the icon URL for a given app shortName ("slack", "notion", …).
 * Variant defaults to `default` (color). The SDK uses `light`/`dark` when
 * theming; we treat them as the same since the CDN may not host variants.
 */
export function getAppIconUrl(
  appShortName: string | undefined,
  variant: IconVariant = 'default',
): string {
  if (!appShortName) return '';
  const safeName = appShortName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!safeName) return '';
  const suffix = variant === 'default' ? '' : `-${variant}`;
  return `${ICON_BASE_URL}/${safeName}${suffix}.svg`;
}
