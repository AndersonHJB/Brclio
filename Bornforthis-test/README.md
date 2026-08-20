# Esther Website

The homepage is a React application built with Vite. Its existing visual language and interaction timings are intentionally preserved during the migration.

## Development

```bash
npm install
npm run dev
```

Create a production deployment with:

```bash
npm run build
```

Run the content automation checks with:

```bash
npm test
```

## Automatic Homepage Content

The homepage and `public/sitemap.xml` now use `public/` as their single content source:

- Put an HTML file directly in `public/` to show it as a desktop article icon.
- Put HTML files in a subfolder to show that subfolder as a desktop folder.
- Add deeper subfolders freely; each folder opens the next level with the existing desktop-window interaction.
- The visible label comes from the page's `<title>`, falling back to its file or folder name.
- Directories that contain no HTML anywhere below them are treated as asset directories and stay hidden.
- Pages with `<meta name="robots" content="noindex">` stay out of both the homepage and sitemap.
- A directory's `index.html` uses the clean directory URL ending in `/`.

The index and sitemap regenerate when `npm run dev` starts, whenever HTML under `public/` changes during development, and whenever `npm run build` runs. The sitemap domain comes from `public/CNAME`; do not edit sitemap links by hand.

`public/index.html` is reserved because Vite's actual homepage is the project-level `index.html`.

## Project Structure

- `src/App.jsx`: React application entry and lifecycle boundary.
- `src/components/HomePage.jsx`: Homepage document structure and recursive content-folder templates.
- `src/styles/site.css`: Homepage styles and animation definitions.
- `src/lib/siteController.js`: Homepage interaction controller: tabs, terminal launch, desktop windows, canvas loading, pointer interactions, and exit loop.
- `scripts/publicContent.mjs`: Build-time HTML discovery and sitemap generation.
- `public/`: Static assets plus existing tutorial, playground, and canvas pages. These retain their published URLs, including `/tutorials/...` and `/A-infinite-canvas-v2.html`.

## Updating The Homepage

Add normal article content under `public/`; no homepage list or sitemap edit is needed. Keep structural changes in `src/components/HomePage.jsx`, visual changes in `src/styles/site.css`, and interaction changes in `src/lib/siteController.js`. Build after each code change to catch module and asset issues.
