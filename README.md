<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ziaurrehman931554/ZeeVault/main/public/ZeeVault.png">
    <img src="https://raw.githubusercontent.com/ziaurrehman931554/ZeeVault/main/public/ZeeVault.png" alt="ZeeVault Logo" width="120" height="120">
  </picture>
  <h1>ZeeVault</h1>
  <p><strong>Encrypted Video Locker</strong></p>
  <p>
    <a href="https://ziaurrehman931554.github.io/ZeeVault/" target="_blank">
      <img src="https://img.shields.io/badge/🌐%20Web%20App-ZeeVault-blue?style=for-the-badge" alt="Web App">
    </a>
    <a href="https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault-Setup-1.0.0.exe">
      <img src="https://img.shields.io/badge/⬇️%20Download%20Installer-Windows-success?style=for-the-badge" alt="Download Installer">
    </a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Electron-42-blue?logo=electron" alt="Electron">
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite" alt="Vite">
  </p>
</div>

---

## 📖 About

**ZeeVault** is a privacy‑focused desktop (Electron) and web application that lets you securely store, manage, and play your personal video collection. Your media files are encrypted at rest using XOR‑based encryption tied to a master password — the vault is never uploaded or sent anywhere; everything happens **locally on your machine**.

### Motivation

Modern media players and cloud storage services have access to your video content. ZeeVault was built for anyone who wants to keep private videos truly private. By encrypting files before they touch disk and decrypting them only in‑memory during playback, ZeeVault ensures that even if someone gains access to your storage, they cannot view your media without your password.

### Use Cases

- Store personal or family videos securely
- Encrypt sensitive media before syncing to cloud storage
- Keep a private video collection on a shared computer
- Organize and play encrypted media with a polished, native‑feeling interface

---

## ✨ Features

| Feature | Description |
|---|---|
| **XOR Encryption** | Fast, streaming XOR encryption with SHA‑256 derived keys |
| **Custom Video Player** | Glass‑UI player with zone‑based controls, mini‑player, and Apple‑TV‑style hide/show |
| **Cross‑Platform** | Works as a desktop app (Windows) and in any modern browser |
| **Persistent Folder** | Remembers your vault folder path for quick unlock |
| **Dark / Light Theme** | Adapts to your system theme automatically |
| **Mini Player** | Picture‑in‑picture style player that follows you through the gallery |
| **Responsive** | Works on desktop and mobile screen sizes |

---

## 🚀 Getting Started

### Option 1: Use the Web App (No install required)

Visit **[https://ziaurrehman931554.github.io/ZeeVault/](https://ziaurrehman931554.github.io/ZeeVault/)** in your browser.

> **Note:** The web version uses the browser file picker. You will need to select the vault folder each session.

### Option 2: Download the Desktop App (Windows)

1. Download the latest installer from the [Releases page](https://github.com/ziaurrehman931554/ZeeVault/releases/latest) or click the badge above.
2. Run `ZeeVault Setup 1.0.0.exe` and follow the installation wizard.
3. Launch ZeeVault from the Start Menu or desktop shortcut.

---

## 🔐 Encrypting Your Videos

To encrypt videos for use with ZeeVault, use the included PowerShell encryption script.

### Prerequisites

- Windows with PowerShell 5.1 or later
- [FFmpeg](https://ffmpeg.org/) (for automatic duration detection during encryption) — *optional but recommended*

### Using the Encryption Script

1. **Download the script** from the [Releases page](https://github.com/ziaurrehman931554/ZeeVault/releases/latest) (`ZeeVault.ps1`) or clone the repo.

2. **Place the script** in the folder containing your video files (supported formats: `.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`, `.ts`).

3. **Run the script** from PowerShell:

   ```powershell
   # Encrypt all media files in the current folder
   .\ZeeVault.ps1
   ```

   On first run, you will be prompted to create a vault password.

   **Or, provide the password directly (for automation):**

   ```powershell
   .\ZeeVault.ps1 -Password "your-secret-password"
   ```

4. The script will:
   - Encrypt each media file using XOR cipher with a key derived from your password
   - Rename encrypted files to random names (`.enc` extension)
   - Create a `vault.meta` file containing the password hash and file manifest
   - Generate a **new password hash** each time you encrypt, even with the same password

5. **To decrypt** (restore original files), run the script again in the same folder:

   ```powershell
   .\ZeeVault.ps1
   ```

   The script detects the current vault state (encrypted/decrypted) and toggles automatically.

> **Security Note:** The encryption operates on the entire file using a streaming XOR cipher. While fast and effective for local privacy, it is not a substitute for AES‑grade encryption for high‑security scenarios. The password is verified locally and never transmitted.

### Compiling to .exe (Optional)

To compile the script into a standalone `.exe` (no PowerShell required to run):

```powershell
# Install ps2exe module
Install-Module -Name ps2exe -Force

# Compile
ps2exe .\ZeeVault.ps1 .\ZeeVault.exe -title "ZeeVault Encryptor"
```

---

## 🛠️ How to Use the App

### First Time

1. Launch ZeeVault (web or desktop).
2. Click **Browse** and select the folder containing your encrypted `.enc` files and `vault.meta`.
3. Enter your vault password and click **Unlock Vault**.
4. Browse your video gallery — click any video to play.

### Quick Unlock

After unlocking once in the desktop app, your folder path is saved. On subsequent launches, you'll see a Quick Unlock card — just enter your password and go.

### Playing Videos

- **Click** a video thumbnail to open the player
- **Hover** near the top or bottom of the player to reveal controls
- **Space** or **click center** to play/pause
- **Press `v`** to toggle the mini player (keeps playing while you browse)
- **Press `Esc`** or click the close button to exit the player
- **Press `c`** to clear the vault cache

### Lock Screen

Press the lock button to lock the app — your password is required to resume.

---

## 🧱 Built With

| Technology | Purpose |
|---|---|
| [React 18](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Vite](https://vitejs.dev/) | Build tool |
| [Electron](https://www.electronjs.org/) | Desktop shell |
| [Zustand](https://github.com/pmndrs/zustand) | State management |
| [Crypto‑JS](https://github.com/brix/crypto-js) | Password hashing (SHA‑256) |
| [FFmpeg WASM](https://github.com/ffmpegwasm/ffmpeg.wasm) | Video processing in browser |
| [Tailwind CSS 4](https://tailwindcss.com/) | Styling |

---

## 📦 Download

| Asset | Link |
|---|---|
| **Web App** | [https://ziaurrehman931554.github.io/ZeeVault/](https://ziaurrehman931554.github.io/ZeeVault/) |
| **Windows Installer** | [ZeeVault Setup 1.0.0.exe](https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault-Setup-1.0.0.exe) |
| **Encryption Script** | [ZeeVault.ps1](https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault.ps1) |
| **ZIP (portable)** | [ZeeVault-win32-x64.zip](https://github.com/ziaurrehman931554/ZeeVault/releases/latest/download/ZeeVault-win32-x64.zip) |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/ziaurrehman931554/ZeeVault/issues).

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/ziaurrehman931554">Zia Ur Rehman</a></p>
</div>
