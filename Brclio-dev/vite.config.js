import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { defineConfig } from 'vite';
import { generatePublicContent } from './scripts/publicContent.mjs';

const PUBLIC_CONTENT_MODULE_ID = 'virtual:public-content';
const RESOLVED_PUBLIC_CONTENT_MODULE_ID = `\0${PUBLIC_CONTENT_MODULE_ID}`;

function publicContentAutomation() {
  let projectRoot;
  let publicDirectory;
  let content;

  function refreshContent() {
    content = generatePublicContent({
      publicDir: publicDirectory,
    });
  }

  function isContentSource(filePath) {
    const absoluteFilePath = resolve(filePath);
    const publicPath = relative(publicDirectory, absoluteFilePath);
    if (publicPath.startsWith('..')) return false;
    return /\.html$/i.test(absoluteFilePath)
      || absoluteFilePath === resolve(publicDirectory, 'CNAME');
  }

  return {
    name: 'public-content-automation',
    configResolved(config) {
      projectRoot = config.root;
      publicDirectory = resolve(projectRoot, config.publicDir);
      refreshContent();
    },
    buildStart() {
      refreshContent();
    },
    resolveId(id) {
      if (id === PUBLIC_CONTENT_MODULE_ID) return RESOLVED_PUBLIC_CONTENT_MODULE_ID;
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_PUBLIC_CONTENT_MODULE_ID) return undefined;
      return `export default ${JSON.stringify(content.tree)};`;
    },
    configureServer(server) {
      let refreshTimeout;

      const refreshBrowserContent = (filePath) => {
        if (!isContentSource(filePath)) return;

        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          try {
            refreshContent();
            const contentModule = server.moduleGraph.getModuleById(RESOLVED_PUBLIC_CONTENT_MODULE_ID);
            if (contentModule) server.moduleGraph.invalidateModule(contentModule);
            server.ws.send({ type: 'full-reload' });
          } catch (error) {
            server.config.logger.error(
              `[public-content-automation] ${error instanceof Error ? error.stack : error}`,
            );
          }
        }, 50);
      };

      server.watcher.on('add', refreshBrowserContent);
      server.watcher.on('change', refreshBrowserContent);
      server.watcher.on('unlink', refreshBrowserContent);
      server.httpServer?.once('close', () => clearTimeout(refreshTimeout));
    },
  };
}

function staticDirectoryIndex() {
  return {
    name: 'static-directory-index',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (!request.url) return next();

        let url;
        let pathname;
        try {
          url = new URL(request.url, 'http://localhost');
          pathname = decodeURIComponent(url.pathname);
        } catch {
          return next();
        }
        if (!pathname.endsWith('/')) return next();

        const publicDirectory = server.config.publicDir;
        const indexFile = resolve(publicDirectory, `.${pathname}`, 'index.html');
        const publicPath = relative(publicDirectory, indexFile);
        const escapesPublicDirectory = publicPath === '..'
          || publicPath.startsWith(`..${sep}`)
          || isAbsolute(publicPath);

        if (!escapesPublicDirectory && existsSync(indexFile)) {
          request.url = `${url.pathname}index.html${url.search}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [publicContentAutomation(), staticDirectoryIndex()],
});
