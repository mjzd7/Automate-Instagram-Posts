import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcFontsDir = resolve(__dirname, "fonts");

// 1. Set FONTCONFIG_FILE environment variables for Linux/macOS Fontconfig
const fontsConfPath = resolve(srcFontsDir, "fonts.conf");
if (existsSync(fontsConfPath)) {
  process.env.FONTCONFIG_FILE = fontsConfPath;
  process.env.FONTCONFIG_PATH = srcFontsDir;
}

// 2. Automatically sync TTF fonts to ~/Library/Fonts/ on macOS for native Sharp/Pango resolution
try {
  const userFontsDir = resolve(homedir(), "Library/Fonts/automate-instagram-posts");
  if (!existsSync(userFontsDir)) {
    mkdirSync(userFontsDir, { recursive: true });
  }
  const files = readdirSync(srcFontsDir);
  for (const file of files) {
    if (file.endsWith(".ttf")) {
      const src = resolve(srcFontsDir, file);
      const dest = resolve(userFontsDir, file);
      if (!existsSync(dest)) {
        copyFileSync(src, dest);
      }
    }
  }
} catch {
  // Graceful degrade if not on macOS or restricted sandbox
}
