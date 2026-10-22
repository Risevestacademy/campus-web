import { z } from "zod";

import type { components } from "../client";

type Schemas = components["schemas"];

export const feedbackTypeSchema = z.toZod<Schemas["FeedbackType"]>()(
  z.enum(["bug", "idea", "report"]),
);

export const feedbackStatusSchema = z.toZod<Schemas["FeedbackStatus"]>()(
  z.enum(["open", "resolved"]),
);
