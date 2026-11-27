<p align="center">
  <img src="assets/logo.png" alt="QT-Viewer Logo" width="160">
</p>

# QT-Viewer

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a-Coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/qtviewer)

An open-source, browser-based player and inspector for **Spine 2D** & **Unity (`.unity3d`)** game assets. Designed to run both **100% statically on GitHub Pages** (drag-and-drop local files directly in your browser) and locally with full scene/manifest support.

---

## ✨ Features

- **Runs on GitHub Pages & Offline**: Pure client-side HTML/JS/WebGL — no build step required. Drop extracted `.skel` / `.json` + `.atlas` + `.png` files (or an entire folder) directly onto the stage or sidebar.
- **Full Spine 4.1 Playback**:
  - Skin / costume switching (`setSkinByName` + `setSlotsToSetupPose`)
  - Stateful multi-step animation sequences (`*_in` → `loop` → `*_out`)
  - One-shot interactive reactions, parallel environmental loops, and periodic eye blinking
  - Playback speed control (`0.5x` – `2.0x`), play/pause, and Premultiplied Alpha (PMA) toggle
- **Synchronized Stage Camera & Adjust Mode**:
  - Mouse-wheel zoom, click-drag pan, double-click reset
  - Optional background image & audio voice-line playback
  - **Adjust Mode** to fine-tune scale, X/Y offset, and crop window (persists to `localStorage` on GitHub Pages or `characters/scene_adjustments.json` via `server.py`)
- **Initial `.unity3d` Header Inspector**: Drop a `.unity3d` / `.bundle` file to inspect its `UnityFS` / `UnityWeb` / `UnityRaw` signature, format version, and Unity engine version in-browser.

---

## 🚀 Usage

### Option 1: GitHub Pages (Static / Drag & Drop)
1. Enable **GitHub Pages** on this repository (`Settings → Pages → Deploy from branch: main / (root)`).
2. Open the live URL.
3. Drag and drop a folder or files containing `.skel` (or `.json`) + `.atlas` + `.png` (and optional background image / `.mp3` audio) onto the viewer.
4. For quick single-file testing, use `viewer.html` (`Quick Test ↗`).

### Option 2: Run Locally
```bash
git clone https://github.com/DwayneJhonson69/QT-Viewer.git
cd QT-Viewer
python server.py
```
Then open `http://localhost:8080`.
If you place your own extracted `characters/` folder (with `hierarchy.json` / `characters.json`) in the project root, `index.html` automatically loads the full character/scene/level hierarchy, and **Adjust Mode** saves directly to `characters/scene_adjustments.json`.

---

## 🤝 Collaborating on `.unity3d` Support

One of the main goals of **QT-Viewer** is making it effortless to open and play `.unity3d` asset bundles directly in the browser—without requiring desktop extraction tools.

**Areas where PRs and collaborators are super welcome:**
- **In-Browser `UnityFS` / `UnityWeb` Unpacking**: JS/WASM parsing of Unity AssetBundle blocks (LZ4 / LZMA decompression) in [`src/localLoader.js`](src/localLoader.js).
- **Direct Asset Extraction**: Reading `TextAsset` (`.skel`, `.atlas`), `Texture2D` (PNG/DXT/ETC/ASTC decoding), and `AudioClip` entries directly from serialized Unity assets.
- **Additional Spine Runtimes & Formats**: Supporting Spine 3.8 / 4.0 / 4.2 skeletons alongside 4.1, plus Live2D or sprite-sheet previews.
- **UI & Export Improvements**: Frame-stepping, timeline scrubbing, and WebM/PNG recording.

---

### ☕ Support the Development of an Open-Source Unity Asset Player

Hey! Thanks for stopping by!

I'm building an open-source tool that makes it easier to explore and play supported `.unity3d` files from different Unity-based video games.

The goal is simple: create an accessible, easy-to-use solution for people who want to explore Unity asset bundles, experiment with game resources, and learn more about how Unity games work.

**Why support this project?**

Developing and maintaining tools like this takes time, experimentation, testing, and continuous improvements. Your support helps me:

- Improve compatibility with different Unity games and asset formats.
- Add new features and improve playback.
- Fix bugs and optimize performance.
- Maintain the project and keep it freely accessible.
- Spend more time developing and documenting the tool.

**Is the project free?**

Absolutely! The project is open-source, and voluntary contributions are never required to use it.

**A small contribution makes a difference.**

Whether it's the price of a coffee or simply sharing the GitHub repository, every bit of support motivates me to keep building.

Thanks for supporting independent open-source development! ❤️

☕ Every coffee helps keep the project brewing: **[Buy Me a Coffee](https://buymeacoffee.com/qtviewer)**

**Disclaimer:** This project is an independent community-developed tool and is not affiliated with, endorsed by, or associated with Unity Technologies or any video game publisher. Users are responsible for ensuring they have the necessary rights and permissions to access and use any files they load. The project does not distribute copyrighted game assets.
