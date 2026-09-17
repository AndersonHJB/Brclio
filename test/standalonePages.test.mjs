import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Script } from 'node:vm';

const pages = new Map(
  ['about.html', 'infinite-canvas.html'].map((name) => [
    name,
    readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'),
  ]),
);

function attributes(source) {
  return Object.fromEntries(
    [...source.matchAll(/(?:^|\s)([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']),
  );
}

function scripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .map((match) => ({ attributes: attributes(match[1]), content: match[2] }));
}

function runtimeScript(html) {
  return scripts(html)
    .filter((script) => script.attributes.type !== 'application/json')
    .map((script) => script.content)
    .join('\n');
}

function embeddedJson(html, id) {
  const script = scripts(html).find((item) => item.attributes.id === id);
  assert.ok(script, `Missing embedded data: ${id}`);
  assert.equal(script.attributes.type, 'application/json');
  return JSON.parse(script.content);
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
}

for (const [name, html] of pages) {
  test(`${name} keeps scripts, styles, and page images inside the HTML`, () => {
    for (const script of scripts(html)) {
      if ('src' in script.attributes) {
        assert.match(script.attributes.src, /^data:/i, `${name}: external script`);
      }
    }

    for (const match of html.matchAll(/<(link|img)\b([^>]*)>/gi)) {
      const attrs = attributes(match[2]);
      const tag = match[1].toLowerCase();
      const isResourceLink = tag === 'link'
        && /(?:^|\s)(?:stylesheet|icon|preload|modulepreload)(?:\s|$)/i.test(attrs.rel ?? '');
      const resource = tag === 'img' ? attrs.src : isResourceLink ? attrs.href : undefined;
      if (resource) assert.match(resource, /^data:/i, `${name}: external ${tag} resource`);
    }

    const styles = [
      ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1]),
      ...[...html.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
        .map((match) => match[1] ?? match[2]),
    ].join('\n');
    for (const match of styles.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
      const resource = (match[1] ?? match[2] ?? match[3]).trim();
      assert.match(resource, /^(?:data:|#)/i, `${name}: external CSS URL`);
    }
    for (const match of styles.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
      assert.match(match[1] ?? match[2], /^data:/i, `${name}: external CSS import`);
    }
  });

  test(`${name} has valid inline JavaScript and JSON`, () => {
    const blocks = scripts(html);
    assert.ok(blocks.length > 0, `${name}: missing inline scripts`);
    blocks.forEach((script, index) => {
      if (script.attributes.type === 'application/json') {
        assert.doesNotThrow(() => JSON.parse(script.content), `${name}: invalid JSON block ${index}`);
      } else {
        assert.doesNotThrow(
          () => new Script(script.content, { filename: `${name}:script-${index}` }),
          `${name}: invalid runtime script ${index}`,
        );
      }
    });
  });
}

test('About preserves the supplied identity, experience, and book status', () => {
  const text = visibleText(pages.get('about.html'));
  for (const phrase of [
    '黄家宝 / AI悦创 / Bornforthis / Brclio',
    'Programmer · Educator · Author · Indie Hacker',
    'Programming × Education × AI',
    '2018–2020',
    '参与网易相关课程研发与技术研究',
    '北京航空航天大学出版社',
    '《编程启蒙：思维与代码》正式进入我的创作历程',
  ]) {
    assert.ok(text.includes(phrase), `Missing supplied About fact: ${phrase}`);
  }
});

test('About includes nine FAQ controls with corresponding answers', () => {
  const html = pages.get('about.html');
  const questions = [...html.matchAll(/<button\b([^>]*)>/gi)]
    .map((match) => attributes(match[1]))
    .filter((attrs) => (attrs.class ?? '').split(/\s+/).includes('faq-question'));
  assert.equal(questions.length, 9);
  assert.equal(new Set(questions.map((question) => question['aria-controls'])).size, 9);
  const ids = new Set([...html.matchAll(/\bid="([^"]*)"/g)].map((match) => match[1]));
  for (const question of questions) {
    assert.ok(ids.has(question['aria-controls']), `Missing FAQ answer: ${question['aria-controls']}`);
    assert.ok(['true', 'false'].includes(question['aria-expanded']));
  }
});

test('the archive retains all 128 essays and an embedded image for every image reference', () => {
  const html = pages.get('infinite-canvas.html');
  const data = embeddedJson(html, 'essayPageData');
  const assets = embeddedJson(html, 'essayAssetData');
  assert.equal(data.essay_list.length, 128);
  const references = [
    data.top_background,
    ...data.essay_list.flatMap((entry) => entry.image ?? []),
  ];
  assert.ok(references.length > 1, 'The archive should retain its supplied photographs');
  for (const reference of references) {
    assert.ok(Object.hasOwn(assets, reference), `Missing embedded image: ${reference}`);
    const match = assets[reference].match(/^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/);
    assert.ok(match, `Invalid image data URL: ${reference}`);
    const bytes = Buffer.from(match[1], 'base64');
    assert.ok(bytes.length > 0, `Empty embedded image: ${reference}`);
    assert.equal(bytes.toString('base64'), match[1], `Corrupt image encoding: ${reference}`);
  }
});

test('archive About links use the top-level hash route and keep file previews usable', () => {
  const script = runtimeScript(pages.get('infinite-canvas.html'));
  assert.match(script, /(?:getElementById|byId)\(["']topAbout["']\)/);
  assert.match(script, /(?:getElementById|byId)\(["']heroAbout["']\)/);
  assert.match(script, /link\.href\s*=\s*location\.protocol\s*===\s*["']file:["']\s*\?\s*["']about\.html["']\s*:\s*["']\.\/#about["']/);
  assert.match(script, /link\.target\s*=\s*location\.protocol\s*===\s*["']file:["']\s*\?\s*["']_self["']\s*:\s*["']_top["']/);
});

test('the archive observes reading progress without intercepting wheel or zoom gestures', () => {
  const html = pages.get('infinite-canvas.html');
  const script = runtimeScript(html);
  assert.doesNotMatch(script, /\b(?:wheel|mousewheel|DOMMouseScroll|gesturechange|zoomIn|zoomOut|canvasScale|panX|panY)\b/i);
  assert.doesNotMatch(script, /(?:scale(?:X|Y|3d)?\s*\(|\.style\.zoom\s*=)/i);
  assert.doesNotMatch(html, /\bon(?:wheel|mousewheel)\s*=/i);
  assert.match(script, /addEventListener\(["']scroll["']/);
});
