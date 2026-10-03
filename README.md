# Flat → Form

**Six AI-powered tools that carry Adobe Illustrator artwork into 3D.**

A single-page portfolio site with one tab per project. Each tab tells the project's story (the friction it removes, the concept, how it works, the tech stack and the "wow" factor) and includes a **working prototype that runs in the browser**, plus the core Illustrator/host code behind it.

| # | Tab | What the live prototype does |
|---|-----|------------------------------|
| 01 | **Packaging Pipeline** | Paints a dieline from your brand inputs, folds the six panels into a 3D box, generates a themed scene from a prompt and exports a PNG mockup. |
| 02 | **Pattern → Texture** | Prompt → raster tile → real vector trace (marching squares + RDP + Bézier fitting) → brand recolour → seamless texture on a mug, sphere, knot or skate deck. Downloads SVG/PNG. |
| 03 | **Batch Localisation** | CSV of 20 locales → translations → typography auto-fit (tracking, size, wrapping, RTL) → 20 labels → 20 WebGL product renders and a contact sheet. |
| 04 | **Sketch → 3D** | Draw a shape; anchors are simplified and rebuilt as corner/smooth points, extruded with a bevel and lit from a mood prompt. Exports SVG, OBJ and GLB. |
| 05 | **Brand QA** | Checks an artboard (or your own SVG) for logo ratio, clear space, exact brand hex (CIEDE2000), layer naming and 3D separation, then auto-fixes it to 100/100. |
| 06 | **3D Typography** | Live text in any script → outlines → prompt-driven depth map → displaced, tessellated 3D type (ice, liquid metal, lava, candy, stone, foil, neon). Exports GLB. |

Every AI step in the demos runs **locally** (keyword models and procedural generators), so the site needs no API keys or backend. The production version of each tool calls the services named in its tech stack, and the "Under the hood" code on each tab shows where.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build
```

Requires Node 20.19+ (or 22.12+).

## Deploy to Vercel

The repo is ready for Vercel as-is (`vercel.json` pins the Vite framework preset, `npm run build` and the `dist` output).

**Dashboard:** go to [vercel.com/new](https://vercel.com/new), import this GitHub repository and click **Deploy**. Vercel detects Vite automatically; no settings or environment variables are needed.

**CLI:**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

Each tab is deep-linkable: `/#packaging`, `/#pattern`, `/#localization`, `/#extrude`, `/#brandcheck`, `/#typography`.

## Project structure

```
index.html              page shell, fonts, meta
src/main.js             layout, tabs, hash routing, lazy-loading of demos
src/content.js          the six project stories (edit text here)
src/styles.css          design tokens and all styles
src/demos/*.js          one interactive prototype per project (loaded on first visit to its tab)
src/lib/                shared Three.js stage, vector tracing, colour science, noise, DOM helpers
src/snippets/           Illustrator / CEP / Python source shown under "Under the hood"
vercel.json             Vercel build settings
```

Built with [Three.js](https://threejs.org) and [Vite](https://vite.dev).
