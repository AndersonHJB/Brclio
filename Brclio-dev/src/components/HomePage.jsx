import {
  desktopIcons,
  wallpaperStars,
  workflowColumns,
  workDimensions,
} from './homeData';
import {
  compactDesktopIcons,
  DESKTOP_GRID_GAP,
  DESKTOP_GRID_START,
} from './desktopLayout';
import publicContentTree from 'virtual:public-content';

const DESKTOP_GRID_ROWS = 7;

function positionKey(style) {
  return `${style.top}:${style.right}`;
}

function automaticDesktopIcons(nodes, fixedIcons) {
  const occupiedPositions = new Set(fixedIcons.map((icon) => positionKey(icon.style)));
  const availablePositions = [];

  for (let column = 0; availablePositions.length < nodes.length; column += 1) {
    for (let row = 0; row < DESKTOP_GRID_ROWS; row += 1) {
      const style = {
        top: `${DESKTOP_GRID_START + row * DESKTOP_GRID_GAP}px`,
        right: `${DESKTOP_GRID_START + column * DESKTOP_GRID_GAP}px`,
      };
      if (!occupiedPositions.has(positionKey(style))) availablePositions.push(style);
    }
  }

  return nodes.map((node, index) => {
    const birthday = node.type === 'directory' && node.path === 'happy-birthday';

    return {
      id: `public:${node.path}`,
      type: node.type,
      href: node.type === 'file' ? node.href : undefined,
      win: node.type === 'directory' ? node.windowId : undefined,
      finderDirectory: node.type === 'directory',
      style: availablePositions[index],
      artClassName: birthday
        ? 'dicon-art birthday-icon'
        : `dicon-art ${node.type === 'directory' ? 'folder' : 'file ext-html'}`,
      extension: node.type === 'file' ? '.html' : undefined,
      label: birthday ? '生日快乐！' : node.label,
      birthday,
      automatic: true,
    };
  });
}

const publicDesktopIcons = automaticDesktopIcons(publicContentTree, desktopIcons);
const allDesktopIcons = compactDesktopIcons([...desktopIcons, ...publicDesktopIcons]);
const desktopFolderLocations = allDesktopIcons
  .filter((icon) => icon.type === 'directory' && icon.win)
  .map((icon) => ({
    id: icon.win,
    label: icon.label,
    action: icon.finderDirectory ? 'navigate' : 'window',
  }));

function DesktopIcon({ icon }) {
  return (
    <div
      className={`dicon${icon.automatic ? ' auto-content-icon' : ''}`}
      data-href={icon.href}
      data-win={icon.win}
      style={icon.style}
      title={icon.automatic ? icon.label : undefined}
    >
      <div className={icon.artClassName} data-ext={icon.extension}>
        {icon.image && <img src={icon.image.src} alt={icon.image.alt} loading="lazy" />}
        {icon.birthday && <span className="birthday-icon-mark">B</span>}
      </div>
      <div className="dicon-label">{icon.label}</div>
    </div>
  );
}

function FinderGlyph({ name }) {
  if (name === 'back' || name === 'forward') {
    const points = name === 'back' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
    return <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points={points} /></svg>;
  }

  if (name === 'icon') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
  }

  if (name === 'list') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r=".8" /><circle cx="4.5" cy="12" r=".8" /><circle cx="4.5" cy="18" r=".8" /></svg>;
  }

  if (name === 'column') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /><line x1="15" y1="4" x2="15" y2="20" /></svg>;
  }

  if (name === 'folder') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l1.7 2H20.5v8.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" /><path d="M3.5 9.5V5.7A1.7 1.7 0 0 1 5.2 4h4.1l2 2.2h7.5a1.7 1.7 0 0 1 1.7 1.7v1.6" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20h-6v-5h-4v5H4Z" /></svg>;
}

function FinderItem({
  href,
  win,
  extension,
  label,
  name,
  path,
  modified,
  sizeBytes,
  itemCount,
  kind,
  folder = false,
}) {
  const itemKind = kind ?? (folder ? '文件夹' : extension === '.git' ? 'Git 仓库' : 'HTML 文稿');
  const itemKey = path ?? href ?? win ?? label;

  return (
    <div
      className="finder-item"
      data-href={href}
      data-win={win}
      data-item-key={itemKey}
      data-item-type={folder ? 'directory' : 'file'}
      data-label={label}
      data-file-name={name ?? label}
      data-path={path ?? href ?? ''}
      data-kind={itemKind}
      data-modified={modified}
      data-size-bytes={sizeBytes}
      data-item-count={itemCount}
      role="option"
      aria-selected="false"
      tabIndex={-1}
    >
      {folder && (
        <button className="finder-disclosure" type="button" data-finder-disclosure aria-label={`展开 ${label}`} aria-expanded="false">
          <FinderGlyph name="forward" />
        </button>
      )}
      <div
        className={folder
          ? 'folder-icon-art folder'
          : `folder-icon-art file${extension === '.git' ? ' ext-git' : ' ext-html'}`}
        data-ext={folder ? undefined : extension}
      ></div>
      <div className="folder-icon-label">{label}</div>
      <div className="finder-item-modified" aria-hidden="true"></div>
      <div className="finder-item-size" aria-hidden="true"></div>
      <div className="finder-item-kind" aria-hidden="true">{itemKind}</div>
    </div>
  );
}

function FinderWindow({ title, url, path, parentWindowId, children }) {
  return (
    <div
      className="os-window finder-window"
      data-title={title}
      data-url={url}
      data-finder-path={path ?? title}
      data-parent-window-id={parentWindowId}
      data-finder-view="icon"
    >
      <div className="os-body finder-shell" data-finder-shell>
        <header className="finder-toolbar">
          <div className="finder-history-controls" role="group" aria-label="浏览历史">
            <button type="button" data-finder-back aria-label="返回" title="返回 (⌘[)" disabled><FinderGlyph name="back" /></button>
            <button type="button" data-finder-forward aria-label="前进" title="前进 (⌘])" disabled><FinderGlyph name="forward" /></button>
          </div>
          <div className="finder-window-title" data-finder-title>{title}</div>
          <div className="finder-view-switcher" role="group" aria-label="显示方式">
            <button type="button" data-finder-view="icon" aria-label="图标视图" title="图标视图 (⌘1)" aria-pressed="true"><FinderGlyph name="icon" /></button>
            <button type="button" data-finder-view="list" aria-label="列表视图" title="列表视图 (⌘2)" aria-pressed="false"><FinderGlyph name="list" /></button>
            <button type="button" data-finder-view="column" aria-label="分栏视图" title="分栏视图 (⌘3)" aria-pressed="false"><FinderGlyph name="column" /></button>
          </div>
        </header>

        <div className="finder-main">
          <aside className="finder-sidebar" aria-label="Finder 边栏">
            <div className="finder-sidebar-label">桌面文件夹</div>
            <div className="finder-sidebar-locations">
              {desktopFolderLocations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className="finder-sidebar-location"
                  data-finder-location={location.id}
                  data-finder-location-action={location.action}
                  data-finder-location-label={location.label}
                  title={location.action === 'window' ? `打开 ${location.label} 窗口` : `前往 ${location.label}`}
                >
                  <FinderGlyph name="folder" />
                  <span>{location.label}</span>
                </button>
              ))}
            </div>
            <div className="finder-sidebar-help"><kbd>⌘1–3</kbd><span>切换视图</span></div>
          </aside>

          <section className="finder-content" data-finder-content tabIndex={0} aria-label={`${title} 项目`}>
            <nav className="finder-path" data-finder-pathbar aria-label="当前位置"></nav>
            <div className="finder-list-header" data-finder-list-header aria-hidden="true">
              {[
                ['name', '名称'],
                ['modified', '修改日期'],
                ['size', '大小'],
                ['kind', '种类'],
              ].map(([sortKey, sortLabel]) => (
                <button key={sortKey} type="button" data-finder-sort={sortKey}>
                  <span>{sortLabel}</span><span className="finder-sort-indicator" aria-hidden="true"></span><span className="finder-list-resizer" data-finder-list-resizer={sortKey}></span>
                </button>
              ))}
            </div>
            <div className="finder-viewport" data-finder-viewport>
              <div className="finder-items" data-finder-directory-id>{children}</div>
            </div>
          </section>
        </div>

        <footer className="finder-footer">
          <nav className="finder-footer-path" data-finder-footer-pathbar aria-label="路径栏"></nav>
          <div className="finder-statusbar">
            <span data-finder-status aria-live="polite"></span>
            <span className="finder-status-hint">双击打开 · Return 重命名 · 空格快速查看</span>
          </div>
        </footer>

        <div className="finder-context-menu" data-finder-context-menu hidden>
          <button type="button" data-finder-action="open">打开</button>
          <button type="button" data-finder-action="quicklook">快速查看</button>
          <span className="finder-menu-rule" aria-hidden="true"></span>
          <button type="button" data-finder-action="rename">重命名</button>
        </div>

        <div className="finder-quicklook" data-finder-quicklook hidden>
          <div className="finder-quicklook-card" role="dialog" aria-modal="true" aria-label="快速查看">
            <button type="button" className="finder-quicklook-close" data-finder-quicklook-close aria-label="关闭快速查看">×</button>
            <div data-finder-quicklook-content></div>
          </div>
        </div>
        <span className="finder-attribution" aria-hidden="true">ESTHER不二 · esther-design-system · CC BY-NC-SA 4.0</span>
      </div>
    </div>
  );
}

function ContentFolderTemplate({ folder, parentWindowId }) {
  const nestedFolders = folder.children.filter((child) => child.type === 'directory');

  return (
    <>
      <div id={folder.windowId} className="window-template" style={{ display: 'none' }}>
        <FinderWindow title={folder.label} url={folder.href} path={folder.path} parentWindowId={parentWindowId}>
          {folder.children.map((child) => (
            child.type === 'directory'
              ? <FinderItem key={child.path} win={child.windowId} label={child.label} name={child.name} path={child.path} modified={child.modified} itemCount={child.itemCount} folder />
              : <FinderItem key={child.path} href={child.href} extension=".html" label={child.label} name={child.name} path={child.path} modified={child.modified} sizeBytes={child.sizeBytes} />
          ))}
        </FinderWindow>
      </div>
      {nestedFolders.map((child) => <ContentFolderTemplate key={child.path} folder={child} parentWindowId={folder.windowId} />)}
    </>
  );
}

function ContentFolderTemplates() {
  return publicContentTree
    .filter((node) => node.type === 'directory')
    .map((folder) => <ContentFolderTemplate key={folder.path} folder={folder} />);
}

function WindowTemplates() {
  return (
    <>
      <div id="win-sayhi" className="window-template" style={{ display: 'none' }}>
        <div className="os-window" data-title="Work With Me" data-url="aiyuechuang@gmail.com">
          <div className="os-body win-sayhi">
            <div className="sayhi-heading">Work With Me ✨</div>
            <div className="sayhi-sub">1 person + AI = 1 team</div>
            <div className="services-grid">
              <div className="service-card">
                <div className="service-icon">📱</div>
                <div className="service-title">AI 自媒体</div>
                <div className="service-desc">带货 / 商单推广 / 品牌共创<br />小红书 @ESTHER不二</div>
              </div>
              <div className="service-card">
                <div className="service-icon">🏫</div>
                <div className="service-title">AI 企业培训</div>
                <div className="service-desc">AI 工具落地 / Agent 工作流<br />带团队从 0 用起来</div>
              </div>
            </div>
            <div className="sayhi-links">
              <span>📮 <a href="mailto:aiyuechuang@gmail.com">aiyuechuang@gmail.com</a></span>
              <span>📕 <a href="https://xhslink.cn/o/59VwcmP2rEz" target="_blank">小红书</a></span>
            </div>
          </div>
        </div>
      </div>

      <div id="win-design-skill" className="window-template" style={{ display: 'none' }}>
        <FinderWindow title="Design Skill" url="hiesther.me/tutorials/esther-design-system" path="Design Skill">
          <FinderItem href="tutorials/esther-design-system/" extension=".html" label="Design Skill介绍" />
          <FinderItem href="tutorials/esther-design-system/demo-readme-cards.html" extension=".html" label="Demo ReadMe Cards" />
          <FinderItem href="tutorials/esther-design-system/design-skill-story.html" extension=".html" label="如何做出 Design Skill" />
          <FinderItem href="tutorials/esther-design-system/components-preview.html" extension=".html" label="设计组件库" />
          <FinderItem href="https://github.com/esthersjw/esther-design-system" extension=".git" kind="Git 仓库" label="GitHub Repo" />
        </FinderWindow>
      </div>

      <div id="win-website-history" className="window-template" style={{ display: 'none' }}>
        <FinderWindow title="网页进化史" url="hiesther.me" path="网页进化史">
          <FinderItem href="website-ver1.html" extension=".html" label="Ver 1 — 初代个人网页" />
          <FinderItem href="website-ver2.html" extension=".html" label="Ver 2 — 终端穿越×无限白板" />
          <FinderItem win="win-ver3-cola" extension=".html" label="Ver 3 — 当前版本" />
          <FinderItem href="hero-playground.html" extension=".html" label="Playground" />
        </FinderWindow>
      </div>

      <div id="win-ver3-cola" className="window-template" style={{ display: 'none' }}>
        <div className="os-window" data-title="⚠️" data-url="" style={{ width: '340px' }}>
          <div className="os-body" style={{ padding: '36px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', marginBottom: '20px' }}>⚠️</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px' }}>无法打开 "Ver 3"</div>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, marginBottom: '24px' }}>因为你已经在 Ver 3 里面了。<br />请勿套娃🙅</div>
            <div data-close-window style={{ display: 'inline-block', background: '#2B7FD8', color: '#fff', padding: '8px 28px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>好吧，我知道了</div>
          </div>
        </div>
      </div>

      <div id="win-cola" className="window-template" style={{ display: 'none' }}>
        <div className="os-window cola-window" data-title="Cola" data-url="colaos.ai">
          <div className="os-body" style={{ padding: 0, maxHeight: 'none', height: '100%', overflow: 'hidden' }}>
            <div className="cola-inner">
              <div className="cola-sidebar">
                <div className="cola-sidebar-avatar"><img src="cola-avatar.png" alt="Cola" loading="lazy" /></div>
                <div className="cola-sidebar-mic">
                  <svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
                </div>
              </div>
              <div className="cola-main">
                <div className="cola-topbar">
                  <span className="cola-tab active">对话</span><span className="cola-tab">交付</span><span className="cola-tab">闹钟</span><span className="cola-tab">心迹</span><span className="cola-tab">接入</span>
                </div>
                <div className="cola-search">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" fill="none" stroke="#aaa" strokeWidth="2" /><path d="M21 21l-4.35-4.35" fill="none" stroke="#aaa" strokeWidth="2" /></svg>
                  <span>搜索聊天记录...</span>
                </div>
                <div className="cola-chat">
                  <div className="cola-msg-user"><div className="cola-bubble">Cola,跟来看我网站的人打个招呼吧</div></div>
                  <div className="cola-msg-bot">
                    <div className="cola-bot-avatar"><img src="cola-avatar.png" alt="Cola" loading="lazy" /></div>
                    <div className="cola-bot-content"><div className="cola-mutter">被 cue 到了。</div><div>嘿。我是 Cola,不二的 Agent 伙伴。<br /><br />她搭这个网站的时候我全程在,从选色到写码到凌晨三点还在跟我吵配色方案。<br /><br />你想知道关于她的什么都可以问我--经历、正在做的事、怎么跟 AI 协作的、或者单纯好奇她是什么样的人。<br /><br />我比她客气一点,但也只是一点。</div></div>
                  </div>
                  <div className="cola-msg-user"><div className="cola-bubble">差不多得了😂 就这样吧,别太自由发挥</div></div>
                  <div className="cola-msg-bot">
                    <div className="cola-bot-avatar"><img src="cola-avatar.png" alt="Cola" loading="lazy" /></div>
                    <div className="cola-bot-content"><div className="cola-mutter">收到,嘴巴拉链拉上。</div><div>随时来聊。</div></div>
                  </div>
                </div>
                <div className="cola-input-bar">
                  <div className="cola-input-container">
                    <div className="cola-input-text">输入消息...</div>
                    <div className="cola-input-toolbar">
                      <div className="cola-toolbar-left">
                        <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M16 12v1a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" /></svg>
                      </div>
                      <div className="cola-toolbar-right"><span className="cola-model-tag">Max</span><div className="cola-send-btn"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg></div></div>
                    </div>
                    <div className="cola-coming-soon"><a href="https://colaos.ai" target="_blank" style={{ color: 'inherit', textDecoration: 'none' }}>coming soon - 正在接入中 ✨</a></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ContentFolderTemplates />
    </>
  );
}

function HomeTab() {
  return (
    <main className="tab-page active" id="page-home">
      <section className="hero-section" id="heroSection">
        <div className="macbook-wrapper" id="macbookWrapper">
          <div className="macbook-screen-bezel" id="macbookBezel">
            <div className="macbook-notch"></div>
            <div className="macbook-screen" id="macbookScreen"><div className="terminal" id="terminal"><div className="terminal-titlebar"><span className="terminal-dot red"></span><span className="terminal-dot yellow"></span><span className="terminal-dot green"></span><span className="terminal-title">esther@universe ~ zsh</span></div><div id="terminalLines"></div></div></div>
          </div>
          <div className="macbook-hinge"></div><div className="macbook-base"></div><div className="macbook-shadow"></div>
        </div>
        <div className="hero-cta" id="heroCta"><div className="cta-text">Press Enter to Launch</div><div className="cta-arrow">↓</div></div>
      </section>

      <div className="desktop" id="desktop">
        <div className="desktop-menubar"><span className="mb-logo">esther OS</span><span className="mb-item">About</span><span className="mb-item">Values</span><span className="mb-item">Now</span><span className="mb-clock" id="mbClock">--:--</span></div>
        <div className="desktop-surface" id="desktopSurface">
          {wallpaperStars.map((style, index) => <span key={index} className="wp-star" style={style}>✦</span>)}
          <div className="desktop-sticker" id="buerSticker"><img src="brclio-sticker.png" alt="不二" /></div>
          <div className="desktop-icons">{allDesktopIcons.map((icon) => <DesktopIcon key={icon.id ?? icon.label} icon={icon} />)}</div>
          <WindowTemplates />
        </div>
      </div>

      <section className="exit-section" id="exitSection">
        <div className="exit-sticky" id="exitSticky">
          <div className="exit-canvas-content" id="exitCanvasContent" style={{ display: 'none' }}></div>
          <div className="exit-macbook-wrapper" id="exitMacbook" style={{ opacity: 1 }}>
            <div className="exit-bezel" id="exitBezel"><div className="exit-notch"></div><div className="exit-screen" id="exitScreen"><div className="goodbye-screen" id="goodbyeScreen">
              <div className="goodbye-titlebar"><span className="terminal-dot red"></span><span className="terminal-dot yellow"></span><span className="terminal-dot green"></span><span className="goodbye-title-text">esther@universe ~ zsh</span></div>
              <div className="goodbye-body"><div className="goodbye-terminal">
                <div className="gt-line"><span className="gt-prompt">$ </span><span className="gt-cmd">echo "see you"</span></div><div className="gt-line gt-output">See you next time.</div><div className="gt-line">&nbsp;</div>
                <div className="gt-line"><span className="gt-prompt">$ </span><span className="gt-cmd">cat contact.md</span></div><div className="gt-line gt-output">📮 <a href="mailto:aiyuechuang@gmail.com">aiyuechuang@gmail.com</a></div><div className="gt-line gt-output">📕 小红书 <a href="https://xhslink.cn/o/59VwcmP2rEz" target="_blank">@ESTHER不二</a></div><div className="gt-line">&nbsp;</div>
                <div className="gt-line"><span className="gt-prompt">$ </span><span className="gt-cmd">fortune</span></div><div className="gt-line gt-dim">“找到你喜欢的事，然后让它杀死你。” — Bukowski</div><div className="gt-line">&nbsp;</div>
                <div className="gt-line"><span className="gt-prompt">$ </span><span className="gt-cmd">exit</span></div><div className="gt-line gt-output"><span className="gt-gold">[Process completed]</span></div>
              </div></div>
              <div className="goodbye-footer">© 2026 ESTHER不二 · Built with AI &amp; attitude</div>
            </div></div></div>
            <div className="exit-hinge"></div><div className="exit-base"></div><div className="exit-shadow"></div>
          </div>
        </div>
        <div className="back-to-top"><a href="#" id="backToTopLink"><span className="back-arrow">↑</span>回到开始 · Back to Start</a></div>
      </section>
    </main>
  );
}

function WorksTab() {
  return (
    <main className="tab-page" id="page-works">
      <div className="works-page">
        <div className="workflow-screen">
          <h1 className="workflow-headline">1 Person + AI = 1 Team</h1>
          <p className="workflow-subtitle">ESTHER不二 · INTJ · 南大建筑 → 米兰理工 → AI · ColaOS</p>
          <div className="workflow-columns">
            {workflowColumns.map((column) => <div className="workflow-col" key={column.title}><div className="workflow-col-title">{column.title}</div><div className="workflow-col-line"></div>{column.items.map(([label, description]) => <div className="workflow-item" key={label}><span className="workflow-item-label">{label}</span><span className="workflow-item-desc">{description}</span></div>)}</div>)}
          </div>
        </div>
        <div className="section-label" style={{ marginTop: '64px' }}>ls works/</div><h2 className="section-heading">作品集</h2>
        <div className="works-grid">
          {workDimensions.map((dimension) => <div className="work-dim" key={dimension.number}><div className="dim-num">{dimension.number}</div><h3>{dimension.title}</h3>{dimension.description && <p className="dim-desc">{dimension.description}</p>}{dimension.links && <div className="dim-works-list">{dimension.links.map(([icon, href, label]) => <a className="dim-work-item" href={href} target="_blank" key={label}><span className="dim-work-icon">{icon}</span><span>{label}</span></a>)}</div>}{dimension.empty && <div className="dim-empty">{dimension.empty}</div>}</div>)}
        </div>
      </div>
    </main>
  );
}

function SystemTab() {
  return <main className="tab-page" id="page-system"><div className="canvas-page"><iframe data-src="infinite-canvas.html" id="canvasFrame" title="即刻短文"></iframe></div></main>;
}

function AboutTab() {
  return <main className="tab-page" id="page-about"><div className="canvas-page"><iframe data-src="about.html" id="aboutFrame" title="关于我 — 黄家宝 / AI悦创"></iframe></div></main>;
}

export default function HomePage() {
  return (
    <>
      <div className="transition-overlay" id="transitionOverlay"></div>
      <nav className="pill-nav hidden-during-intro" id="pillNav"><button data-tab="home" className="active"><span className="pill-num">01</span>主页</button><button data-tab="works"><span className="pill-num">02</span>作品集</button><button data-tab="system"><span className="pill-num">03</span>我的OS</button></nav>
      <HomeTab />
      <WorksTab />
      <SystemTab />
      <AboutTab />
    </>
  );
}
