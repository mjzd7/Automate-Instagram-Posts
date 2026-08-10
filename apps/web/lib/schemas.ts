// Reuses packages/core's own zod schemas rather than re-deriving validation
// rules the pipeline already enforces on data/accounts.json and
// data/categories.json. Extensionless imports (not "core/src/.../accounts.js")
// -- see docs/LEARNINGS.md FR-006 for why apps/web can't use the .js-suffixed
// convention the rest of packages/core uses for its own tsx/Node runtime.
export { accountSchema, type Account } from "core/src/config/accounts";
export { categorySchema, type Category } from "core/src/config/categories";
