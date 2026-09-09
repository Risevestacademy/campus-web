export type LogValue = boolean | null | number | string;
export type LogFields = Readonly<Record<string, LogValue>>;

export interface Logger {
  error(event: string, fields: LogFields): void;
  info(event: string, fields: LogFields): void;
  warn(event: string, fields: LogFields): void;
}

type LogLevel = "error" | "info" | "warn";
type LogWriter = (record: string) => void;

export interface JsonLoggerOptions {
  errorWriter?: LogWriter;
  infoWriter?: LogWriter;
  now?: () => Date;
}

function writeToStandardOutput(record: string) {
  process.stdout.write(`${record}\n`);
}

function writeToStandardError(record: string) {
  process.stderr.write(`${record}\n`);
}

export function createJsonLogger(options: JsonLoggerOptions = {}): Logger {
  const now = options.now ?? (() => new Date());
  const infoWriter = options.infoWriter ?? writeToStandardOutput;
  const errorWriter = options.errorWriter ?? writeToStandardError;

  function write(
    level: LogLevel,
    event: string,
    fields: LogFields,
    writer: LogWriter,
  ) {
    writer(
      JSON.stringify({
        ...fields,
        timestamp: now().toISOString(),
        level,
        event,
      }),
    );
  }

  return {
    error: (event, fields) => write("error", event, fields, errorWriter),
    info: (event, fields) => write("info", event, fields, infoWriter),
    warn: (event, fields) => write("warn", event, fields, errorWriter),
  };
}
