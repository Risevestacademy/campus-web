import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/core/seo";

export const alt = `${SITE_NAME}: your people, your place, your campus.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse cannot read CSS variables; these mirror --color-cobalt-500,
// --color-lemon-400 and --color-neutral-50 in app/globals.css.
const COBALT = "#3155d6";
const LEMON = "#ffd23e";
const PAPER = "#f7f7f7";

// Next resolves file-convention assets from the project root, not this file.
async function readLogoMark(): Promise<string> {
  const svg = await readFile(
    join(process.cwd(), "assets/icon-inverse.svg"),
    "base64",
  );

  return `data:image/svg+xml;base64,${svg}`;
}

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 80,
        background: COBALT,
        color: PAPER,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <img src={await readLogoMark()} alt="" width={60} height={92} />
        <span style={{ fontSize: 40, fontWeight: 600 }}>{SITE_NAME}</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: -3,
          textTransform: "uppercase",
        }}
      >
        <span>Your people.</span>
        <span>Your place.</span>
        <span style={{ color: LEMON }}>Your campus.</span>
      </div>
    </div>,
    size,
  );
}
