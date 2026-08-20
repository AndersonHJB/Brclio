import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  buildPublicContent,
  createSitemapXml,
  generatePublicContent,
} from '../scripts/publicContent.mjs';

function writeFixture(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function findNode(nodes, sourcePath) {
  for (const node of nodes) {
    if (node.path === sourcePath) return node;
    if (node.type === 'directory') {
      const match = findNode(node.children, sourcePath);
      if (match) return match;
    }
  }
  return undefined;
}

test('starts at public subfolders, recurses, and prunes non-content directories', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'bornforthis-content-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const publicDir = join(projectRoot, 'public');

  writeFixture(join(publicDir, 'CNAME'), 'example.com\n');
  writeFixture(join(publicDir, 'root article.html'), '<title>Root &amp; Article</title>');
  writeFixture(
    join(publicDir, 'hidden.html'),
    '<meta content="nofollow, noindex" name="robots"><title>Hidden</title>',
  );
  writeFixture(
    join(publicDir, 'also-hidden.html'),
    '<head><!-- <meta name="robots" content="index"> --><meta name="robots" content="none"><title>Hidden</title></head>',
  );
  writeFixture(join(publicDir, 'images', 'cover.jpg'), 'not an article');
  writeFixture(join(publicDir, '专题', 'intro.html'), '<title>专题介绍</title>');
  writeFixture(join(publicDir, '专题', '第二 层', 'index.html'), '<title>第二层首页</title>');
  writeFixture(join(publicDir, '专题', '第二 层', '深层+文章.html'), '<title>深层文章</title>');

  const { tree, pages } = buildPublicContent(publicDir);
  assert.deepEqual(tree.map((node) => node.path), ['专题']);
  assert.equal(pages.length, 3);
  assert.equal(findNode(tree, 'images'), undefined);
  assert.equal(findNode(tree, 'hidden.html'), undefined);
  assert.equal(findNode(tree, 'also-hidden.html'), undefined);
  assert.equal(findNode(tree, 'root article.html'), undefined);

  const nestedFolder = findNode(tree, '专题/第二 层');
  assert.equal(nestedFolder.type, 'directory');
  assert.equal(nestedFolder.href, '%E4%B8%93%E9%A2%98/%E7%AC%AC%E4%BA%8C%20%E5%B1%82/');
  assert.equal(nestedFolder.children[0].path, '专题/第二 层/index.html');
  assert.equal(nestedFolder.children[0].href, '%E4%B8%93%E9%A2%98/%E7%AC%AC%E4%BA%8C%20%E5%B1%82/');

  const nestedArticle = findNode(tree, '专题/第二 层/深层+文章.html');
  assert.equal(
    nestedArticle.href,
    '%E4%B8%93%E9%A2%98/%E7%AC%AC%E4%BA%8C%20%E5%B1%82/%E6%B7%B1%E5%B1%82%2B%E6%96%87%E7%AB%A0.html',
  );
});

test('rejects a public/index.html that could overwrite the Vite homepage', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'bornforthis-reserved-index-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const publicDir = join(projectRoot, 'public');
  writeFixture(join(publicDir, 'index.html'), '<title>Conflicting homepage</title>');

  assert.throws(
    () => buildPublicContent(publicDir),
    /public\/index\.html is reserved by Vite/,
  );
});

test('uses the same discovered pages for sitemap generation', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'bornforthis-sitemap-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const publicDir = join(projectRoot, 'public');

  writeFixture(join(publicDir, 'CNAME'), 'example.com\n');
  writeFixture(join(publicDir, '文章', 'index.html'), '<title>文章</title>');
  writeFixture(join(publicDir, '文章', 'more+detail.html'), '<title>More</title>');
  writeFixture(join(publicDir, 'root-utility.html'), '<title>Root utility</title>');
  writeFixture(join(publicDir, '404.html'), '<meta name="robots" content="noindex"><title>404</title>');

  const { pages } = generatePublicContent({ publicDir });
  const sitemapPath = join(publicDir, 'sitemap.xml');
  const firstSitemap = readFileSync(sitemapPath, 'utf8');
  generatePublicContent({ publicDir });
  const secondSitemap = readFileSync(sitemapPath, 'utf8');

  assert.equal(firstSitemap, secondSitemap);
  assert.equal((firstSitemap.match(/<url><loc>/g) ?? []).length, pages.length + 1);
  assert.match(firstSitemap, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(firstSitemap, /<loc>https:\/\/example\.com\/%E6%96%87%E7%AB%A0\/<\/loc>/);
  assert.match(firstSitemap, /more%2Bdetail\.html/);
  assert.doesNotMatch(firstSitemap, /404\.html/);
  assert.doesNotMatch(firstSitemap, /root-utility\.html/);
});

test('escapes sitemap locations as XML', () => {
  const sitemap = createSitemapXml({
    siteUrl: 'https://example.com',
    pages: [{ href: 'article.html?one=1&two=2' }],
  });

  assert.match(sitemap, /article\.html\?one=1&amp;two=2/);
});
