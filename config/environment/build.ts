import { publicEnvironment } from "./public";

export const buildEnvironment = Object.freeze({
  CI: process.env.CI,
  VERCEL: process.env.VERCEL,
  ...publicEnvironment,
});
