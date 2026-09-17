export const FINDER_VIEWS = Object.freeze(['icon', 'list', 'column']);

export function isFinderView(value) {
  return FINDER_VIEWS.includes(value);
}

export function updateFinderSelection({
  orderedKeys,
  selectedKeys = [],
  clickedKey,
  anchorKey,
  commandKey = false,
  shiftKey = false,
}) {
  if (!orderedKeys.includes(clickedKey)) {
    return { selectedKeys: [...selectedKeys], anchorKey };
  }

  const current = new Set(selectedKeys);

  if (shiftKey) {
    const effectiveAnchor = orderedKeys.includes(anchorKey) ? anchorKey : clickedKey;
    const anchorIndex = orderedKeys.indexOf(effectiveAnchor);
    const clickedIndex = orderedKeys.indexOf(clickedKey);
    const start = Math.min(anchorIndex, clickedIndex);
    const end = Math.max(anchorIndex, clickedIndex);
    const range = orderedKeys.slice(start, end + 1);
    const next = commandKey ? new Set([...current, ...range]) : new Set(range);

    return { selectedKeys: [...next], anchorKey: effectiveAnchor };
  }

  if (commandKey) {
    if (current.has(clickedKey)) current.delete(clickedKey);
    else current.add(clickedKey);

    return { selectedKeys: [...current], anchorKey: clickedKey };
  }

  return { selectedKeys: [clickedKey], anchorKey: clickedKey };
}

export function nextFinderIndex({
  currentIndex,
  itemCount,
  key,
  columnCount = 1,
}) {
  if (itemCount <= 0) return -1;
  if (currentIndex < 0) return key === 'End' ? itemCount - 1 : 0;

  const columns = Math.max(1, columnCount);
  const lastIndex = itemCount - 1;

  if (key === 'Home') return 0;
  if (key === 'End') return lastIndex;
  if (key === 'ArrowLeft') return Math.max(0, currentIndex - 1);
  if (key === 'ArrowRight') return Math.min(lastIndex, currentIndex + 1);
  if (key === 'ArrowUp') return Math.max(0, currentIndex - columns);
  if (key === 'ArrowDown') return Math.min(lastIndex, currentIndex + columns);

  return currentIndex;
}

const finderCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function compareNullable(left, right) {
  if (left === right) return 0;
  if (left === undefined || left === null || left === '') return 1;
  if (right === undefined || right === null || right === '') return -1;
  return left < right ? -1 : 1;
}

export function sortFinderItems(items, sortKey = 'name', sortDirection = 'ascending') {
  const direction = sortDirection === 'descending' ? -1 : 1;

  return items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((leftEntry, rightEntry) => {
      const left = leftEntry.item;
      const right = rightEntry.item;
      let comparison = 0;

      if (sortKey === 'modified') {
        comparison = compareNullable(left.modified, right.modified);
      } else if (sortKey === 'size') {
        comparison = compareNullable(left.sizeBytes, right.sizeBytes);
      } else if (sortKey === 'kind') {
        comparison = finderCollator.compare(left.kind ?? '', right.kind ?? '');
      } else {
        comparison = finderCollator.compare(left.label ?? '', right.label ?? '');
      }

      if (comparison === 0) {
        comparison = finderCollator.compare(left.label ?? '', right.label ?? '');
      }
      if (comparison === 0) comparison = leftEntry.sourceIndex - rightEntry.sourceIndex;

      return comparison * direction;
    })
    .map(({ item }) => item);
}

