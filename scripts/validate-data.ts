// prebuild: fail the build if data/latest.json or data/prices.json is missing or invalid.
import { join } from "node:path";
import { validateDataFiles } from "../lib/data/validate";

const { errors, warnings } = validateDataFiles(join(import.meta.dirname, "..", "data"), new Date());
for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
if (errors.length) {
  console.error(`validate-data: ${errors.length} error(s); refusing to build`);
  process.exit(1);
}
console.log("validate-data: data files OK");
