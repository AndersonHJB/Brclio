export const DESKTOP_GRID_START = 24;
export const DESKTOP_GRID_GAP = 90;

function coordinate(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function compactDesktopIcons(icons) {
  if (icons.length === 0) return [];

  const furthestRight = Math.max(
    ...icons.map((icon) => coordinate(icon.style?.right, DESKTOP_GRID_START)),
  );
  const columnCount = Math.max(
    1,
    Math.round((furthestRight - DESKTOP_GRID_START) / DESKTOP_GRID_GAP) + 1,
  );

  return icons
    .map((icon, sourceIndex) => ({ icon, sourceIndex }))
    .sort((a, b) => {
      const topDifference = coordinate(a.icon.style?.top) - coordinate(b.icon.style?.top);
      if (topDifference !== 0) return topDifference;

      const rightDifference = coordinate(b.icon.style?.right) - coordinate(a.icon.style?.right);
      return rightDifference || a.sourceIndex - b.sourceIndex;
    })
    .map(({ icon }, index) => {
      const row = Math.floor(index / columnCount);
      const column = index % columnCount;

      return {
        ...icon,
        style: {
          ...icon.style,
          top: `${DESKTOP_GRID_START + row * DESKTOP_GRID_GAP}px`,
          right: `${DESKTOP_GRID_START + (columnCount - column - 1) * DESKTOP_GRID_GAP}px`,
        },
      };
    });
}
