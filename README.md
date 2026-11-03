<div align="center">

# ✦ LuxStage

**The Generative 3D Playground & Staging Toolkit for React Three Fiber**  
*Powered by Aholo Lux3D & Spatial Intelligence*

[![Manycore Aholo 3D AI Hackathon](https://img.shields.io/badge/Aholo_Global_3D_AI-Hackathon_2026-38bdf8?style=for-the-badge&labelColor=070b14)](https://www.aholo.ai/hackathon)
[![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-v8-58ddba?style=for-the-badge&labelColor=070b14)](https://github.com/pmndrs/react-three-fiber)
[![Three.js](https://img.shields.io/badge/Three.js-0.167-f8fafc?style=for-the-badge&labelColor=070b14)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge&labelColor=070b14)](./LICENSE)

<p align="center">
  <b>Transform text prompts and 2D sketches into textured 3D assets via Aholo Lux3D · Stage in an interactive darkroom · Sweep spotlights with tactile levers &amp; dials · Pin 3D hotspots · Fly camera tours · Export ready-to-run React Three Fiber components.</b>
</p>

</div>

---

## 🎮 What is LuxStage?

Building with 3D on the web typically requires juggling separate pipelines: 3D modeling tools, texturing suites, asset converters, lighting setups, and camera choreographers.

**LuxStage** unifies this into a single, seamless generative staging experience:
1. **Generative Synthesis:** Describe an object or drop a 2D sketch. Aholo Lux3D generates a textured `.glb` mesh with PBR materials in seconds.
2. **Instant Staging:** The model automatically mounts inside a responsive 3D darkroom, normalized to scale and centered on the floor.
3. **Tactile Rigs:** Interact with skeuomorphic hardware controls—spin a **360° Rotary Orbit Dial** and pull a **Mechanical Beam Lever** to reveal surface normal details with focused dramatic spotlights.
4. **Feature Hotspots & Tours:** Pin surface annotation notes directly onto exact 3D coordinates and choreograph automated fly-through camera tours.
5. **Prompt-to-Code Export:** Export a complete, standalone, self-contained `<StagedModelViewer />` React component with 1 click.

---

## 🕹️ Interactive Stages & Tactile Rigs

### 🔦 1. Darkroom Spotlight Stage
* **Rotary Orbit Dial:** Smooth 360° tactile dial controlling the azimuth orbit of an elevated spotlight around the asset.
* **Mechanical Pull Lever:** Physical knurled grip lever with graduation markings controlling beam intensity and falloff.
* **Contact Shadows:** Soft ground contact shadows highlighting the asset's ground contact geometry.

### 🔄 2. 360° Showroom Turntable
* Continuous, customizable-speed turntable rotation for product reveals and showcase evaluation.
* 3-point studio lighting with key, fill, and rim lights.

### 🎯 3. Seeker Flight Gimbal
* 2-Axis physical joystick controlling yaw and pitch of the camera turret.
* Live HUD target-lock overlay with seeker crosshairs.

### 📍 4. Hotspot Guided Tour
* Click anywhere on the 3D surface mesh to pin new diagnostic or feature hotspots.
* Automated tour player that smoothly flies the camera to framed vantage points for each hotspot.

---

## ⚡ Architecture & Tech Stack

```
LuxStage Client (React 18 + R3F + Tailwind CSS v4)
   │
   ├── Generative Studio Drawer
   │      ├── Text Prompt Synthesizer
   │      ├── 2D Image / Sketch Dropzone
   │      └── Local .GLB Loader
   │
   ├── Vite Secure Reverse-Proxy (/api/aholo/*)
   │      └── Bearer Token Injection & CORS Mitigation
   │
   ├── Aholo Lux3D Cloud API
   │      ├── Task Creation: POST /lux3d/v1/generate/img-to-3d/task/create
   │      ├── Polling Worker: GET /lux3d/v1/generate/img-to-3d/task/get
   │      └── Direct CDN Asset Delivery (.glb)
   │
   └── Staging & Export Engine
          ├── Three.js Bounds Normalizer & ContactShadows
          ├── Tactile Skeuomorphic Controls Cockpit
          └── 1-Click <StagedModelViewer /> TSX Code Generator
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/your-username/luxstage.git
cd luxstage
npm install
```

### 2. Configure Aholo API Key
Get your free API key from the [Aholo Developer Portal](https://labs.aholo3d.com/api-keys).

Create `.env.local` in the project root:
```env
AHOLO_API_KEY=your_aholo_api_key_here
AHOLO_API_BASE=https://api.aholo3d.com
```

*(You can also paste your API key directly in the UI under **Settings** — it will be safely stored in your browser's `localStorage` and never committed to version control).*

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5174](http://localhost:5174) in your browser.

### 4. Build for Production
```bash
npm run build
npm run preview
```

---

## 📦 Exporting Code to Your React App

Click **Export Code** in the top navigation bar to generate clean, copy-paste React Three Fiber code:

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, ContactShadows } from '@react-three/drei';

export function StagedModelViewer() {
  const { scene } = useGLTF('https://your-generated-model.glb');
  return (
    <div style={{ width: '100%', height: '500px' }}>
      <Canvas shadows camera={{ position: [0, 1.4, 3.8], fov: 45 }}>
        <spotLight position={[3.18, 3.5, 3.18]} intensity={11.9} angle={Math.PI / 6} castShadow />
        <OrbitControls makeDefault />
        <primitive object={scene} />
        <ContactShadows opacity={0.7} scale={8} blur={2.4} />
      </Canvas>
    </div>
  );
}
```

---

## 🏆 Manycore Aholo Hackathon Submission Details

* **Project Title:** LuxStage
* **Category:** 3D Generation & Spatial Intelligence / Web Applications
* **Core Technology:** Aholo Lux3D API (`G1-Turbo` model generation, PBR texturing), React Three Fiber, Three.js
* **Summary:** An interactive generative 3D playground and staging toolkit. Powered by Aholo Lux3D, it transforms text prompts and 2D sketches into textured 3D assets within an interactive web darkroom—complete with tactile lighting rigs, surface hotspot tours, and one-click export to React Three Fiber code.

---

## 📄 License
MIT © 2026
