# Mechaverse

<div align="center">
  <img src="public/og.jpeg" alt="Mechaverse - Universal 3D Robot Viewer" width="800" style="border-radius: 12px; margin: 20px 0;">
  <div style="display: flex; justify-content: center; gap: 12px; margin: 5px 0;">
    <a href="https://mechaverse.dev">
      <img src="https://img.shields.io/badge/Demo-mechaverse.dev-blue?style=for-the-badge&logo=globe" alt="Demo">
    </a>
    <a href="https://discord.gg/UDYNE7qRVb">
      <img src="https://img.shields.io/badge/Discord-Join-7289DA?style=for-the-badge&logo=discord" alt="Discord">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License">
    </a>
  </div>
</div>

**Mechaverse** is a universal 3D viewer for robot models and scenes. We currently support **URDF**, **MJCF**, and **OpenUSD** formats right in the browser. It looks best on the computer, where you can drag, drop, and inspect your robot models without any setup or installation required. However, we also support smaller screens but can't make any promises in rendering quality.

It's a simple **Next.js** project, where rendering is supported by Three.js. We designed the viewer as a dispatch service making use of some great work by other open-source projects like:

- **[mujoco_wasm](https://github.com/zalo/mujoco_wasm)** - MuJoCo physics engine in the browser via WebAssembly
- **[usd-viewer](https://github.com/needle-tools/usd-viewer)** - OpenUSD viewer with rich USDStage support
- **[urdf-loaders](https://github.com/gkjohnson/urdf-loaders/)** - Robust URDF loading for Three.js

### Installation

Here we use **bun** but you can also use **npm** or **yarn**

1. **Clone the repository**
2. **Install dependencies** `bun install`
3. **Start the development server** `bun run dev`
4. **Open your browser** at `http://localhost:3000`

## ⚠️ Disclaimer

**Work in Progress**: Mechaverse is in active development. We appreciate your support and feedback to improve the quality of the simulators and identify any errors.

- **USD Display Issues**: USD files may not display properly on some mobile devices (tested on Safari and Chrome)
- **Performance**: Complex models may experience performance issues on lower-end devices
- **Browser Compatibility**: Some features may not work in older browsers

---

<div align="center">
  <p>Made with ❤️ and 🥭</p>
  <p>
    <a href="https://mechaverse.dev">🌐 Live Demo</a> •
    <a href="https://discord.gg/UDYNE7qRVb">💬 Discord</a> •
    <a href="https://github.com/jurmy24/mechaverse">📦 GitHub</a>
  </p>
</div>
