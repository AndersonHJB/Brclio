export const WINDOW_KINDS = Object.freeze({
  FINDER: 'finder',
  ARTICLE: 'article',
  STANDARD: 'standard',
});

const WINDOW_CAPABILITIES = Object.freeze({
  [WINDOW_KINDS.FINDER]: Object.freeze({
    minimize: true,
    maximize: true,
    layoutMenu: false,
  }),
  [WINDOW_KINDS.ARTICLE]: Object.freeze({
    minimize: true,
    maximize: true,
    layoutMenu: true,
  }),
  [WINDOW_KINDS.STANDARD]: Object.freeze({
    minimize: false,
    maximize: false,
    layoutMenu: false,
  }),
});

export const ARTICLE_LAYOUTS = Object.freeze([
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'fill',
]);

const MIN_ARTICLE_WIDTH = 280;
const MIN_ARTICLE_HEIGHT = 200;
const ARTICLE_LAYOUT_GAP = 8;

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function getWindowCapabilities(kind = WINDOW_KINDS.STANDARD) {
  return WINDOW_CAPABILITIES[kind] ?? WINDOW_CAPABILITIES[WINDOW_KINDS.STANDARD];
}

export function articleWindowFrame({
  surfaceWidth,
  surfaceHeight,
  smallViewport = finiteNumber(surfaceWidth) <= 768,
}) {
  const width = Math.max(0, finiteNumber(surfaceWidth));
  const height = Math.max(0, finiteNumber(surfaceHeight));
  const sideInset = smallViewport ? 6 : 8;
  const topInset = smallViewport ? 6 : 8;
  const bottomInset = smallViewport ? 70 : 82;

  return {
    left: sideInset,
    top: topInset,
    width: Math.max(0, width - sideInset * 2),
    height: Math.max(0, height - topInset - bottomInset),
  };
}

function splitDimension(length) {
  const gap = Math.min(ARTICLE_LAYOUT_GAP, Math.max(0, length));
  const first = Math.max(0, Math.floor((length - gap) / 2));
  return {
    first,
    second: Math.max(0, length - gap - first),
    gap,
  };
}

export function availableArticleLayouts(frameInput) {
  const frame = articleWindowFrame(frameInput);
  const horizontal = splitDimension(frame.width);
  const vertical = splitDimension(frame.height);
  const layouts = ['center'];
  const supportsColumns = Math.min(horizontal.first, horizontal.second) >= MIN_ARTICLE_WIDTH;
  const supportsRows = Math.min(vertical.first, vertical.second) >= MIN_ARTICLE_HEIGHT;

  if (supportsColumns) layouts.push('left', 'right');
  if (supportsRows) layouts.push('top', 'bottom');
  if (supportsColumns && supportsRows) {
    layouts.push('top-left', 'top-right', 'bottom-left', 'bottom-right');
  }
  layouts.push('fill');

  return layouts;
}

export function clampArticleRect(rect, frameInput) {
  const frame = articleWindowFrame(frameInput);
  const width = Math.min(Math.max(0, finiteNumber(rect?.width)), frame.width);
  const height = Math.min(Math.max(0, finiteNumber(rect?.height)), frame.height);
  const maxLeft = frame.left + frame.width - width;
  const maxTop = frame.top + frame.height - height;

  return {
    left: Math.min(Math.max(finiteNumber(rect?.left, frame.left), frame.left), maxLeft),
    top: Math.min(Math.max(finiteNumber(rect?.top, frame.top), frame.top), maxTop),
    width,
    height,
  };
}

export function resolveArticleLayoutRect({
  layout,
  surfaceWidth,
  surfaceHeight,
  smallViewport = finiteNumber(surfaceWidth) <= 768,
  sourceRect,
}) {
  if (!ARTICLE_LAYOUTS.includes(layout)) {
    throw new RangeError(`Unsupported article layout: ${layout}`);
  }

  const frameInput = { surfaceWidth, surfaceHeight, smallViewport };
  const frame = articleWindowFrame(frameInput);
  const horizontal = splitDimension(frame.width);
  const vertical = splitDimension(frame.height);
  const rightLeft = frame.left + horizontal.first + horizontal.gap;
  const bottomTop = frame.top + vertical.first + vertical.gap;

  const rects = {
    fill: { ...frame },
    left: {
      left: frame.left,
      top: frame.top,
      width: horizontal.first,
      height: frame.height,
    },
    right: {
      left: rightLeft,
      top: frame.top,
      width: horizontal.second,
      height: frame.height,
    },
    top: {
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: vertical.first,
    },
    bottom: {
      left: frame.left,
      top: bottomTop,
      width: frame.width,
      height: vertical.second,
    },
    'top-left': {
      left: frame.left,
      top: frame.top,
      width: horizontal.first,
      height: vertical.first,
    },
    'top-right': {
      left: rightLeft,
      top: frame.top,
      width: horizontal.second,
      height: vertical.first,
    },
    'bottom-left': {
      left: frame.left,
      top: bottomTop,
      width: horizontal.first,
      height: vertical.second,
    },
    'bottom-right': {
      left: rightLeft,
      top: bottomTop,
      width: horizontal.second,
      height: vertical.second,
    },
  };

  if (layout !== 'center') return rects[layout];

  const centeredWidth = Math.min(
    Math.max(0, finiteNumber(sourceRect?.width, Math.min(700, frame.width))),
    frame.width,
  );
  const centeredHeight = Math.min(
    Math.max(0, finiteNumber(sourceRect?.height, Math.min(520, frame.height))),
    frame.height,
  );

  return {
    left: frame.left + Math.floor((frame.width - centeredWidth) / 2),
    top: frame.top + Math.floor((frame.height - centeredHeight) / 2),
    width: centeredWidth,
    height: centeredHeight,
  };
}
