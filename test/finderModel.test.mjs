import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FINDER_VIEWS,
  isFinderView,
  nextFinderIndex,
  sortFinderItems,
  updateFinderSelection,
} from '../src/lib/finderModel.js';

test('recognizes exactly the three Finder view modes', () => {
  assert.deepEqual(FINDER_VIEWS, ['icon', 'list', 'column']);
  assert.equal(isFinderView('icon'), true);
  assert.equal(isFinderView('list'), true);
  assert.equal(isFinderView('column'), true);
  assert.equal(isFinderView('grid'), false);
  assert.equal(isFinderView(undefined), false);
});

test('models Finder single, Command, and Shift selection semantics', () => {
  const orderedKeys = ['a', 'b', 'c', 'd', 'e'];

  const single = updateFinderSelection({ orderedKeys, clickedKey: 'b' });
  assert.deepEqual(single, { selectedKeys: ['b'], anchorKey: 'b' });

  const commandAdd = updateFinderSelection({
    orderedKeys,
    selectedKeys: single.selectedKeys,
    clickedKey: 'd',
    anchorKey: single.anchorKey,
    commandKey: true,
  });
  assert.deepEqual(commandAdd, { selectedKeys: ['b', 'd'], anchorKey: 'd' });

  const commandRemove = updateFinderSelection({
    orderedKeys,
    selectedKeys: commandAdd.selectedKeys,
    clickedKey: 'b',
    anchorKey: commandAdd.anchorKey,
    commandKey: true,
  });
  assert.deepEqual(commandRemove, { selectedKeys: ['d'], anchorKey: 'b' });

  const shiftRange = updateFinderSelection({
    orderedKeys,
    selectedKeys: commandRemove.selectedKeys,
    clickedKey: 'e',
    anchorKey: commandRemove.anchorKey,
    shiftKey: true,
  });
  assert.deepEqual(shiftRange, { selectedKeys: ['b', 'c', 'd', 'e'], anchorKey: 'b' });

  const additiveRange = updateFinderSelection({
    orderedKeys,
    selectedKeys: ['a'],
    clickedKey: 'd',
    anchorKey: 'c',
    commandKey: true,
    shiftKey: true,
  });
  assert.deepEqual(additiveRange, { selectedKeys: ['a', 'c', 'd'], anchorKey: 'c' });
});

test('moves through icon grids without escaping the available items', () => {
  const move = (currentIndex, key) => nextFinderIndex({
    currentIndex,
    itemCount: 10,
    key,
    columnCount: 4,
  });

  assert.equal(move(-1, 'ArrowRight'), 0);
  assert.equal(move(5, 'ArrowLeft'), 4);
  assert.equal(move(5, 'ArrowRight'), 6);
  assert.equal(move(5, 'ArrowUp'), 1);
  assert.equal(move(5, 'ArrowDown'), 9);
  assert.equal(move(9, 'ArrowDown'), 9);
  assert.equal(move(2, 'Home'), 0);
  assert.equal(move(2, 'End'), 9);
});

test('sorts Finder items by the active visual column without mutating source data', () => {
  const items = [
    { label: '项目 10', kind: '文件夹', modified: '2026-01-03', sizeBytes: undefined },
    { label: '项目 2', kind: 'HTML 文稿', modified: '2026-01-01', sizeBytes: 2048 },
    { label: 'Alpha', kind: 'HTML 文稿', modified: '2026-01-02', sizeBytes: 512 },
  ];

  assert.deepEqual(sortFinderItems(items).map((item) => item.label), ['项目 2', '项目 10', 'Alpha']);
  assert.deepEqual(
    sortFinderItems(items, 'modified', 'descending').map((item) => item.label),
    ['项目 10', 'Alpha', '项目 2'],
  );
  assert.deepEqual(
    sortFinderItems(items, 'size', 'ascending').map((item) => item.label),
    ['Alpha', '项目 2', '项目 10'],
  );
  assert.deepEqual(items.map((item) => item.label), ['项目 10', '项目 2', 'Alpha']);
});
