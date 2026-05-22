# Swift — Web Music Player

A premium, modern web-based music player built using vanilla JavaScript, HTML, and CSS.  
Designed for speed, visual excellence, and a premium interactive listening experience.

---

## 🚀 Features

- 🎧 **Smooth Audio Playback**: Implements HTML5 audio elements with beautiful custom playback controls.
- ⚡ **Minimal UI**: Fast, responsive layout featuring glassmorphism and animated mesh background gradients.
- 🎹 **Keyboard Shortcuts**: Native controls for playing/pausing, changing tracks, adjusting volume, muting, and toggling panels.
- 🖤 **Real-Time Favorites Sync**: Instantly favorites/unfavorites tracks across cards, lists, sidebar states, and player controls in real time.
- 🎤 **Karaoke-Style Lyrics**: Timed LRC lyrics parser with smooth scrolling sync active line highlighting.
- 🧑‍💻 **Admin Panel**: Dedicated dashboard for adding, editing, and managing the music library.
- 📱 **Responsive Design**: Adapts beautifully to mobile, tablet, and desktop viewports, with a collapsible sidebar and sliding now-playing panel.

---

## 📁 Project Structure

```
swift/
│
├── index.html        # Main music player UI (landing page & dashboard)
├── admin.html        # Admin panel interface
├── script.js         # Core player, search, favorites, lyrics, and keyboard bindings
├── admin.js          # Admin dashboard actions & Supabase syncing
├── style.css         # Foundational CSS design system, typography, & styling
├── logo.png          # Branding asset
└── favicon.ico       # App icon
```

---

## 🛠️ Tech Stack

- **HTML5** & **Semantic Layouts**
- **CSS3** (Custom design system variables, glassmorphism, responsive grid layouts)
- **JavaScript** (Vanilla ES6+ modules & event handling)
- **Database** (Supabase real-time database storage for user roles and song metadata)

---

## 🎹 Keyboard Shortcuts

The app supports key-press control commands, with a visual guide available in the **Settings** view:

| Action | Shortcut Key |
| :--- | :--- |
| **Play / Pause** | `Space` |
| **Next Track** | `N` or `→` (Arrow Right) |
| **Previous Track** | `P` or `←` (Arrow Left) |
| **Volume Up** | `↑` (Arrow Up) |
| **Volume Down** | `↓` (Arrow Down) |
| **Mute / Unmute** | `M` |
| **Toggle Now Playing Panel** | `L` |

---

## ⚙️ Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/PhantomCodeGhost/swift.git
cd swift
```

### 2. Run locally
Since the project is built entirely on vanilla web standards, you can open `index.html` directly or run a lightweight local server:

Using python:
```bash
python -m http.server 8000
```
Or node:
```bash
npx serve .
```

---

## 🌐 Deployment

This project is fully static and can be deployed directly to:
- Netlify  
- Vercel  
- GitHub Pages  

---

## 🔐 Admin Panel

Access the dashboard by visiting:
```
/admin.html
```
Role-based access requires logging in using configured administrator credentials to upload, modify, or delete audio tracks and lyric timings.

---

## 🧑‍💻 Author

- **Parth Lohar** ([PhantomCodeGhost](https://github.com/PhantomCodeGhost))

---

## 📄 License

MIT License
