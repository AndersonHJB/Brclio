import {
  isFinderView,
  nextFinderIndex,
  sortFinderItems,
  updateFinderSelection,
} from './finderModel';

const FINDER_VIEW_STORAGE_KEY = 'bornforthis.finder.view';
const finderWindowStates = new WeakMap();
let finderInstanceCount = 0;

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function templateWindow(template) {
  return template?.content ? template.content.firstElementChild : template?.firstElementChild;
}

function readStoredView() {
  try {
    const storedView = window.localStorage.getItem(FINDER_VIEW_STORAGE_KEY);
    return isFinderView(storedView) ? storedView : 'icon';
  } catch {
    return 'icon';
  }
}

function storeView(view) {
  try {
    window.localStorage.setItem(FINDER_VIEW_STORAGE_KEY, view);
  } catch {
    // Finder remains fully usable when storage is unavailable.
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : dateFormatter.format(date);
}

function formatSize(value, itemCount) {
  if (Number.isFinite(itemCount)) return `${itemCount} 项`;
  if (!Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MB`;
}

function readItem(element) {
  const sizeBytes = Number(element.dataset.sizeBytes);
  const itemCount = Number(element.dataset.itemCount);

  return {
    key: element.dataset.itemKey,
    type: element.dataset.itemType,
    label: element.dataset.label,
    fileName: element.dataset.fileName,
    path: element.dataset.path,
    href: element.dataset.href,
    win: element.dataset.win,
    kind: element.dataset.kind || '项目',
    modified: element.dataset.modified || '',
    sizeBytes: element.dataset.sizeBytes === '' || !Number.isFinite(sizeBytes) ? undefined : sizeBytes,
    itemCount: element.dataset.itemCount === '' || !Number.isFinite(itemCount) ? undefined : itemCount,
    sourceElement: element,
  };
}

function readDirectory(templateId) {
  const template = document.getElementById(templateId);
  const sourceWindow = templateWindow(template);
  if (!sourceWindow?.classList.contains('finder-window')) return undefined;

  const sourceItems = sourceWindow.querySelector('.finder-items');

  return {
    id: templateId,
    title: sourceWindow.dataset.title || templateId,
    path: sourceWindow.dataset.finderPath || sourceWindow.dataset.title || templateId,
    parentId: sourceWindow.dataset.parentWindowId || undefined,
    items: sourceItems
      ? Array.from(sourceItems.children).filter((element) => element.classList.contains('finder-item')).map(readItem)
      : [],
  };
}

function renamedItem(item, state) {
  return {
    ...item,
    label: state.renamedItems.get(item.key) ?? item.label,
  };
}

function directoryTitle(directory, state) {
  return state.renamedDirectories.get(directory.id) ?? directory.title;
}

function sortedItems(directory, state) {
  return sortFinderItems(
    directory.items.map((item) => renamedItem(item, state)),
    state.sortKey,
    state.sortDirection,
  );
}

function directoryAncestors(directoryId) {
  const ancestors = [];
  const visited = new Set();
  let current = readDirectory(directoryId);

  while (current && !visited.has(current.id)) {
    ancestors.unshift(current);
    visited.add(current.id);
    current = current.parentId ? readDirectory(current.parentId) : undefined;
  }

  return ancestors;
}

function createTextElement(tagName, className, textValue) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = textValue;
  return element;
}

function isTextEntryTarget(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function elementItem(element) {
  return element ? readItem(element) : undefined;
}

function intersection(rectA, rectB) {
  return rectA.left < rectB.right
    && rectA.right > rectB.left
    && rectA.top < rectB.bottom
    && rectA.bottom > rectB.top;
}

export function initializeFinderWindow(finderWindow, rootTemplateId, {
  openIframeWindow,
  openTemplateWindow,
} = {}) {
  if (!finderWindow?.classList.contains('finder-window')) return undefined;
  if (finderWindowStates.has(finderWindow)) return finderWindowStates.get(finderWindow);

  const shell = finderWindow.querySelector('[data-finder-shell]');
  const content = finderWindow.querySelector('[data-finder-content]');
  const viewport = finderWindow.querySelector('[data-finder-viewport]');
  const pathbar = finderWindow.querySelector('[data-finder-pathbar]');
  const titleElement = finderWindow.querySelector('[data-finder-title]');
  const rootLabel = finderWindow.querySelector('[data-finder-root-label]');
  const statusElement = finderWindow.querySelector('[data-finder-status]');
  const listHeader = finderWindow.querySelector('[data-finder-list-header]');
  const contextMenu = finderWindow.querySelector('[data-finder-context-menu]');
  const quicklook = finderWindow.querySelector('[data-finder-quicklook]');
  const quicklookContent = finderWindow.querySelector('[data-finder-quicklook-content]');
  if (!shell || !content || !viewport || !pathbar || !statusElement || !listHeader) return undefined;

  const rootDirectory = readDirectory(rootTemplateId);
  if (!rootDirectory) return undefined;

  const state = {
    instanceId: ++finderInstanceCount,
    view: readStoredView(),
    rootId: rootTemplateId,
    currentId: rootTemplateId,
    history: [{ directoryId: rootTemplateId }],
    historyIndex: 0,
    directorySelections: new Map(),
    selected: new Set(),
    focusedKey: undefined,
    anchorKey: undefined,
    expanded: new Set(),
    renamedItems: new Map(),
    renamedDirectories: new Map(),
    sortKey: 'name',
    sortDirection: 'ascending',
    columnTrail: [{ directoryId: rootTemplateId, selectedKey: undefined }],
    activeColumn: 0,
    columnScrollTarget: 0,
    previewItem: undefined,
    contextKey: undefined,
    renaming: undefined,
    suppressBlankClick: false,
    lastColumnClick: undefined,
    suppressNativeDoubleClickUntil: 0,
    columnWidth: 210,
    listWidths: {
      name: 230,
      modified: 110,
      size: 70,
      kind: 96,
    },
    columnWidths: new Map(),
    columnScrollTops: new Map(),
    listScrollLeft: 0,
    renderSerial: 0,
  };
  finderWindowStates.set(finderWindow, state);

  function currentDirectory() {
    return readDirectory(state.currentId) ?? rootDirectory;
  }

  function visibleItems(container) {
    const scope = container ?? viewport;
    return Array.from(scope.querySelectorAll('.finder-item')).filter((item) => item.offsetParent !== null);
  }

  function activeItemElements() {
    if (state.view === 'column') {
      const column = viewport.querySelector(`.finder-column[data-column-index="${state.activeColumn}"]`);
      return column ? visibleItems(column) : [];
    }
    return visibleItems(viewport.querySelector('.finder-collection') ?? viewport);
  }

  function itemByKey(key) {
    if (!key) return undefined;
    const rendered = Array.from(viewport.querySelectorAll('.finder-item'))
      .find((item) => item.dataset.itemKey === key);
    if (rendered) return elementItem(rendered);

    for (const trailEntry of state.columnTrail) {
      const directory = readDirectory(trailEntry.directoryId);
      const sourceItem = directory?.items.find((item) => item.key === key);
      if (sourceItem) return renamedItem(sourceItem, state);
    }

    return currentDirectory().items
      .map((item) => renamedItem(item, state))
      .find((item) => item.key === key);
  }

  function directItemKeys(directoryId = state.currentId) {
    return new Set((readDirectory(directoryId)?.items ?? []).map((item) => item.key));
  }

  function normalizeSelectionToDirectory(directoryId = state.currentId) {
    const keys = directItemKeys(directoryId);
    state.selected = new Set([...state.selected].filter((key) => keys.has(key)));
    if (!keys.has(state.focusedKey)) state.focusedKey = [...state.selected][0];
    if (!keys.has(state.anchorKey)) state.anchorKey = state.focusedKey;
  }

  function columnContextForRenderedSelection() {
    if (state.selected.size !== 1) return undefined;
    const selectedKey = [...state.selected][0];
    const selectedElement = Array.from(viewport.querySelectorAll('.finder-item'))
      .find((candidate) => candidate.dataset.itemKey === selectedKey);
    const containerId = selectedElement?.dataset.directoryId;
    const item = elementItem(selectedElement);
    if (!containerId || !item) return undefined;

    const ancestorIds = directoryAncestors(containerId).map((directory) => directory.id);
    const currentIndex = ancestorIds.indexOf(state.currentId);
    if (currentIndex < 0) return undefined;
    const visibleDirectoryIds = ancestorIds.slice(currentIndex);
    const trail = visibleDirectoryIds.map((directoryId, index) => {
      const nextDirectoryId = visibleDirectoryIds[index + 1];
      const connector = nextDirectoryId
        ? readDirectory(directoryId)?.items.find((candidate) => candidate.win === nextDirectoryId)
        : undefined;
      return { directoryId, selectedKey: connector?.key };
    });

    const activeColumn = Math.max(0, trail.length - 1);
    trail[activeColumn].selectedKey = item.key;
    let previewItem;
    if (item.type === 'directory' && item.win) {
      trail.push({ directoryId: item.win, selectedKey: undefined });
    } else {
      previewItem = item;
    }

    return { trail, activeColumn, previewItem };
  }

  function updateCssWidths() {
    finderWindow.style.setProperty('--finder-name-width', `${state.listWidths.name}px`);
    finderWindow.style.setProperty('--finder-modified-width', `${state.listWidths.modified}px`);
    finderWindow.style.setProperty('--finder-size-width', `${state.listWidths.size}px`);
    finderWindow.style.setProperty('--finder-kind-width', `${state.listWidths.kind}px`);
    finderWindow.style.setProperty('--finder-column-width', `${state.columnWidth}px`);
  }

  function setActiveWindow() {
    finderWindow.parentElement?.querySelectorAll('.finder-window.is-active').forEach((windowElement) => {
      if (windowElement !== finderWindow) windowElement.classList.remove('is-active');
    });
    finderWindow.classList.add('is-active');
  }

  function cloneItem(item, {
    depth = 0,
    parentKey = '',
    columnIndex = 0,
    directoryId = state.currentId,
  } = {}) {
    const clone = item.sourceElement.cloneNode(true);
    const label = clone.querySelector('.folder-icon-label');
    const modified = clone.querySelector('.finder-item-modified');
    const size = clone.querySelector('.finder-item-size');
    const kind = clone.querySelector('.finder-item-kind');
    const disclosure = clone.querySelector('[data-finder-disclosure]');

    clone.dataset.label = item.label;
    clone.dataset.depth = String(depth);
    clone.dataset.parentKey = parentKey;
    clone.dataset.columnIndex = String(columnIndex);
    clone.dataset.directoryId = directoryId;
    clone.style.setProperty('--finder-depth', depth);
    clone.style.setProperty('--finder-indent', `${depth * 16}px`);
    clone.id = `finder-${state.instanceId}-item-${++state.renderSerial}`;
    if (label) label.textContent = item.label;
    if (modified) modified.textContent = formatDate(item.modified);
    if (size) size.textContent = formatSize(item.sizeBytes, item.itemCount);
    if (kind) kind.textContent = item.kind;
    if (disclosure) disclosure.setAttribute(
      'aria-expanded',
      String(state.view === 'list' && state.expanded.has(item.key)),
    );

    return clone;
  }

  function renderPathbar(directory) {
    pathbar.replaceChildren();
    const activeColumnDirectoryId = state.columnTrail[state.activeColumn]?.directoryId;
    const pathDirectory = state.view === 'column' && activeColumnDirectoryId
      ? readDirectory(activeColumnDirectoryId) ?? directory
      : directory;
    const ancestors = directoryAncestors(pathDirectory.id);

    ancestors.forEach((ancestor, index) => {
      if (index > 0) {
        const separator = createTextElement('span', 'finder-path-separator', '›');
        separator.setAttribute('aria-hidden', 'true');
        pathbar.appendChild(separator);
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.finderDirectory = ancestor.id;
      button.textContent = directoryTitle(ancestor, state);
      if (ancestor.id === pathDirectory.id) button.setAttribute('aria-current', 'location');
      pathbar.appendChild(button);
    });
  }

  function renderIconView(directory) {
    const collection = document.createElement('div');
    collection.className = 'finder-collection finder-icon-view';
    collection.dataset.directoryId = directory.id;
    collection.setAttribute('role', 'listbox');
    collection.setAttribute('aria-label', `${directoryTitle(directory, state)} 图标`);

    sortedItems(directory, state).forEach((item) => collection.appendChild(cloneItem(item, { directoryId: directory.id })));
    viewport.replaceChildren(collection);
    requestAnimationFrame(() => { viewport.scrollLeft = 0; });
  }

  function appendListBranch(collection, directory, depth = 0, parentKey = '') {
    sortedItems(directory, state).forEach((item) => {
      const row = cloneItem(item, { depth, parentKey, directoryId: directory.id });
      row.classList.add('finder-list-row');
      collection.appendChild(row);

      if (item.type === 'directory' && state.expanded.has(item.key) && item.win) {
        const childDirectory = readDirectory(item.win);
        if (childDirectory) appendListBranch(collection, childDirectory, depth + 1, item.key);
      }
    });
  }

  function renderListView(directory) {
    if (viewport.querySelector('.finder-list-view')) {
      state.listScrollLeft = viewport.scrollLeft;
    }
    const collection = document.createElement('div');
    collection.className = 'finder-collection finder-list-view';
    collection.dataset.directoryId = directory.id;
    collection.setAttribute('role', 'treegrid');
    collection.setAttribute('aria-label', `${directoryTitle(directory, state)} 列表`);
    appendListBranch(collection, directory);
    viewport.replaceChildren(collection);
    requestAnimationFrame(() => {
      viewport.scrollLeft = state.listScrollLeft;
      syncListHeaderScroll();
    });
  }

  function createPreview(item, compact = false) {
    const preview = document.createElement('div');
    preview.className = compact ? 'finder-column-preview' : 'finder-preview-card';
    const icon = item.sourceElement.querySelector('.folder-icon-art')?.cloneNode(true);
    if (icon) {
      icon.classList.add('finder-preview-icon');
      preview.appendChild(icon);
    }
    preview.appendChild(createTextElement('h3', 'finder-preview-title', item.label));

    const metadata = document.createElement('div');
    metadata.className = 'finder-preview-metadata';
    [
      ['种类', item.kind],
      ['大小', formatSize(item.sizeBytes, item.itemCount)],
      ['修改日期', formatDate(item.modified)],
      ['位置', item.path || currentDirectory().path],
    ].forEach(([term, description]) => {
      const row = document.createElement('div');
      row.appendChild(createTextElement('span', 'finder-preview-term', term));
      row.appendChild(createTextElement('span', 'finder-preview-value', description || '—'));
      metadata.appendChild(row);
    });
    preview.appendChild(metadata);
    return preview;
  }

  function renderColumnView(directory) {
    viewport.querySelectorAll('.finder-column[data-directory-id]').forEach((column) => {
      state.columnScrollTops.set(column.dataset.directoryId, column.scrollTop);
    });

    if (state.columnTrail.length === 0 || state.columnTrail[0].directoryId !== directory.id) {
      state.columnTrail = [{ directoryId: directory.id, selectedKey: undefined }];
      state.activeColumn = 0;
      state.columnScrollTarget = 0;
      state.previewItem = undefined;
    }

    const columns = document.createElement('div');
    columns.className = 'finder-columns';
    columns.setAttribute('role', 'listbox');
    columns.setAttribute('aria-label', `${directoryTitle(directory, state)} 分栏`);

    state.columnTrail.forEach((trailEntry, columnIndex) => {
      const columnDirectory = readDirectory(trailEntry.directoryId);
      if (!columnDirectory) return;

      const column = document.createElement('div');
      column.className = 'finder-column';
      column.dataset.directoryId = columnDirectory.id;
      column.dataset.columnIndex = String(columnIndex);
      column.style.setProperty(
        '--finder-current-column-width',
        `${state.columnWidths.get(columnDirectory.id) ?? state.columnWidth}px`,
      );

      sortedItems(columnDirectory, state).forEach((item) => {
        const row = cloneItem(item, { columnIndex, directoryId: columnDirectory.id });
        row.classList.add('finder-column-row');
        if (trailEntry.selectedKey === item.key) row.classList.add('is-path-selected');
        column.appendChild(row);
      });
      columns.appendChild(column);

      const resizer = document.createElement('span');
      resizer.className = 'finder-column-resizer';
      resizer.dataset.finderColumnResizer = '';
      resizer.dataset.columnIndex = String(columnIndex);
      resizer.dataset.directoryId = columnDirectory.id;
      resizer.setAttribute('aria-hidden', 'true');
      columns.appendChild(resizer);
    });

    if (state.previewItem) columns.appendChild(createPreview(renamedItem(state.previewItem, state), true));
    viewport.replaceChildren(columns);
    requestAnimationFrame(() => {
      columns.querySelectorAll('.finder-column[data-directory-id]').forEach((column) => {
        column.scrollTop = state.columnScrollTops.get(column.dataset.directoryId) ?? 0;
      });
      const requestedTarget = state.columnScrollTarget;
      const target = requestedTarget === 'end'
        ? columns.lastElementChild
        : columns.querySelector(`.finder-column[data-column-index="${requestedTarget ?? state.activeColumn}"]`);
      if (target) {
        const left = target.offsetLeft;
        const right = left + target.offsetWidth;
        if (left < columns.scrollLeft) columns.scrollLeft = left;
        else if (right > columns.scrollLeft + columns.clientWidth) {
          columns.scrollLeft = right - columns.clientWidth;
        }
      }
      state.columnScrollTarget = undefined;
    });
  }

  function updateToolbar(directory) {
    finderWindow.dataset.finderView = state.view;
    finderWindow.querySelectorAll('button[data-finder-view]').forEach((button) => {
      const active = button.dataset.finderView === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const backButton = finderWindow.querySelector('[data-finder-back]');
    const forwardButton = finderWindow.querySelector('[data-finder-forward]');
    if (backButton) backButton.disabled = state.historyIndex <= 0;
    if (forwardButton) forwardButton.disabled = state.historyIndex >= state.history.length - 1;

    const title = directoryTitle(directory, state);
    if (titleElement) titleElement.textContent = title;
    if (rootLabel) rootLabel.textContent = directoryTitle(rootDirectory, state);
    finderWindow.dataset.title = title;

    listHeader.setAttribute('aria-hidden', String(state.view !== 'list'));
    listHeader.querySelectorAll('[data-finder-sort]').forEach((button) => {
      const active = button.dataset.finderSort === state.sortKey;
      button.classList.toggle('is-sorted', active);
      button.setAttribute('aria-sort', active ? state.sortDirection : 'none');
      const indicator = button.querySelector('.finder-sort-indicator');
      if (indicator) {
        indicator.textContent = active
          ? state.sortDirection === 'ascending' ? '▲' : '▼'
          : '';
      }
    });
    syncListHeaderScroll();
  }

  function syncListHeaderScroll() {
    const offset = state.view === 'list' ? viewport.scrollLeft : 0;
    listHeader.style.transform = `translateX(${-offset}px)`;
  }

  function onViewportScroll() {
    if (state.view === 'list') state.listScrollLeft = viewport.scrollLeft;
    syncListHeaderScroll();
  }

  function syncSelection() {
    let focusedElement;
    viewport.querySelectorAll('.finder-item').forEach((itemElement) => {
      const selected = state.selected.has(itemElement.dataset.itemKey);
      const pathSelected = state.view === 'column' && state.columnTrail.some(
        (entry) => entry.selectedKey === itemElement.dataset.itemKey,
      );
      itemElement.classList.toggle('is-selected', selected);
      itemElement.classList.toggle('is-path-selected', pathSelected);
      itemElement.setAttribute('aria-selected', String(selected || pathSelected));
      itemElement.tabIndex = itemElement.dataset.itemKey === state.focusedKey ? 0 : -1;
      if (itemElement.dataset.itemKey === state.focusedKey) focusedElement = itemElement;
    });
    if (focusedElement) content.setAttribute('aria-activedescendant', focusedElement.id);
    else content.removeAttribute('aria-activedescendant');
  }

  function updateStatus(directory = currentDirectory()) {
    const activeItems = activeItemElements();
    const activeKeys = new Set(activeItems.map((item) => item.dataset.itemKey));
    const selectedCount = [...state.selected].filter((key) => activeKeys.has(key)).length;
    const activeDirectoryId = state.view === 'column'
      ? state.columnTrail[state.activeColumn]?.directoryId
      : directory.id;
    const statusDirectory = readDirectory(activeDirectoryId) ?? directory;
    const total = state.view === 'list'
      ? activeItems.length
      : sortedItems(statusDirectory, state).length;
    statusElement.textContent = selectedCount > 0
      ? `${selectedCount} 个已选择，共 ${total} 个项目`
      : `${total} 个项目`;
  }

  function render({ focusKey } = {}) {
    const directory = currentDirectory();
    state.renderSerial = 0;
    updateCssWidths();
    updateToolbar(directory);
    renderPathbar(directory);

    if (state.view === 'list') renderListView(directory);
    else if (state.view === 'column') renderColumnView(directory);
    else renderIconView(directory);

    syncSelection();
    updateStatus(directory);

    if (focusKey) {
      requestAnimationFrame(() => {
        const target = Array.from(viewport.querySelectorAll('.finder-item'))
          .find((item) => item.dataset.itemKey === focusKey);
        target?.focus({ preventScroll: true });
        const column = target?.closest('.finder-column');
        if (target && column) {
          const top = target.offsetTop;
          const bottom = top + target.offsetHeight;
          if (top < column.scrollTop) column.scrollTop = top;
          else if (bottom > column.scrollTop + column.clientHeight) {
            column.scrollTop = bottom - column.clientHeight;
          }
        } else {
          target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    }
  }

  function saveCurrentSelection() {
    const directKeys = directItemKeys();
    let selected = [...state.selected].filter((key) => directKeys.has(key));
    let focusedKey = directKeys.has(state.focusedKey) ? state.focusedKey : undefined;
    let anchorKey = directKeys.has(state.anchorKey) ? state.anchorKey : undefined;

    if (state.view === 'column' && state.activeColumn > 0) {
      const rootSelectionKey = state.columnTrail[0]?.selectedKey;
      selected = rootSelectionKey ? [rootSelectionKey] : [];
      focusedKey = rootSelectionKey;
      anchorKey = rootSelectionKey;
    }

    state.directorySelections.set(state.currentId, {
      selected: new Set(selected),
      focusedKey,
      anchorKey,
    });
  }

  function restoreSelection(directoryId) {
    const saved = state.directorySelections.get(directoryId);
    state.selected = new Set(saved?.selected ?? []);
    state.focusedKey = saved?.focusedKey;
    state.anchorKey = saved?.anchorKey;
  }

  function historySnapshot() {
    const renderedColumnContext = state.view === 'column'
      ? undefined
      : columnContextForRenderedSelection();
    const snapshotTrail = renderedColumnContext?.trail ?? state.columnTrail;
    const directKeys = directItemKeys();
    let selectedKeys = [...state.selected].filter((key) => directKeys.has(key));
    let focusedKey = directKeys.has(state.focusedKey) ? state.focusedKey : undefined;
    let anchorKey = directKeys.has(state.anchorKey) ? state.anchorKey : undefined;
    if (state.view === 'column' && state.activeColumn > 0) {
      const rootSelectionKey = state.columnTrail[0]?.selectedKey;
      selectedKeys = rootSelectionKey ? [rootSelectionKey] : [];
      focusedKey = rootSelectionKey;
      anchorKey = rootSelectionKey;
    }
    return {
      directoryId: state.currentId,
      view: state.view,
      selectedKeys,
      focusedKey,
      anchorKey,
      columnSelectedKeys: [...state.selected],
      columnFocusedKey: state.focusedKey,
      columnAnchorKey: state.anchorKey,
      columnTrail: snapshotTrail.map((entry) => ({ ...entry })),
      activeColumn: renderedColumnContext?.activeColumn ?? state.activeColumn,
      previewKey: renderedColumnContext?.previewItem?.key ?? state.previewItem?.key,
    };
  }

  function replaceCurrentHistoryEntry() {
    if (state.historyIndex < 0 || state.historyIndex >= state.history.length) return;
    state.history[state.historyIndex] = historySnapshot();
  }

  function restoreHistoryEntry(entry) {
    if (!entry || !readDirectory(entry.directoryId)) return false;
    state.currentId = entry.directoryId;
    const restoreColumnSelection = state.view === 'column' && Array.isArray(entry.columnSelectedKeys);
    const selectedKeys = restoreColumnSelection ? entry.columnSelectedKeys : entry.selectedKeys;
    if (Array.isArray(selectedKeys)) {
      state.selected = new Set(selectedKeys);
      state.focusedKey = restoreColumnSelection ? entry.columnFocusedKey : entry.focusedKey;
      state.anchorKey = restoreColumnSelection ? entry.columnAnchorKey : entry.anchorKey;
    } else {
      restoreSelection(state.currentId);
    }

    const savedTrail = Array.isArray(entry.columnTrail)
      ? entry.columnTrail.filter((trailEntry) => readDirectory(trailEntry.directoryId))
      : [];
    if (state.view === 'column' && savedTrail[0]?.directoryId === state.currentId) {
      state.columnTrail = savedTrail.map((trailEntry) => ({ ...trailEntry }));
      state.activeColumn = Math.min(
        Math.max(0, Number(entry.activeColumn) || 0),
        state.columnTrail.length - 1,
      );
      state.previewItem = itemByKey(entry.previewKey);
      state.columnScrollTarget = state.previewItem ? 'end' : state.activeColumn;
    } else {
      state.columnTrail = [{ directoryId: state.currentId, selectedKey: undefined }];
      state.activeColumn = 0;
      state.previewItem = undefined;
      state.columnScrollTarget = 0;
    }
    state.lastColumnClick = undefined;
    return true;
  }

  function navigateTo(directoryId, { historyMode = 'push' } = {}) {
    const targetDirectory = readDirectory(directoryId);
    if (!targetDirectory) return;
    if (directoryId === state.currentId && historyMode === 'push') {
      if (
        state.view === 'column'
        && (state.columnTrail.length > 1 || state.previewItem || state.columnTrail[0]?.selectedKey)
      ) {
        state.selected.clear();
        state.focusedKey = undefined;
        state.anchorKey = undefined;
        state.columnTrail = [{ directoryId, selectedKey: undefined }];
        state.activeColumn = 0;
        state.columnScrollTarget = 0;
        state.previewItem = undefined;
        state.lastColumnClick = undefined;
        render();
        replaceCurrentHistoryEntry();
      }
      content.focus({ preventScroll: true });
      return;
    }

    saveCurrentSelection();
    replaceCurrentHistoryEntry();

    state.currentId = directoryId;
    restoreSelection(directoryId);
    state.columnTrail = [{ directoryId, selectedKey: undefined }];
    state.activeColumn = 0;
    state.columnScrollTarget = 0;
    state.previewItem = undefined;
    state.lastColumnClick = undefined;
    if (historyMode === 'push') {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(historySnapshot());
      state.historyIndex = state.history.length - 1;
    }
    hideContextMenu();
    closeQuicklook();
    render();
    content.focus({ preventScroll: true });
  }

  function travelHistory(offset) {
    const nextIndex = state.historyIndex + offset;
    if (nextIndex < 0 || nextIndex >= state.history.length) return;
    saveCurrentSelection();
    replaceCurrentHistoryEntry();
    state.historyIndex = nextIndex;
    if (!restoreHistoryEntry(state.history[nextIndex])) return;
    render();
    content.focus({ preventScroll: true });
  }

  function setView(view) {
    if (!isFinderView(view) || view === state.view) return;
    const selectedColumnContext = view === 'column'
      ? columnContextForRenderedSelection()
      : undefined;
    let pushedDirectory = false;

    if (state.view === 'column' && view !== 'column') {
      const activeDirectoryId = state.columnTrail[state.activeColumn]?.directoryId;
      if (activeDirectoryId && activeDirectoryId !== state.currentId) {
        saveCurrentSelection();
        replaceCurrentHistoryEntry();
        state.currentId = activeDirectoryId;
        normalizeSelectionToDirectory(activeDirectoryId);
        state.directorySelections.set(activeDirectoryId, {
          selected: new Set(state.selected),
          focusedKey: state.focusedKey,
          anchorKey: state.anchorKey,
        });
        pushedDirectory = true;
      }
    }

    state.view = view;
    storeView(view);
    state.previewItem = undefined;
    state.lastColumnClick = undefined;
    state.columnTrail = [{ directoryId: state.currentId, selectedKey: undefined }];
    state.activeColumn = 0;
    state.columnScrollTarget = 0;

    if (view === 'column') {
      if (selectedColumnContext?.trail[0]?.directoryId === state.currentId) {
        state.columnTrail = selectedColumnContext.trail;
        state.activeColumn = selectedColumnContext.activeColumn;
        state.previewItem = selectedColumnContext.previewItem;
        state.columnScrollTarget = state.previewItem
          ? 'end'
          : Math.min(state.activeColumn + 1, state.columnTrail.length - 1);
      } else {
        normalizeSelectionToDirectory();
        if (state.selected.size === 1) {
          const selectedItem = itemByKey([...state.selected][0]);
          if (selectedItem?.type === 'directory' && selectedItem.win) {
            state.columnTrail[0].selectedKey = selectedItem.key;
            state.columnTrail.push({ directoryId: selectedItem.win, selectedKey: undefined });
            state.columnScrollTarget = 1;
          } else if (selectedItem) {
            state.columnTrail[0].selectedKey = selectedItem.key;
            state.previewItem = selectedItem;
            state.columnScrollTarget = 'end';
          }
        }
      }
    } else {
      normalizeSelectionToDirectory();
    }

    if (pushedDirectory) {
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(historySnapshot());
      state.historyIndex = state.history.length - 1;
    } else {
      replaceCurrentHistoryEntry();
    }

    render({ focusKey: state.focusedKey });
    content.focus({ preventScroll: true });
  }

  function selectElement(itemElement, event = {}) {
    const container = itemElement.closest('.finder-column, .finder-collection');
    const orderedKeys = visibleItems(container).map((item) => item.dataset.itemKey);
    const result = updateFinderSelection({
      orderedKeys,
      selectedKeys: [...state.selected].filter((key) => orderedKeys.includes(key)),
      clickedKey: itemElement.dataset.itemKey,
      anchorKey: state.anchorKey,
      commandKey: Boolean(event.metaKey),
      shiftKey: Boolean(event.shiftKey),
    });

    state.selected = new Set(result.selectedKeys);
    state.anchorKey = result.anchorKey;
    state.focusedKey = itemElement.dataset.itemKey;
    if (state.view === 'column') state.activeColumn = Number(itemElement.dataset.columnIndex) || 0;
    syncSelection();
    updateStatus();
  }

  function selectOnlyKey(key, { extend = false } = {}) {
    const itemElements = activeItemElements();
    const target = itemElements.find((item) => item.dataset.itemKey === key);
    if (!target) return;
    selectElement(target, { shiftKey: extend });
    target.focus({ preventScroll: false });
  }

  function activateItem(item, { newWindow = false } = {}) {
    if (!item) return;
    if (item.type === 'directory' && item.win) {
      if (newWindow) openTemplateWindow?.(item.win);
      else navigateTo(item.win);
      return;
    }
    if (item.win) {
      openTemplateWindow?.(item.win);
      return;
    }
    if (item.href) openIframeWindow?.(item.href, item.label);
  }

  function activateSelection() {
    const selectedItems = activeItemElements()
      .filter((element) => state.selected.has(element.dataset.itemKey))
      .map(elementItem);
    if (selectedItems.length === 0 && state.focusedKey) {
      const focusedItem = itemByKey(state.focusedKey);
      if (focusedItem) selectedItems.push(focusedItem);
    }
    selectedItems.forEach((item, index) => activateItem(item, { newWindow: index > 0 }));
  }

  function handleColumnChoice(itemElement, event) {
    const item = elementItem(itemElement);
    const columnIndex = Number(itemElement.dataset.columnIndex) || 0;
    state.activeColumn = columnIndex;
    state.columnTrail = state.columnTrail.slice(0, columnIndex + 1);

    if (event.metaKey || event.shiftKey || state.selected.size !== 1) {
      state.columnTrail[columnIndex].selectedKey = undefined;
      state.previewItem = undefined;
      state.columnScrollTarget = columnIndex;
      render({ focusKey: item.key });
      return;
    }

    state.columnTrail[columnIndex].selectedKey = item.key;
    state.previewItem = undefined;

    if (item.type === 'directory' && item.win) {
      state.columnTrail.push({ directoryId: item.win, selectedKey: undefined });
      state.columnScrollTarget = columnIndex + 1;
    } else {
      state.previewItem = item;
      state.columnScrollTarget = 'end';
    }
    render({ focusKey: item.key });
  }

  function toggleDisclosure(itemElement, forceExpanded) {
    const item = elementItem(itemElement);
    if (!item || item.type !== 'directory') return;
    const shouldExpand = forceExpanded ?? !state.expanded.has(item.key);
    if (shouldExpand) state.expanded.add(item.key);
    else state.expanded.delete(item.key);
    render({ focusKey: item.key });
  }

  function showQuicklook(item) {
    if (!item || !quicklook || !quicklookContent) return;
    quicklookContent.replaceChildren(createPreview(item));
    quicklook.hidden = false;
    finderWindow.classList.add('has-quicklook');
    finderWindow.querySelector('[data-finder-quicklook-close]')?.focus({ preventScroll: true });
  }

  function closeQuicklook() {
    if (!quicklook || quicklook.hidden) return;
    quicklook.hidden = true;
    finderWindow.classList.remove('has-quicklook');
    content.focus({ preventScroll: true });
  }

  function toggleQuicklook() {
    if (quicklook && !quicklook.hidden) {
      closeQuicklook();
      return;
    }
    const key = state.focusedKey ?? [...state.selected][0];
    showQuicklook(itemByKey(key));
  }

  function hideContextMenu() {
    if (!contextMenu) return;
    contextMenu.hidden = true;
    state.contextKey = undefined;
  }

  function showContextMenu(item, clientX, clientY) {
    if (!contextMenu || !item) return;
    state.contextKey = item.key;
    contextMenu.hidden = false;
    const windowRect = finderWindow.getBoundingClientRect();
    const left = Math.min(clientX - windowRect.left, finderWindow.clientWidth - 170);
    const top = Math.min(clientY - windowRect.top, finderWindow.clientHeight - 130);
    contextMenu.style.left = `${Math.max(8, left)}px`;
    contextMenu.style.top = `${Math.max(8, top)}px`;
  }

  function finishRename(commit) {
    const rename = state.renaming;
    if (!rename) return true;
    const nextLabel = rename.input.value.trim();

    if (commit) {
      const directoryId = rename.itemElement.closest('[data-directory-id]')?.dataset.directoryId
        ?? state.currentId;
      const directory = readDirectory(directoryId) ?? currentDirectory();
      const siblingLabels = directory.items
        .filter((item) => item.key !== rename.item.key)
        .map((item) => (state.renamedItems.get(item.key) ?? item.label).toLocaleLowerCase('zh-CN'));
      let error = '';
      if (!nextLabel) error = '名称不能为空';
      else if (nextLabel.includes(':')) error = '名称不能包含冒号';
      else if (nextLabel.startsWith('.')) error = '名称不能以句点开头';
      else if (siblingLabels.includes(nextLabel.toLocaleLowerCase('zh-CN'))) error = '同一位置已有同名项目';

      if (error) {
        rename.input.setAttribute('aria-invalid', 'true');
        rename.input.title = error;
        statusElement.textContent = error;
        rename.input.focus();
        rename.input.select();
        return false;
      }

      state.renamedItems.set(rename.item.key, nextLabel);
      if (rename.item.type === 'directory' && rename.item.win) {
        state.renamedDirectories.set(rename.item.win, nextLabel);
      }
    }

    state.renaming = undefined;
    render({ focusKey: rename.item.key });
    return true;
  }

  function beginRename(itemElement) {
    if (!itemElement || state.selected.size !== 1) return;
    if (state.renaming) finishRename(true);
    const item = elementItem(itemElement);
    const label = itemElement.querySelector('.folder-icon-label');
    if (!item || !label) return;

    const input = document.createElement('input');
    input.className = 'finder-rename-input';
    input.value = item.label;
    input.setAttribute('aria-label', `重命名 ${item.label}`);
    label.hidden = true;
    label.after(input);
    state.renaming = { item, itemElement, input };

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        finishRename(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finishRename(false);
      }
    });
    input.addEventListener('blur', () => {
      if (state.renaming?.input === input) finishRename(true);
    });
    input.focus();
    input.select();
  }

  function beginSelectedRename() {
    if (state.selected.size !== 1) return;
    const key = [...state.selected][0];
    const element = Array.from(viewport.querySelectorAll('.finder-item'))
      .find((candidate) => candidate.dataset.itemKey === key);
    beginRename(element);
  }

  function handleContextAction(action) {
    const item = itemByKey(state.contextKey ?? state.focusedKey ?? [...state.selected][0]);
    hideContextMenu();
    if (action === 'open') activateItem(item);
    else if (action === 'quicklook') showQuicklook(item);
    else if (action === 'rename') {
      const element = Array.from(viewport.querySelectorAll('.finder-item'))
        .find((candidate) => candidate.dataset.itemKey === item?.key);
      beginRename(element);
    }
  }

  function startMarquee(event) {
    if (
      state.view !== 'icon'
      || event.button !== 0
      || !event.target.closest('[data-finder-viewport]')
      || event.target.closest('.finder-item')
    ) return;
    const collection = viewport.querySelector('.finder-icon-view');
    if (!collection) return;

    event.preventDefault();
    content.focus({ preventScroll: true });
    const bounds = collection.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialSelection = event.metaKey ? new Set(state.selected) : new Set();
    const marquee = document.createElement('div');
    marquee.className = 'finder-selection-marquee';
    collection.appendChild(marquee);
    let moved = false;

    function onMove(moveEvent) {
      const left = Math.min(startX, moveEvent.clientX);
      const top = Math.min(startY, moveEvent.clientY);
      const right = Math.max(startX, moveEvent.clientX);
      const bottom = Math.max(startY, moveEvent.clientY);
      moved = moved || Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3;

      marquee.style.left = `${left - bounds.left + collection.scrollLeft}px`;
      marquee.style.top = `${top - bounds.top + collection.scrollTop}px`;
      marquee.style.width = `${right - left}px`;
      marquee.style.height = `${bottom - top}px`;

      const selectionRect = { left, top, right, bottom };
      const nextSelection = new Set(initialSelection);
      visibleItems(collection).forEach((item) => {
        if (intersection(selectionRect, item.getBoundingClientRect())) nextSelection.add(item.dataset.itemKey);
      });
      state.selected = nextSelection;
      state.focusedKey = [...nextSelection].at(-1);
      syncSelection();
      updateStatus();
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      marquee.remove();
      if (!moved && !event.metaKey) {
        state.selected.clear();
        state.focusedKey = undefined;
        state.anchorKey = undefined;
        syncSelection();
        updateStatus();
      } else if (moved) {
        state.anchorKey = state.focusedKey;
      }
      state.suppressBlankClick = true;
      window.setTimeout(() => { state.suppressBlankClick = false; }, 0);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function resizeListColumn(event, key) {
    if (!(key in state.listWidths)) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = state.listWidths[key];

    function onMove(moveEvent) {
      state.listWidths[key] = Math.max(key === 'name' ? 170 : 68, startWidth + moveEvent.clientX - startX);
      updateCssWidths();
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function resizeColumns(event, resizer) {
    const column = resizer?.previousElementSibling;
    const directoryId = resizer?.dataset.directoryId;
    if (!column?.classList.contains('finder-column') || !directoryId) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = column.getBoundingClientRect().width;
    function onMove(moveEvent) {
      const nextWidth = Math.max(150, Math.min(360, startWidth + moveEvent.clientX - startX));
      state.columnWidths.set(directoryId, nextWidth);
      column.style.setProperty('--finder-current-column-width', `${nextWidth}px`);
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function autoFitColumnWidth(resizer) {
    const column = resizer?.previousElementSibling;
    const directoryId = resizer?.dataset.directoryId;
    if (!column?.classList.contains('finder-column') || !directoryId) return;
    const longestLabelWidth = Array.from(column.querySelectorAll('.folder-icon-label')).reduce(
      (longest, label) => Math.max(longest, label.scrollWidth),
      0,
    );
    const nextWidth = Math.max(170, Math.min(360, longestLabelWidth + 70));
    state.columnWidths.set(directoryId, nextWidth);
    column.style.setProperty('--finder-current-column-width', `${nextWidth}px`);
  }

  function moveWithKeyboard(event) {
    const items = activeItemElements();
    if (state.view === 'column' && event.key === 'ArrowLeft' && state.activeColumn > 0) {
      state.activeColumn -= 1;
      state.columnScrollTarget = state.activeColumn;
      const parentKey = state.columnTrail[state.activeColumn]?.selectedKey;
      state.previewItem = undefined;
      if (state.columnTrail[state.activeColumn + 1]) {
        state.columnTrail[state.activeColumn + 1].selectedKey = undefined;
      }
      state.columnTrail = state.columnTrail.slice(0, state.activeColumn + 2);
      if (parentKey) selectOnlyKey(parentKey, { extend: event.shiftKey });
      render({ focusKey: parentKey });
      return;
    }

    if (items.length === 0) return;
    let currentIndex = items.findIndex((item) => item.dataset.itemKey === state.focusedKey);

    if (state.view === 'list' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && currentIndex >= 0) {
      const current = items[currentIndex];
      const item = elementItem(current);
      if (item?.type === 'directory') {
        if (event.key === 'ArrowRight' && !state.expanded.has(item.key)) {
          toggleDisclosure(current, true);
          return;
        }
        if (event.key === 'ArrowLeft' && state.expanded.has(item.key)) {
          toggleDisclosure(current, false);
          return;
        }
      }
      if (event.key === 'ArrowLeft' && current.dataset.parentKey) {
        selectOnlyKey(current.dataset.parentKey, { extend: event.shiftKey });
        return;
      }
      if (event.key === 'ArrowRight' && item?.type === 'directory') {
        const firstChild = items[currentIndex + 1];
        if (firstChild?.dataset.parentKey === item.key) {
          selectElement(firstChild, { shiftKey: event.shiftKey });
          firstChild.focus({ preventScroll: false });
        }
      }
      return;
    }

    if (state.view === 'column' && event.key === 'ArrowRight' && currentIndex >= 0) {
      const current = items[currentIndex];
      const item = elementItem(current);
      if (item?.type === 'directory' && item.win) {
        handleColumnChoice(current, {});
        state.activeColumn = Math.min(state.activeColumn + 1, state.columnTrail.length - 1);
        state.columnScrollTarget = state.activeColumn;
        render({ focusKey: state.focusedKey });
        requestAnimationFrame(() => {
          const nextColumnItems = activeItemElements();
          if (nextColumnItems[0]) {
            selectElement(nextColumnItems[0]);
            handleColumnChoice(nextColumnItems[0], {});
          }
        });
        return;
      }
    }

    if (state.view === 'column' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;

    let columnCount = 1;
    if (state.view === 'icon') {
      const firstTop = items[0]?.offsetTop;
      columnCount = Math.max(1, items.filter((item) => item.offsetTop === firstTop).length);
    }
    const navigationKey = state.view === 'list' || state.view === 'column'
      ? event.key === 'ArrowLeft' ? 'ArrowUp' : event.key === 'ArrowRight' ? 'ArrowDown' : event.key
      : event.key;
    const nextIndex = nextFinderIndex({
      currentIndex,
      itemCount: items.length,
      key: navigationKey,
      columnCount,
    });
    const next = items[nextIndex];
    if (next) selectElement(next, { shiftKey: event.shiftKey });
    if (next && state.view === 'column') handleColumnChoice(next, { shiftKey: event.shiftKey });
    else next?.focus({ preventScroll: false });
  }

  function onClick(event) {
    setActiveWindow();
    if (state.suppressBlankClick && event.target.closest('[data-finder-viewport]')) {
      state.suppressBlankClick = false;
      return;
    }
    if (event.target.closest('[data-finder-column-resizer]')) return;

    const viewButton = event.target.closest('button[data-finder-view]');
    if (viewButton) {
      setView(viewButton.dataset.finderView);
      return;
    }
    if (event.target.closest('[data-finder-back]')) {
      travelHistory(-1);
      return;
    }
    if (event.target.closest('[data-finder-forward]')) {
      travelHistory(1);
      return;
    }
    if (event.target.closest('[data-finder-root]')) {
      navigateTo(state.rootId);
      return;
    }
    const pathButton = event.target.closest('[data-finder-directory]');
    if (pathButton) {
      navigateTo(pathButton.dataset.finderDirectory);
      return;
    }
    const quicklookClose = event.target.closest('[data-finder-quicklook-close]');
    if (quicklookClose) {
      closeQuicklook();
      return;
    }
    if (event.target === quicklook) {
      closeQuicklook();
      return;
    }
    const contextAction = event.target.closest('[data-finder-action]');
    if (contextAction) {
      handleContextAction(contextAction.dataset.finderAction);
      return;
    }
    const sortButton = event.target.closest('[data-finder-sort]');
    if (sortButton && !event.target.closest('[data-finder-list-resizer]')) {
      const nextKey = sortButton.dataset.finderSort;
      if (state.sortKey === nextKey) {
        state.sortDirection = state.sortDirection === 'ascending' ? 'descending' : 'ascending';
      } else {
        state.sortKey = nextKey;
        state.sortDirection = 'ascending';
      }
      render({ focusKey: state.focusedKey });
      return;
    }
    const disclosure = event.target.closest('[data-finder-disclosure]');
    if (disclosure) {
      event.stopPropagation();
      const itemElement = disclosure.closest('.finder-item');
      selectElement(itemElement, event);
      if (state.view === 'column') handleColumnChoice(itemElement, event);
      else toggleDisclosure(itemElement);
      return;
    }

    const itemElement = event.target.closest('.finder-item');
    if (itemElement && finderWindow.contains(itemElement)) {
      const item = elementItem(itemElement);
      const now = performance.now();
      const clickKey = `${itemElement.dataset.directoryId}\u0000${itemElement.dataset.itemKey}`;
      const previousClick = state.lastColumnClick;
      const isColumnDoubleClick = state.view === 'column'
        && event.button === 0
        && !event.shiftKey
        && previousClick?.key === clickKey
        && previousClick.commandKey === event.metaKey
        && now - previousClick.time <= 500
        && Math.hypot(event.clientX - previousClick.x, event.clientY - previousClick.y) <= 8;

      state.lastColumnClick = state.view === 'column'
        && event.button === 0
        && !event.shiftKey
        && !isColumnDoubleClick
        ? {
            key: clickKey,
            time: now,
            x: event.clientX,
            y: event.clientY,
            commandKey: event.metaKey,
          }
        : undefined;
      hideContextMenu();
      content.focus({ preventScroll: true });
      selectElement(itemElement, event);
      if (isColumnDoubleClick) {
        state.suppressNativeDoubleClickUntil = now + 100;
        activateItem(item, { newWindow: event.metaKey });
      } else if (state.view === 'column') {
        handleColumnChoice(itemElement, event);
      }
      return;
    }

    if (event.target.closest('.finder-column-preview')) {
      hideContextMenu();
      return;
    }

    if (!state.suppressBlankClick && event.target.closest('[data-finder-viewport]')) {
      const clickedColumn = state.view === 'column'
        ? event.target.closest('.finder-column')
        : undefined;
      if (state.view === 'column' && !clickedColumn && event.target.closest('.finder-columns')) {
        content.focus({ preventScroll: true });
        return;
      }
      state.selected.clear();
      state.focusedKey = undefined;
      state.anchorKey = undefined;
      hideContextMenu();
      if (state.view === 'column') {
        state.lastColumnClick = undefined;
        const columnIndex = clickedColumn ? Number(clickedColumn.dataset.columnIndex) || 0 : 0;
        state.activeColumn = columnIndex;
        state.columnScrollTarget = columnIndex;
        state.columnTrail = state.columnTrail.slice(0, columnIndex + 1);
        if (state.columnTrail[columnIndex]) state.columnTrail[columnIndex].selectedKey = undefined;
        state.previewItem = undefined;
        render();
      } else {
        syncSelection();
        updateStatus();
      }
      content.focus({ preventScroll: true });
    } else if (!event.target.closest('[data-finder-context-menu]')) {
      hideContextMenu();
    }
  }

  function onDoubleClick(event) {
    if (state.view === 'column' && performance.now() <= state.suppressNativeDoubleClickUntil) return;
    const resizer = event.target.closest('[data-finder-column-resizer]');
    if (resizer) {
      event.preventDefault();
      event.stopPropagation();
      autoFitColumnWidth(resizer);
      return;
    }
    const itemElement = event.target.closest('.finder-item');
    if (!itemElement || event.target.closest('[data-finder-disclosure], input')) return;
    event.preventDefault();
    event.stopPropagation();
    activateItem(elementItem(itemElement), { newWindow: event.metaKey });
  }

  function onContextMenu(event) {
    const itemElement = event.target.closest('.finder-item');
    if (!itemElement) return;
    event.preventDefault();
    event.stopPropagation();
    if (!state.selected.has(itemElement.dataset.itemKey)) selectElement(itemElement);
    if (state.view === 'column' && state.selected.size === 1) handleColumnChoice(itemElement, {});
    showContextMenu(elementItem(itemElement), event.clientX, event.clientY);
  }

  function onKeyDown(event) {
    if (isTextEntryTarget(event.target)) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    const commandKey = event.metaKey;
    const normalizedKey = event.key.toLowerCase();

    if (commandKey && ['1', '2', '3'].includes(event.key)) {
      event.preventDefault();
      setView({ 1: 'icon', 2: 'list', 3: 'column' }[event.key]);
      return;
    }
    if (commandKey && normalizedKey === 'a') {
      event.preventDefault();
      if (event.shiftKey) state.selected.clear();
      else state.selected = new Set(activeItemElements().map((item) => item.dataset.itemKey));
      state.focusedKey = [...state.selected][0];
      state.anchorKey = state.focusedKey;
      if (state.view === 'column') {
        state.columnTrail = state.columnTrail.slice(0, state.activeColumn + 1);
        if (state.columnTrail[state.activeColumn]) {
          state.columnTrail[state.activeColumn].selectedKey = undefined;
        }
        state.previewItem = undefined;
        state.columnScrollTarget = state.activeColumn;
        state.lastColumnClick = undefined;
        render({ focusKey: state.focusedKey });
      } else {
        syncSelection();
        updateStatus();
      }
      return;
    }
    if (commandKey && (normalizedKey === 'o' || event.key === 'ArrowDown')) {
      event.preventDefault();
      activateSelection();
      return;
    }
    if (commandKey && event.key === 'ArrowUp') {
      event.preventDefault();
      const columnDirectoryId = state.columnTrail[state.activeColumn]?.directoryId;
      const baseDirectory = state.view === 'column' && columnDirectoryId
        ? readDirectory(columnDirectoryId) ?? currentDirectory()
        : currentDirectory();
      const parentId = baseDirectory.parentId;
      if (parentId) navigateTo(parentId);
      return;
    }
    if (commandKey && event.key === '[') {
      event.preventDefault();
      travelHistory(-1);
      return;
    }
    if (commandKey && event.key === ']') {
      event.preventDefault();
      travelHistory(1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      beginSelectedRename();
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      toggleQuicklook();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (quicklook && !quicklook.hidden) closeQuicklook();
      else if (contextMenu && !contextMenu.hidden) hideContextMenu();
      else {
        state.selected.clear();
        state.focusedKey = undefined;
        state.anchorKey = undefined;
        if (state.view === 'column') {
          state.columnTrail = state.columnTrail.slice(0, state.activeColumn + 1);
          if (state.columnTrail[state.activeColumn]) {
            state.columnTrail[state.activeColumn].selectedKey = undefined;
          }
          state.previewItem = undefined;
          state.columnScrollTarget = state.activeColumn;
          state.lastColumnClick = undefined;
          render();
        } else {
          syncSelection();
          updateStatus();
        }
      }
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      moveWithKeyboard(event);
    }
  }

  function onQuicklookKeyDown(event) {
    if (event.key !== 'Escape' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    closeQuicklook();
  }

  function onPointerDown(event) {
    setActiveWindow();
    const listResizer = event.target.closest('[data-finder-list-resizer]');
    if (listResizer) {
      resizeListColumn(event, listResizer.dataset.finderListResizer);
      return;
    }
    const columnResizer = event.target.closest('[data-finder-column-resizer]');
    if (columnResizer) {
      resizeColumns(event, columnResizer);
      return;
    }
    startMarquee(event);
  }

  finderWindow.addEventListener('click', onClick);
  finderWindow.addEventListener('dblclick', onDoubleClick);
  finderWindow.addEventListener('contextmenu', onContextMenu);
  finderWindow.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('scroll', onViewportScroll, { passive: true });
  content.addEventListener('keydown', onKeyDown);
  quicklook?.addEventListener('keydown', onQuicklookKeyDown);

  setActiveWindow();
  render();

  return state;
}

export function finderWindowState(finderWindow) {
  return finderWindowStates.get(finderWindow);
}
