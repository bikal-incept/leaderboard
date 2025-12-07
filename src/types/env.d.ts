// Minimal shims so that backend-only service files can compile in this
// frontend-oriented TypeScript project without bringing in full Node typings.

declare const process: {
  env: Record<string, string | undefined>;
};

declare module 'pg' {
  // Use `any` here so we don't depend on the real `pg` type definitions.
  const pg: any;
  export default pg;
}


