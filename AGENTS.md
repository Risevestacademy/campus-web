<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Validation and data privacy

Before writing code that reads a value from outside the app (a Campus API
response, URL or search params, form data, browser storage, environment
variables, Sanity content, or a socket frame), follow "Validation and Data
Privacy" in `docs/architectural-plan.md`: parse with Zod where the value
enters, keep only the fields that are read, and send an allow-list.
