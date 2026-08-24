import assert from 'node:assert/strict';
import test from 'node:test';
import {
  articleWindowFrame,
  availableArticleLayouts,
  clampArticleRect,
  getWindowCapabilities,
  resolveArticleLayoutRect,
  WINDOW_KINDS,
} from '../src/lib/windowBehaviorModel.js';

test('keeps Finder, article, and standard window capabilities isolated', () => {
  assert.deepEqual(getWindowCapabilities(WINDOW_KINDS.FINDER), {
    minimize: true,
    maximize: true,
    layoutMenu: false,
  });
  assert.deepEqual(getWindowCapabilities(WINDOW_KINDS.ARTICLE), {
    minimize: true,
    maximize: true,
    layoutMenu: true,
  });
  assert.deepEqual(getWindowCapabilities(WINDOW_KINDS.STANDARD), {
    minimize: false,
    maximize: false,
    layoutMenu: false,
  });
  assert.deepEqual(getWindowCapabilities('unknown'), getWindowCapabilities(WINDOW_KINDS.STANDARD));
});

test('uses the existing desktop safe area for full-screen article windows', () => {
  assert.deepEqual(articleWindowFrame({ surfaceWidth: 1200, surfaceHeight: 900 }), {
    left: 8,
    top: 8,
    width: 1184,
    height: 810,
  });
  assert.deepEqual(articleWindowFrame({
    surfaceWidth: 390,
    surfaceHeight: 844,
    smallViewport: true,
  }), {
    left: 6,
    top: 6,
    width: 378,
    height: 768,
  });
});

test('removes layouts that would make an article unreadable on narrow viewports', () => {
  assert.deepEqual(
    availableArticleLayouts({ surfaceWidth: 1200, surfaceHeight: 900 }),
    [
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
    ],
  );
  assert.deepEqual(
    availableArticleLayouts({ surfaceWidth: 390, surfaceHeight: 844, smallViewport: true }),
    ['center', 'top', 'bottom', 'fill'],
  );
  assert.deepEqual(
    availableArticleLayouts({ surfaceWidth: 844, surfaceHeight: 390 }),
    ['center', 'left', 'right', 'fill'],
  );
});

test('resolves full-screen and split layouts without crossing the safe frame', () => {
  const input = { surfaceWidth: 1200, surfaceHeight: 900 };
  const fill = resolveArticleLayoutRect({ layout: 'fill', ...input });
  const left = resolveArticleLayoutRect({ layout: 'left', ...input });
  const right = resolveArticleLayoutRect({ layout: 'right', ...input });
  const bottomRight = resolveArticleLayoutRect({ layout: 'bottom-right', ...input });

  assert.deepEqual(fill, { left: 8, top: 8, width: 1184, height: 810 });
  assert.equal(left.left, fill.left);
  assert.equal(right.left + right.width, fill.left + fill.width);
  assert.equal(right.left - (left.left + left.width), 8);
  assert.equal(bottomRight.left + bottomRight.width, fill.left + fill.width);
  assert.equal(bottomRight.top + bottomRight.height, fill.top + fill.height);
});

test('centers and restores article geometry while clamping it after a viewport change', () => {
  const centered = resolveArticleLayoutRect({
    layout: 'center',
    surfaceWidth: 1200,
    surfaceHeight: 900,
    sourceRect: { left: 900, top: 600, width: 700, height: 520 },
  });
  assert.deepEqual(centered, { left: 250, top: 153, width: 700, height: 520 });

  assert.deepEqual(
    clampArticleRect(
      { left: 900, top: 700, width: 700, height: 520 },
      { surfaceWidth: 390, surfaceHeight: 844, smallViewport: true },
    ),
    { left: 6, top: 254, width: 378, height: 520 },
  );
});

test('rejects unknown article layouts', () => {
  assert.throws(
    () => resolveArticleLayoutRect({ layout: 'diagonal', surfaceWidth: 1200, surfaceHeight: 900 }),
    /Unsupported article layout/,
  );
});
