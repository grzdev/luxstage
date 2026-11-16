<div align="center">

# ✦ LuxStage

**The Interactive Generative 3D Playground & Staging Toolkit for Aholo Lux3D**  
*Built for the Manycore Aholo Global 3D AI Hackathon*

[![Manycore Aholo 3D AI Hackathon](https://img.shields.io/badge/Aholo_Global_3D_AI-Hackathon_2026-38bdf8?style=for-the-badge&labelColor=070b14)](https://www.aholo.ai/hackathon)
[![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-v8-58ddba?style=for-the-badge&labelColor=070b14)](https://github.com/pmndrs/react-three-fiber)
[![Three.js](https://img.shields.io/badge/Three.js-0.167-f8fafc?style=for-the-badge&labelColor=070b14)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge&labelColor=070b14)](./LICENSE)

<p align="center">
  <b>Generate textured PBR 3D assets from text prompts or 2D reference images via Aholo Lux3D · Inspect shaders &amp; topology in the Material Lab · Disassemble single-mesh AI models into 10 spatial parts · Test scale &amp; Zero-G physics · Sweep darkroom spotlights · Export ready-to-run React Three Fiber code.</b>
</p>

</div>

---

## 🎮 What is LuxStage?

Most 3D AI generators stop the moment a `.glb` file is produced—leaving creators, robotics engineers, and web developers to manually inspect topology, test lighting, verify real-world scale, and write boilerplate Three.js code.

**LuxStage** turns **Aholo Lux3D** into an end-to-end interactive 3D staging & inspection studio on the web:
1. **Text-to-3D & Image-to-3D Synthesis:** Enter a custom prompt, pick a curated 1-click preset (Embodied Robotics, Interior & Furniture, Product Design, Footwear), or drop a 2D reference image to synthesize a textured `.glb` asset with **Aholo Lux3D (`G1-Turbo` / `G1`)**.
2. **Aholo Material & Surface Lab:** Switch live between **Aholo PBR**, **Topology X-Ray Wireframe**, **Studio Clay**, **Liquid Chrome**, **Cyber Hologram**, and **Frosted Acrylic**, with real-time **Roughness** and **Metallic Sheen** sliders plus a **Topology Wireframe Overlay**.
3. **AI Part Split & 3D Explode:** Even single-mesh AI `.glb` models are automatically partitioned into **10 seamless 3D spatial sub-parts** sharing the original vertex/normal/UV buffers—giving zero visible seam at `0%` and smooth 60fps radial disassembly with 3D vector lines and clickable part isolation.
4. **Spatial Scale Cage & Zero-G Drop Physics:** Surround any generated asset with a **3D Holographic CAD Dimension Cage (`W × H × D` in meters)**, inspect live **Mesh Telemetry** (Triangles, Vertices, Sub-Parts, Footprint), levitate in **Zero-G Float**, or trigger a **Newtonian Gravity Drop Test** with floor shockwave rings.
5. **Tactile Rigs & Studio Showcase:** Sweep a **360° Clockwise Darkroom Spotlight**, track the flying 3D asset in the **Fighter-Jet Flight Gimbal**, slice cross-sections along **X / Y / Z axes**, customize studio backdrops, capture **Full-Res PNG Snapshots**, and copy **React Three Fiber (`<Canvas>`)** code in 1 click.

---

## 🕹️ The 7 Interactive 3D Viewport Tools

| Tool | Highlights |
| :--- | :--- |
| **✦ Material Lab** | 6 live surface shader modes (`Aholo PBR`, `Topology X-Ray`, `Studio Clay`, `Liquid Chrome`, `Cyber Hologram`, `Frosted Acrylic`), `Topology Wireframe Overlay`, and live `Roughness` & `Metalness` controls. |
| **🔦 Spotlight Rig** | Pitch-black darkroom inspection with a tactile **360° Clockwise Orbit Dial**, **Beam Intensity Lever**, and **Spotlight Height Lever**. |
| **🎯 Flight Gimbal** | 2-Axis physical flight joystick steering a fighter-jet camera turret to track and missile-lock your generated 3D model in real time at 60fps. |
| **📐 Spatial Rig** | **3D Holographic Dimension Cage (`W × H × D`)**, live **4-Card Mesh Telemetry**, `0.4x–1.8x` Scale Multiplier, **Zero-G Anti-Gravity Float**, **Gravity Drop Test**, and 1-click **R3F Code / `.glb` Export**. |
| **🧩 Part Split** | Automatic **10-Zone Spatial Mesh Segmentation** for AI models, **Radial Explode Lever**, **Auto-Pulse Explode** breathing mode, **3D Vector Connector Lines**, and clickable part focus chips. |
| **🎨 Studio Mode** | Lighting environment presets (`Showroom`, `Blueprint`, `Cyberpunk`, `Warm Clay`), custom hex backdrop swatches, and **Studio Snapshot PNG capture**. |
| **✂️ Section Slicer** | Real-time WebGL clipping plane across `Z (Top-Down)`, `X (Side-to-Side)`, and `Y (Front-Back)` axes to inspect internal mesh structure. |

---

## ⚡ Architecture & Tech Stack

```text
LuxStage Client (React 18 + TypeScript + React Three Fiber + Three.js)
   │
   ├── Aholo Lux3D Generative Studio Modal
   │      ├── Text-to-3D Synthesizer + Style Presets + Visual Prompt Cards
   │      ├── 2D Image / Sketch-to-3D Reconstruction Dropzone
   │      ├── Live 4-Stage Synthesis Pipeline Visualizer
   │      └── Session Asset Library (Instant Model Switching)
   │
   ├── Vite Secure Proxy (/api/aholo/* & /api/glb-proxy)
   │      └── Bearer Token Injection & Cross-Origin GLB Streaming
   │
   └── SpatialKit 3D Engine & Aholo Viewport Tools
          ├── Automatic Texture & Geometry Optimizer (60fps WebGL)
          ├── 10-Zone Zero-Seam Spatial Mesh Segmenter (Part Split)
          ├── Live PBR / X-Ray / Clay / Chrome / Hologram Shader Override
          └── 3D CAD Dimension Cage & Newtonian Drop-Test Physics Rig
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/grzdev/luxstage.git
cd luxstage
npm install
```

### 2. Configure Aholo API Key
Get your API key from the [Aholo Open Platform](https://www.aholo.ai/).

Create `.env.local` in the project root:
```env
VITE_AHOLO_API_KEY=your_aholo_api_key_here
VITE_AHOLO_REGION=intl
```

*(You can also paste your API key directly in the UI via the **⚙ API Key** button in the top navigation bar—it is stored locally in your browser's `localStorage` and never committed to git).*

### 3. Start Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 🏆 Manycore Aholo Global 3D AI Hackathon Submission

* **Project Title:** LuxStage
* **Track:** 3D Generation & Spatial Intelligence / Interactive Web Applications
* **Core Technology:** Manycore Aholo Lux3D API (`text_to_3d` & `image_to_3d`, `G1-Turbo` & `G1`), React 18, React Three Fiber, Three.js

---

## 📄 License
MIT © 2026
