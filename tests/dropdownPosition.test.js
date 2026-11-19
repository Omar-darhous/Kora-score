import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMobilePortalPosition } from '../src/utils/dropdownPosition.js';

test('computeMobilePortalPosition prefers opening BELOW trigger on 375px/390px/430px even with long season lists', () => {
  const widths = [375, 390, 430];

  for (const viewportWidth of widths) {
    // Trigger sits near middle of iPhone Safari viewport (bottom=380 on 667px screen, bottom nav ~74px)
    // spaceBelow ≈ 667 - 74 - 386 = 207px (< 280px, while spaceAbove ≈ 330px).
    // Must STILL open BELOW instead of overlapping the league hero header above!
    const triggerRect = { top: 344, bottom: 380, left: viewportWidth - 190, right: viewportWidth - 18, width: 172 };
    const result = computeMobilePortalPosition({
      triggerRect,
      viewportWidth,
      viewportHeight: 667,
      layoutViewportHeight: 667,
      optionsCount: 22,
      bottomSafeInset: 74
    });

    assert.equal(result.placement, 'bottom', `expected bottom placement at ${viewportWidth}px`);
    const top = Number.parseInt(result.style.top, 10);
    const maxHeight = Number.parseInt(result.style.maxHeight, 10);
    const left = Number.parseInt(result.style.left, 10);
    const width = Number.parseInt(result.style.width, 10);

    // Strictly below trigger (no trigger overlap)
    assert.ok(top >= triggerRect.bottom + 6, `menu top (${top}) must be below trigger (${triggerRect.bottom})`);
    // Fits within visible viewport above bottom nav
    assert.ok(top + maxHeight <= 667 - 74, `menu bottom (${top + maxHeight}) must stay above bottom nav`);
    // Internal scrolling enabled via scrollAreaStyle
    assert.ok(Number.parseInt(result.scrollAreaStyle.maxHeight, 10) < maxHeight);
    // Zero horizontal overflow
    assert.ok(left >= 12, `left (${left}) must be >= 12 at ${viewportWidth}px`);
    assert.ok(left + width <= viewportWidth - 12, `right edge (${left + width}) must be <= ${viewportWidth - 12}`);
  }
});

test('computeMobilePortalPosition handles short season lists cleanly below trigger without unnecessary flipping', () => {
  const triggerRect = { top: 280, bottom: 316, left: 200, right: 372, width: 172 };
  const result = computeMobilePortalPosition({
    triggerRect,
    viewportWidth: 390,
    viewportHeight: 844,
    optionsCount: 3,
    bottomSafeInset: 74
  });

  assert.equal(result.placement, 'bottom');
  assert.equal(result.style.top, '322px');
  assert.equal(result.style.bottom, 'auto');
});

test('computeMobilePortalPosition flips safely ABOVE trigger when viewport space below is insufficient', () => {
  // User scrolled so trigger is near the bottom of the screen (only 60px left above bottom nav)
  const triggerRect = { top: 530, bottom: 566, left: 20, right: 192, width: 172 };
  const result = computeMobilePortalPosition({
    triggerRect,
    viewportWidth: 375,
    viewportHeight: 700,
    layoutViewportHeight: 700,
    optionsCount: 15,
    bottomSafeInset: 74
  });

  assert.equal(result.placement, 'top');
  assert.equal(result.style.top, 'auto');
  // Bottom anchored 6px above trigger top -> 700 - (530 - 6) = 176px
  assert.equal(result.style.bottom, '176px');
  const maxHeight = Number.parseInt(result.style.maxHeight, 10);
  assert.ok(maxHeight <= 280 && maxHeight >= 160);
  // Zero horizontal overflow when trigger is near left edge
  const left = Number.parseInt(result.style.left, 10);
  const width = Number.parseInt(result.style.width, 10);
  assert.ok(left >= 12);
  assert.ok(left + width <= 375 - 12);
});

test('computeMobilePortalPosition respects iPhone Safari visualViewport offsets', () => {
  const triggerRect = { top: 300, bottom: 336, left: 180, right: 355, width: 175 };
  const result = computeMobilePortalPosition({
    triggerRect,
    viewportWidth: 390,
    viewportHeight: 620,
    layoutViewportHeight: 667,
    viewportOffsetTop: 20,
    viewportOffsetLeft: 0,
    optionsCount: 18,
    bottomSafeInset: 74
  });

  assert.equal(result.placement, 'bottom');
  const top = Number.parseInt(result.style.top, 10);
  const maxHeight = Number.parseInt(result.style.maxHeight, 10);
  assert.equal(top, 342);
  // Visual viewport bottom is 20 + 620 - 74 = 566
  assert.ok(top + maxHeight <= 566);
});
