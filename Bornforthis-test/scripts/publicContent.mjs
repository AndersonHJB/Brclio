import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

const HTML_EXTENSION = /\.html$/i;
const TITLE_ELEMENT = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const HEAD_ELEMENT = /<head\b[^>]*>([\s\S]*?)<\/head>/i;
const META_ELEMENT = /<meta\b[^>]*>/gi;
const HTML_TAG = /<[^>]*>/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

const collator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function toPosixPath(filePath) {
  return filePath.split(sep).join('/');
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, token) => {
    if (token[0] !== '#') return namedEntities[token.toLowerCase()] ?? entity;

    const isHex = token[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(codePoint)) return entity;

    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  });
}

function readAttribute(tag, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attribute = new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    'i',
  ).exec(tag);

  return attribute?.[1] ?? attribute?.[2] ?? attribute?.[3];
}

function hasNoIndexDirective(html) {
  const documentHead = HEAD_ELEMENT.exec(html)?.[1] ?? html;
  const metaElements = documentHead.replace(HTML_COMMENT, '').match(META_ELEMENT) ?? [];

  return metaElements.some((meta) => {
    const name = readAttribute(meta, 'name')?.toLowerCase();
    if (name !== 'robots' && name !== 'googlebot') return false;

    const directives = readAttribute(meta, 'content')
      ?.toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);

    return directives?.some((directive) => directive === 'noindex' || directive === 'none') ?? false;
  });
}

function readHtmlTitle(html, fallback) {
  const title = TITLE_ELEMENT.exec(html)?.[1];
  if (!title) return fallback;

  return decodeHtmlEntities(title.replace(HTML_TAG, '').replace(/\s+/g, ' ').trim()) || fallback;
}

function fallbackLabel(fileName, relativeDirectory) {
  if (fileName.toLowerCase() === 'index.html') {
    return basename(relativeDirectory) || '首页';
  }

  return fileName.replace(HTML_EXTENSION, '');
}

export function encodePublicPath(relativePath) {
  return toPosixPath(relativePath)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function htmlHref(sourcePath) {
  const encodedPath = encodePublicPath(sourcePath);
  return basename(sourcePath).toLowerCase() === 'index.html'
    ? `${encodedPath.slice(0, -'index.html'.length)}`
    : encodedPath;
}

function folderWindowId(sourcePath) {
  return `content-folder-${Buffer.from(sourcePath).toString('base64url')}`;
}

function compareNodes(left, right) {
  const rank = (node) => {
    if (node.type === 'file' && node.name.toLowerCase() === 'index.html') return 0;
    return node.type === 'directory' ? 1 : 2;
  };
  const rankDifference = rank(left) - rank(right);
  if (rankDifference !== 0) return rankDifference;

  return collator.compare(left.name, right.name) || collator.compare(left.path, right.path);
}

function walkDirectory(publicDir, absoluteDirectory, relativeDirectory = '') {
  const nodes = [];
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((left, right) => collator.compare(left.name, right.name));

  for (const entry of entries) {
    const absolutePath = join(absoluteDirectory, entry.name);
    const sourcePath = toPosixPath(relative(publicDir, absolutePath));

    if (entry.isDirectory()) {
      const children = walkDirectory(publicDir, absolutePath, sourcePath);
      if (children.length === 0) continue;

      nodes.push({
        type: 'directory',
        name: entry.name,
        label: entry.name,
        path: sourcePath,
        href: `${encodePublicPath(sourcePath)}/`,
        windowId: folderWindowId(sourcePath),
        children,
      });
      continue;
    }

    if (!entry.isFile() || !HTML_EXTENSION.test(entry.name)) continue;
    if (sourcePath.toLowerCase() === 'index.html') continue;

    const html = readFileSync(absolutePath, 'utf8');
    if (hasNoIndexDirective(html)) continue;

    const fallback = fallbackLabel(entry.name, relativeDirectory);
    nodes.push({
      type: 'file',
      name: entry.name,
      label: readHtmlTitle(html, fallback),
      path: sourcePath,
      href: htmlHref(sourcePath),
    });
  }

  return nodes.sort(compareNodes);
}

function walkContentRoots(publicDir) {
  const roots = [];
  const entries = readdirSync(publicDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((left, right) => collator.compare(left.name, right.name));

  for (const entry of entries) {
    const sourcePath = entry.name;
    const children = walkDirectory(publicDir, join(publicDir, entry.name), sourcePath);
    if (children.length === 0) continue;

    roots.push({
      type: 'directory',
      name: entry.name,
      label: entry.name,
      path: sourcePath,
      href: `${encodePublicPath(sourcePath)}/`,
      windowId: folderWindowId(sourcePath),
      children,
    });
  }

  return roots.sort(compareNodes);
}

export function flattenHtmlPages(nodes) {
  return nodes.flatMap((node) => (
    node.type === 'file' ? [node] : flattenHtmlPages(node.children)
  ));
}

export function buildPublicContent(publicDir) {
  if (!existsSync(publicDir)) {
    throw new Error(`Public directory does not exist: ${publicDir}`);
  }
  if (existsSync(join(publicDir, 'index.html'))) {
    throw new Error(
      'public/index.html is reserved by Vite. Put root-level articles under another HTML filename.',
    );
  }

  const tree = walkContentRoots(publicDir);
  const pages = flattenHtmlPages(tree).sort((left, right) => collator.compare(left.href, right.href));

  return { tree, pages };
}

export function readSiteUrl(publicDir) {
  const cnameFile = join(publicDir, 'CNAME');
  if (!existsSync(cnameFile)) {
    throw new Error('Cannot generate sitemap.xml without public/CNAME or an explicit site URL.');
  }

  const hostname = readFileSync(cnameFile, 'utf8').trim().split(/\s+/)[0];
  if (!hostname) throw new Error('public/CNAME is empty.');

  return /^https?:\/\//i.test(hostname) ? hostname : `https://${hostname}`;
}

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sitemapEntry(location) {
  return `  <url><loc>${xmlEscape(location)}</loc></url>`;
}

export function createSitemapXml({ siteUrl, pages }) {
  const baseUrl = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`);
  const entries = [sitemapEntry(baseUrl.href)];

  for (const page of pages) {
    entries.push(sitemapEntry(new URL(page.href, baseUrl).href));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

export function writeFileIfChanged(filePath, contents) {
  if (existsSync(filePath) && readFileSync(filePath, 'utf8') === contents) return false;
  writeFileSync(filePath, contents);
  return true;
}

export function generatePublicContent({ publicDir, siteUrl }) {
  const content = buildPublicContent(publicDir);
  const sitemap = createSitemapXml({
    siteUrl: siteUrl ?? readSiteUrl(publicDir),
    pages: content.pages,
  });

  writeFileIfChanged(join(publicDir, 'sitemap.xml'), sitemap);
  return content;
}
