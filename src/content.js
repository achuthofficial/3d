// The six project stories. Concept and "wow factor" text comes from the
// original project brief; the rest expands on how each tool works.
import exportPanels from './snippets/exportPanels.jsx?raw';
import packagingPanel from './snippets/packagingPanel.js?raw';
import traceAndRecolor from './snippets/traceAndRecolor.jsx?raw';
import bridge from './snippets/bridge.py?raw';
import fitText from './snippets/fitText.jsx?raw';
import translate from './snippets/translate.js?raw';
import renderLabels from './snippets/render_labels.py?raw';
import cleanPath from './snippets/cleanPath.jsx?raw';
import moodRig from './snippets/moodRig.js?raw';
import brandAudit from './snippets/brandAudit.jsx?raw';
import autoFix from './snippets/autoFix.jsx?raw';
import outlineSelection from './snippets/outlineSelection.jsx?raw';
import displace from './snippets/displace.js?raw';
import cepManifest from './snippets/manifest.xml?raw';
import hostBridge from './snippets/bridge.jsx?raw';
import panelSync from './snippets/panelSync.js?raw';

export const site = {
  name: 'Flat → Form',
  author: 'Achuth Dintakurthi',
  tagline: 'One flagship pipeline panel and six AI-powered tools that carry Adobe Illustrator artwork into 3D.',
  intro:
    'Tab 00 is the full Illustrator → 3D workspace. Tabs 01–06 each tell one project’s story: the friction it removes, how it works, and the stack behind it. Every tab has a working prototype you can use right here in the browser. Nothing to install.',
};

export const projects = [
  {
    id: 'workspace',
    num: '00',
    tab: 'Illustra3D-AI',
    kicker: 'Flagship · full pipeline panel',
    role: 'Principal Creative Technologist & Adobe Pipeline Engineer',
    title: 'Illustra3D-AI: Enterprise 2D → 3D Pipeline Panel',
    lede: 'An Illustrator UXP / CEP extension panel in one split-screen workspace: a live vector artboard, a real-time PBR viewport and a Gen-AI control centre, joined by a scripted host bridge.',
    problem:
      'Projects 01–06 each solve one link in the chain. In a real studio those links live in separate tools: Illustrator for the dieline, a 3D app for the mockup, an AI web app for textures, a folder of scripts for exports. Every hand-off between them is a manual export–import loop.',
    concept:
      '“Illustra3D-AI”: an enterprise Adobe Illustrator UXP / CEP extension panel demonstrating seamless 2D-to-3D pipeline automation, procedural vector mapping and generative AI texture synthesis. It is a fully interactive, production-grade WebGL simulation in a single HTML/CSS/JavaScript file: the Illustrator vector canvas and layer DOM on the left, a Three.js real-time viewport in the centre, and the UXP automation and Gen-AI control centre on the right.',
    steps: [
      ['Vector canvas & layer DOM', 'An interactive packaging dieline built from dynamic SVG paths, with a Layer Manager for [Dieline_Cutline], [Brand_Logo], [AI_Texture_Layer] and [Foil_Finish]. Click or type to edit text, swap vector decals and adjust brand colours.'],
      ['Vector-to-UV mapping', 'Every edit re-bakes the artboard into a dynamic CanvasTexture laid out on the dieline’s UV islands, so the 3D model updates in real time.'],
      ['Real-time 3D viewport', 'An angular hexagonal carton in MeshPhysicalMaterial with clearcoat, micro-roughness, embossed metallic foil stamping and environment reflections, lit by a key, rim and softbox-fill rig over a shadow plane. Exploded Dieline morphs it flat and back; Turntable spins it 360°.'],
      ['Gen-AI control centre', 'Type a prompt, pick Diffusion Latent-Texture v3 or Vector-Trace ControlNet, then Generate & Bake. The panel shows the denoising run and bakes albedo, roughness and specular bump maps onto the texture coordinates.'],
      ['Automation terminal & export', 'A live ExtendScript / UXP console logs every call (and takes commands). Export for Production writes a GLB, an SVG vector bundle, a print PDF and a manifest into one ZIP.'],
    ],
    stack: [
      ['HTML5 · CSS Grid / Flexbox', 'Spectrum-style dark workspace'],
      ['Three.js (CDN)', 'OrbitControls, PBR, RectAreaLight'],
      ['UXP / CEP + ExtendScript', 'Host-bridge simulation'],
      ['Vector-to-UV engine', '2D canvas → dynamic CanvasTexture'],
      ['Gen-AI pipeline simulation', 'Prompt-to-texture & vector style transfer'],
    ],
    wow: 'Artwork, 3D preview, AI texture exploration and production export all happen in one panel, and every edit reaches the 3D product within a frame or two. It is the other six ideas working together as one tool.',
    prototype:
      'Double-click text on the artboard to edit it, toggle layer visibility, swap decals and palettes, try the prompt chips in both models, flip Exploded Dieline, and type help in the terminal. Export for Production downloads a real ZIP: a GLB, an SVG with named layers, a 300 dpi PDF with CutContour and Crease spot-colour lines, and a manifest. The AI and Illustrator host calls are simulated in the browser and labelled as such. Use “Open full screen” for the roomiest view.',
    code: [
      { file: 'manifest.xml', lang: 'CEP manifest', src: cepManifest },
      { file: 'bridge.jsx', lang: 'ExtendScript', src: hostBridge },
      { file: 'sync.js', lang: 'CEP · JavaScript', src: panelSync },
    ],
    demo: () => import('./demos/workspace.js'),
  },
  {
    id: 'packaging',
    num: '01',
    tab: 'Packaging Pipeline',
    kicker: '2D dieline → 3D AI mockup',
    title: 'The Automated Packaging Pipeline',
    lede: 'Finish a flat dieline in Illustrator, press one button, and get back a folded, lit, photoreal 3D mockup sitting in an AI-generated lifestyle scene.',
    problem:
      'Packaging design bounces between 2D and 3D all day. Every artwork tweak means re-exporting panels, re-wrapping them in a 3D app, re-lighting, and finding or shooting a new background. A five-minute colour change turns into an afternoon of mockups.',
    concept:
      'A UXP/CEP panel in Illustrator where a designer finishes a 2D flat packaging layout (dieline). With one click, the script maps the 2D artwork onto a pre-configured 3D model (like a box or bottle). Then it uses an AI image API (like Stable Diffusion or OpenAI) to generate a photorealistic, thematic background based on the brand’s keywords, blending the 3D model into the AI background.',
    steps: [
      ['Read the dieline', 'The panel walks the artboards (one per panel: front, back, sides, top and bottom) and exports each one at print resolution, along with its exact size in points.'],
      ['Map 2D → 3D', 'Each panel texture lands on the matching face of a pre-configured hinged box. The 2D layout is the UV layout, so there is nothing to unwrap.'],
      ['Fold along the creases', 'Panels rotate about their fold lines in sequence (sides, then back, then lid and base), the same order a carton folds on the packing line.'],
      ['Generate the scene', 'Brand keywords become a prompt for Stable Diffusion / DALL·E, which returns a lifestyle backdrop that suits the product.'],
      ['Composite', 'Key light, rim light and fog colours are pulled from the generated scene so the box sits inside it instead of looking pasted on.'],
    ],
    stack: [
      ['JavaScript (UXP / CEP)', 'Panel UI and host bridge'],
      ['Adobe Illustrator DOM', 'Artboards, export, geometry'],
      ['Three.js', 'Live 3D preview and fold rig'],
      ['Stable Diffusion / DALL·E', 'Lifestyle background generation'],
    ],
    wow: 'Packaging design involves a tedious back-and-forth between 2D and 3D. Showing that you can automate this *and* use AI to generate lifestyle backgrounds instantly proves you understand high-value commercial workflows.',
    prototype:
      'Change the brand name, colour, pattern or carton format and the dieline repaints live. “Run one-click pipeline” folds the six panels into a box and builds a scene from your prompt. Export the result as a PNG. The AI step runs on a local keyword-to-scene engine, so the demo works offline; the plugin calls an image API at that point.',
    code: [
      { file: 'exportPanels.jsx', lang: 'ExtendScript', src: exportPanels },
      { file: 'panel.js', lang: 'CEP · JavaScript', src: packagingPanel },
    ],
    demo: () => import('./demos/packaging.js'),
  },
  {
    id: 'pattern',
    num: '02',
    tab: 'Pattern → Texture',
    kicker: 'Prompt → raster → vector → 3D',
    title: 'Generative AI Vector Pattern to 3D Texture Baker',
    lede: 'Type “seamless cyberpunk circuit board” and get back a clean, brand-coloured vector pattern, already wrapped around a 3D product.',
    problem:
      'AI image generators produce pixels. Brands need vectors in exact brand colours, and 3D artists need seamless tiles they can wrap without visible joins. Doing that by hand means tracing, cleaning, recolouring and test-wrapping every single pattern.',
    concept:
      'A custom Illustrator plugin where a user types a text prompt (e.g., “seamless cyberpunk circuit board”). The plugin calls an AI API to generate the image, vectorizes it cleanly using Illustrator’s Image Trace via ExtendScript, colors it using a predefined brand palette, and instantly applies it as a texture map to an imported 3D asset.',
    steps: [
      ['Generate', 'An AI image API generates a seamless raster tile from the prompt, bridged through a small local Python service.'],
      ['Image Trace', 'ExtendScript places the tile, runs Illustrator’s Image Trace with a fixed colour count and expands the result into editable paths.'],
      ['Brand recolour', 'Every traced fill is snapped to the nearest swatch in the brand’s swatch group, so no off-palette colour survives.'],
      ['Bake to 3D', 'The vector tile is rasterised at texture resolution and applied as a repeating map to the imported 3D asset.'],
    ],
    stack: [
      ['ExtendScript / CEP', 'Plugin panel and host automation'],
      ['Python', 'AI backend bridge'],
      ['Illustrator Image Trace API', 'Raster → vector'],
      ['3D texturing workflow', 'Seamless tiling and UV repeat'],
    ],
    wow: 'It demonstrates mastery of bridging AI-generated raster images into clean, usable vector art, and directly applying that to a 3D pipeline, hitting every single job requirement in one tool.',
    prototype:
      'The browser version does real vectorisation: marching-squares contour tracing at colour-quantile thresholds, Ramer–Douglas–Peucker simplification and Bézier fitting. Download the SVG tile and it opens in Illustrator as editable paths. The generated tiles are periodic, so they repeat with no seams on every asset. The raster “AI” step is a procedural generator chosen by the keywords in your prompt.',
    code: [
      { file: 'traceAndRecolor.jsx', lang: 'ExtendScript', src: traceAndRecolor },
      { file: 'bridge.py', lang: 'Python', src: bridge },
    ],
    demo: () => import('./demos/pattern.js'),
  },
  {
    id: 'localization',
    num: '03',
    tab: 'Batch Localisation',
    kicker: '1 master label → 20 languages → 20 renders',
    title: 'Smart Batch-Localization & 3D Render Engine',
    lede: 'Feed in a CSV of locales and a master label. Get back translated, typeset, overflow-free labels plus a rendered 3D product shot for every market.',
    problem:
      'German runs a third longer than English, Japanese and Thai need different line breaking, and Arabic and Hebrew read right-to-left. Localising one label for twenty markets means twenty rounds of copy-paste, broken text frames, manual re-kerning and twenty separate 3D renders.',
    concept:
      'A script designed for massive content generation. You feed the script a CSV of 20 different languages and a master Illustrator file of a product label. The script uses AI to translate the text, automatically resizes and re-kerns the typography so it doesn’t break the vector bounding boxes, exports the 20 labels, maps them to a 3D product model, and batch-renders 20 different 3D product shots.',
    steps: [
      ['Read the CSV', 'One row per market: locale code, language and text direction.'],
      ['Translate', 'An LLM translates the master copy for each locale with a character budget per text frame and returns structured JSON.'],
      ['Auto-fit typography', 'Each frame tightens tracking first, then steps the size down and re-wraps within its line limit. Scripts where letter-spacing breaks shaping (Arabic, Hebrew, Devanagari, Thai) are only resized.'],
      ['Export labels', 'Twenty print-ready label files, one per locale, with RTL layouts mirrored.'],
      ['Batch render', 'A headless Blender job launched from the panel maps every label onto the product and renders the full set of shots.'],
    ],
    stack: [
      ['ExtendScript', 'Text frames, tracking, export'],
      ['LLM API', 'Translation with length hints'],
      ['Blender (Python, CLI)', 'Headless batch rendering'],
      ['Node via CEP', 'Spawns and monitors the render job'],
    ],
    wow: 'Shows enterprise-level automation. You are proving you can take a task that usually takes a design team three days and reduce it to three minutes.',
    prototype:
      'Translations come from a bundled translation memory (cached LLM output for 20 locales), so it runs with no API key. Add a CSV row for a locale it doesn’t know and it gets flagged as needing an LLM call. Turn auto-fit off to see the overflows it prevents. “Run batch” renders all 20 cans in WebGL and builds a downloadable contact sheet.',
    code: [
      { file: 'fitText.jsx', lang: 'ExtendScript', src: fitText },
      { file: 'translate.js', lang: 'Node · Claude API', src: translate },
      { file: 'render_labels.py', lang: 'Blender Python', src: renderLabels },
    ],
    demo: () => import('./demos/localization.js'),
  },
  {
    id: 'extrude',
    num: '04',
    tab: 'Sketch → 3D',
    kicker: 'Rough path → clean anchors → 3D',
    title: '2D Flat Sketch to 3D Extrusion Assistant',
    lede: 'Scribble a rough shape. The assistant cleans its anchor points with vector maths, extrudes it into a 3D object and lights it to match the mood you type.',
    problem:
      'Hand-drawn paths come out wobbly and full of redundant anchors. That breaks bevels, slows Illustrator’s 3D effect and looks amateur once extruded, and cleaning them up by hand is slow, fiddly work.',
    concept:
      'A designer sketches a rough, flat geometric shape in Illustrator. The script analyzes the vector paths, cleans up the anchor points using a math-based optimization, and intelligently extrudes it into a 3D object using Illustrator’s native 3D engine (or exports it as an OBJ/GLTF). An AI component suggests lighting setups based on the “mood” selected by the user in the panel.',
    steps: [
      ['Sketch', 'Draw freehand with the Pencil tool, or right here on the artboard.'],
      ['Optimise anchors', 'Ramer–Douglas–Peucker drops redundant points within a tolerance. The turning angle at each remaining point decides whether it becomes a corner point or a smooth point with tangent handles.'],
      ['Extrude', 'The cleaned Bézier path is extruded with a bevel, through Illustrator’s 3D effect or exported as OBJ / GLTF.'],
      ['Mood lighting', 'An AI assistant turns a mood (“golden hour nostalgia”) into a three-point lighting rig plus material settings.'],
    ],
    stack: [
      ['JavaScript', 'Panel logic'],
      ['Illustrator path maths', 'Anchors, handles, point types'],
      ['Illustrator 3D effect scripting', 'Native extrude & bevel'],
      ['LLM-assisted lighting', 'Mood → rig as structured JSON'],
    ],
    wow: 'Proves deep, fundamental knowledge of vector mathematics and Illustrator’s native 3D capabilities, while using AI as an intuitive assistant.',
    prototype:
      'Draw on the artboard with a mouse or finger. The tolerance and corner-angle sliders rebuild the anchors live, with handles drawn the way Illustrator draws them. The SVG, OBJ and GLB exports are real files you can open in Illustrator or Blender. Mood matching uses a local keyword model; the production version asks an LLM for the rig as validated JSON.',
    code: [
      { file: 'cleanPath.jsx', lang: 'ExtendScript', src: cleanPath },
      { file: 'moodRig.js', lang: 'Node · Claude API', src: moodRig },
    ],
    demo: () => import('./demos/extrude.js'),
  },
  {
    id: 'brandcheck',
    num: '05',
    tab: 'Brand QA',
    kicker: 'Preflight before the 3D handoff',
    title: 'AI-Assisted Brand Consistency Checker',
    lede: 'One click checks an artboard against the brand spec (logo proportions, exact hex values, layer naming and separation) and auto-corrects what it safely can before the file reaches the 3D team.',
    problem:
      'Messy files cause most of the friction between 2D and 3D: stretched logos, almost-right colours, layers called “Layer 1 copy 3”, dielines mixed into the artwork, live text that reflows on another machine. 3D artists find these late, and files go back and forth.',
    concept:
      'A QA (Quality Assurance) plugin. Before a designer sends an Illustrator file to the 3D modeling team, they run the script. It uses a custom ML model or AI Vision API to scan the artboard to ensure the logo is the correct proportions, brand colors meet exact hex codes, and layers are properly named and separated for 3D mapping. If it fails, it highlights the errors and auto-corrects layer naming.',
    steps: [
      ['Scan', 'A vision model inspects the rendered artboard while the script walks the Illustrator DOM: layers, page items, fills and bounds.'],
      ['Measure', 'Logo lockup ratio and clear-space zone, ΔE₀₀ between every fill and its nearest brand swatch, layer names against the PREFIX_Name convention.'],
      ['Flag', 'Every failure is pinned on the artboard and the file gets a handoff score out of 100.'],
      ['Auto-correct', 'Isolates the dieline, outlines text, restores the logo ratio, clears the exclusion zone, snaps colours, renames layers and writes a handoff manifest for the 3D team.'],
    ],
    stack: [
      ['UXP', 'Panel and document access'],
      ['AI Vision API', 'Logo and layout verification'],
      ['Illustrator DOM', 'Layers, items, colours, transforms'],
      ['CIEDE2000', 'Perceptual colour distance'],
    ],
    wow: 'Nobody likes cleaning up messy files before 3D integration. This shows you understand pipeline friction and can build tools that enforce clean handoffs between 2D and 3D teams.',
    prototype:
      'Every check is real and runs on the SVG DOM: CIEDE2000 colour distance, bounding-box maths, exclusion zones and text-to-outline tracing. Try “Check your own SVG” with an Illustrator SVG export; top-level groups are read as layers. Role detection (logo, text, dieline) uses object names and element types in place of the vision model.',
    code: [
      { file: 'brandAudit.jsx', lang: 'ExtendScript', src: brandAudit },
      { file: 'autoFix.jsx', lang: 'ExtendScript', src: autoFix },
    ],
    demo: () => import('./demos/brandcheck.js'),
  },
  {
    id: 'typography',
    num: '06',
    tab: '3D Typography',
    kicker: 'Live text + prompt → stylised 3D type',
    title: 'Dynamic 3D Typography Generator via AI Prompts',
    lede: 'Select live text, type “melting ice” or “liquid metal”, and get custom 3D lettering without leaving Illustrator.',
    problem:
      'Stylised 3D type is usually a relay race: outline in Illustrator, model and displace in Cinema 4D, then texture and composite in Photoshop. Every prompt-sized idea (“make it molten”) costs an hour of round trips.',
    concept:
      'A panel where the user selects live text in Illustrator. They type a prompt like “melting ice” or “liquid metal.” The script converts the text to outlines, generates displacement maps using AI based on the prompt, and applies them to the vector shapes in a 3D space, creating custom, stylized 3D typography without leaving Illustrator.',
    steps: [
      ['Live text', 'The panel reads the selected text frame.'],
      ['Outlines', 'createOutline() turns it into compound paths, and their anchors and handles become the 3D profile.'],
      ['AI depth map', 'A depth-map model turns the prompt plus the outline mask into a displacement map: drips, ripples, cracks or inflation.'],
      ['Displace & shade', 'The extruded type is tessellated, displaced by the map and given a matching material: glass, chrome, emissive lava and more.'],
    ],
    stack: [
      ['CEP / UXP', 'Panel and selection access'],
      ['AI depth-map generation', 'Prompt → displacement'],
      ['Extrude & Bevel / 3D Materials', 'Illustrator’s native 3D'],
      ['Three.js', 'Real-time preview'],
    ],
    wow: 'It is highly visual. It turns a complex, multi-software process (Illustrator → Cinema 4D → Photoshop) into a single-click native Illustrator tool.',
    prototype:
      'Type any word in any script. Outlines come from tracing the rendered glyphs, so it isn’t limited to Latin fonts. The prompt picks a material and tint (“pink candy glass”, “gold foil balloon”), and the depth map shown in 2D is the same field that displaces the 3D mesh. Export the type as GLB or the depth map as a PNG.',
    code: [
      { file: 'outlineSelection.jsx', lang: 'ExtendScript', src: outlineSelection },
      { file: 'displace.js', lang: 'JavaScript · Three.js', src: displace },
    ],
    demo: () => import('./demos/typography.js'),
  },
];
