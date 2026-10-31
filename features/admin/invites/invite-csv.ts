// What campus-api reads from a cohort's file: UTF-8, comma-separated, a header
// row, up to this many rows and bytes.
export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 256 * 1024;

const REQUIRED_COLUMNS = ["email", "role"];

export type CsvRead =
  { kind: "ready"; rows: number } | { kind: "invalid"; message: string };

// A check before upload, so a file campus-api would refuse as a whole is
// caught without a round trip. Each row is still judged by campus-api.
export function readInviteCsv(file: {
  name: string;
  size: number;
  text: string;
}): CsvRead {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { kind: "invalid", message: "Choose a .csv file." };
  }
  if (file.size > CSV_MAX_BYTES) {
    return {
      kind: "invalid",
      message: `The file is over ${CSV_MAX_BYTES / 1024} KB. Split it and upload the parts.`,
    };
  }

  const [header, ...rows] = file.text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (header === undefined) {
    return { kind: "invalid", message: "The file is empty." };
  }

  const columns = header
    .split(",")
    .map((column) => column.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    return {
      kind: "invalid",
      message: `The first line must name the columns. Missing: ${missing.join(", ")}.`,
    };
  }
  if (rows.length === 0) {
    return {
      kind: "invalid",
      message: "The file has no rows under its header.",
    };
  }
  if (rows.length > CSV_MAX_ROWS) {
    return {
      kind: "invalid",
      message: `A file may hold at most ${CSV_MAX_ROWS} invites, and this one has ${rows.length}.`,
    };
  }

  return { kind: "ready", rows: rows.length };
}

export const TEMPLATE_FILE_NAME = "invite-template.csv";

// A starting file that downloads from the page itself, with a real track code
// from the cohort when there is one.
export function templateHref(trackCode: string | undefined): string {
  const csv = [
    "email,role,track",
    `ada@example.com,student,${trackCode ?? ""}`,
    "grace@example.com,professor,",
    "",
  ].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}
