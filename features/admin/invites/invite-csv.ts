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

  const [header, ...rows] = parseRecords(file.text.replace(/^\uFEFF/, ""));
  if (header === undefined) {
    return { kind: "invalid", message: "The file is empty." };
  }

  const columns = header.map((column) => column.trim().toLowerCase());
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

// The records of a file as a spreadsheet writes it: a quoted field may hold
// commas and line breaks, and "" is a quote inside one. Blank lines are not
// records.
function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (quoted) {
      if (char !== '"') field += char;
      else if (text.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(index + 1) === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  record.push(field);
  records.push(record);

  return records.filter((cells) => cells.some((cell) => cell.trim() !== ""));
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
