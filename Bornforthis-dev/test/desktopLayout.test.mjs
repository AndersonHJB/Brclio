import assert from 'node:assert/strict';
import test from 'node:test';
import { compactDesktopIcons } from '../src/components/desktopLayout.js';

test('compacts desktop icons and right-aligns an incomplete final row', () => {
  const icons = [
    { label: 'Design Skill', win: 'win-design-skill', style: { top: '24px', right: '114px' } },
    { label: 'Work With Me', style: { top: '294px', right: '114px' } },
    { label: 'Cola', style: { top: '384px', right: '114px' } },
    { label: '网页进化史', style: { top: '24px', right: '204px' } },
    { label: '写了就发', href: 'https://example.com', style: { top: '114px', right: '204px' } },
    { label: '我的AI教程', style: { top: '24px', right: '24px' } },
    { label: '生日快乐！', style: { top: '114px', right: '24px' } },
    { label: 'tutorials', style: { top: '204px', right: '24px' } },
  ];

  const compacted = compactDesktopIcons(icons);

  assert.deepEqual(
    compacted.map(({ label }) => label),
    ['网页进化史', 'Design Skill', '我的AI教程', '写了就发', '生日快乐！', 'tutorials', 'Work With Me', 'Cola'],
  );
  assert.deepEqual(
    compacted.map(({ style }) => style),
    [
      { top: '24px', right: '204px' },
      { top: '24px', right: '114px' },
      { top: '24px', right: '24px' },
      { top: '114px', right: '204px' },
      { top: '114px', right: '114px' },
      { top: '114px', right: '24px' },
      { top: '204px', right: '114px' },
      { top: '204px', right: '24px' },
    ],
  );
  assert.equal(new Set(compacted.map(({ style }) => `${style.top}:${style.right}`)).size, 8);
  assert.equal(compacted.find(({ label }) => label === 'Design Skill').win, 'win-design-skill');
  assert.equal(compacted.find(({ label }) => label === '写了就发').href, 'https://example.com');
  assert.equal(icons[1].style.top, '294px');
});

test('keeps full rows filled and right-aligns every incomplete row size', () => {
  const visualRights = ['204px', '114px', '24px'];
  const cases = [
    [0, []],
    [1, ['24px']],
    [2, ['114px', '24px']],
    [3, visualRights],
    [6, [...visualRights, ...visualRights]],
    [7, [...visualRights, ...visualRights, '24px']],
    [9, [...visualRights, ...visualRights, ...visualRights]],
  ];

  cases.forEach(([count, expectedRights]) => {
    const icons = Array.from({ length: count }, (_, index) => ({
      label: `项目 ${index + 1}`,
      style: {
        top: `${24 + Math.floor(index / 3) * 90}px`,
        right: visualRights[index % 3],
      },
    }));

    assert.deepEqual(
      compactDesktopIcons(icons).map(({ style }) => style.right),
      expectedRights,
      `${count} items`,
    );
  });
});
