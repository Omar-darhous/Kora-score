const EDGE_MARGIN = 12;
const TRIGGER_GAP = 6;
const MAX_MENU_HEIGHT = 280;
const MIN_BELOW_PREFERENCE = 160;
const MIN_SCROLLABLE_HEIGHT = 84;
const MENU_VERTICAL_PADDING = 12;

/**
 * Computes safe fixed-portal positioning for mobile dropdown menus (< 768px).
 * - Prefers opening BELOW the trigger whenever reasonable viewport space exists
 *   (avoiding upward overlap with hero headers on iPhone Safari).
 * - Respects visualViewport dimensions/offsets and bottom navigation clearance.
 * - Guarantees zero overlap with the trigger and zero horizontal/vertical viewport overflow.
 */
export const computeMobilePortalPosition = ({
  triggerRect,
  viewportWidth,
  viewportHeight,
  layoutViewportHeight = viewportHeight,
  viewportOffsetTop = 0,
  viewportOffsetLeft = 0,
  optionsCount = 0,
  align = 'auto',
  topSafeInset = 0,
  bottomSafeInset = 0
}) => {
  const safeTop = viewportOffsetTop + Math.max(EDGE_MARGIN, topSafeInset);
  const safeBottom = viewportOffsetTop + viewportHeight - Math.max(EDGE_MARGIN, bottomSafeInset);
  const safeLeft = viewportOffsetLeft + EDGE_MARGIN;
  const safeRight = viewportOffsetLeft + viewportWidth - EDGE_MARGIN;

  const availableBelow = Math.max(0, Math.floor(safeBottom - (triggerRect.bottom + TRIGGER_GAP)));
  const availableAbove = Math.max(0, Math.floor((triggerRect.top - TRIGGER_GAP) - safeTop));

  const desiredHeight = Math.min(MAX_MENU_HEIGHT, Math.max(1, optionsCount) * 40 + 16);
  const preferredBelowThreshold = Math.min(desiredHeight, MIN_BELOW_PREFERENCE);

  const placement =
    availableBelow >= preferredBelowThreshold || availableBelow >= availableAbove
      ? 'bottom'
      : 'top';

  const rawMaxHeight = placement === 'bottom' ? availableBelow : availableAbove;
  const maxHeight = Math.max(
    Math.min(MIN_SCROLLABLE_HEIGHT, rawMaxHeight || MIN_SCROLLABLE_HEIGHT),
    Math.min(MAX_MENU_HEIGHT, rawMaxHeight)
  );
  const scrollMaxHeight = Math.max(60, maxHeight - MENU_VERTICAL_PADDING);

  const maxAllowedWidth = Math.max(160, Math.floor(safeRight - safeLeft));
  const menuWidth = Math.min(
    Math.max(Math.round(triggerRect.width), 200),
    Math.min(280, maxAllowedWidth)
  );

  let left = align === 'left'
    ? triggerRect.left
    : triggerRect.right - menuWidth;
  left = Math.max(safeLeft, Math.min(left, safeRight - menuWidth));

  const style = {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    right: 'auto',
    width: `${Math.round(menuWidth)}px`,
    minWidth: `${Math.round(menuWidth)}px`,
    maxWidth: `${maxAllowedWidth}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
    zIndex: 1300
  };

  if (placement === 'top') {
    style.bottom = `${Math.round(layoutViewportHeight - (triggerRect.top - TRIGGER_GAP))}px`;
    style.top = 'auto';
  } else {
    style.top = `${Math.round(triggerRect.bottom + TRIGGER_GAP)}px`;
    style.bottom = 'auto';
  }

  return {
    placement,
    style,
    scrollAreaStyle: {
      maxHeight: `${Math.round(scrollMaxHeight)}px`,
      WebkitOverflowScrolling: 'touch'
    }
  };
};
