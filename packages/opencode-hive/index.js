// Local-directory plugin entry. OpenCode resolves `plugins` directory entries
// (and `.opencode/plugins/<pkg>/` discovery) against a root-level `index.js`;
// the real implementation lives in ./dist/index.js.
export { default } from './dist/index.js';
