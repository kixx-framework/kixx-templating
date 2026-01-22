# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
# Run linting and all tests
npm test

# Run linting only
npm run lint

# Run tests only (without linting)
node ./test/run-tests.js
```

There is no build step - this is a pure ES module library.

## Architecture

Kixx Templating is a mustache-style templating engine with a three-phase compilation pipeline:

### Compilation Pipeline

1. **Tokenize** (`lib/tokenize.js`) - Splits template source into tokens based on `{{` `}}` delimiters and `{{!-- --}}` comments
2. **Build Syntax Tree** (`lib/build-syntax-tree.js`) - Parses tokens into an AST with node types: `CONTENT`, `COMMENT`, `PATH_EXPRESSION`, `HELPER_EXPRESSION`, `BLOCK_OPEN`, `BLOCK_CLOSE`, `PARTIAL`, `ELSE`
3. **Create Render Function** (`lib/create-render-function.js`) - Transforms AST into an executable render function that accepts a context object

### Key Exports (`mod.js`)

- `tokenize(options, filename, utf8)` - Phase 1
- `buildSyntaxTree(options, tokens)` - Phase 2
- `createRenderFunction(options, helpers, partials, tokens)` - Phase 3
- `helpers` - Map of built-in helper functions
- `escapeHTMLChars(str)` - HTML entity escaping utility

### Built-in Helpers (`lib/helpers/`)

Located in `lib/helpers/mod.js` as a Map:
- `each` - Iterate over Arrays, Maps, Sets, or plain objects with block params
- `if` - Conditional rendering with else support
- `ifEmpty` - Render if value is empty/falsy
- `ifEqual` - Strict equality comparison
- `noop` - Pass-through (used to prevent HTML escaping)

### Helper Function Signature

Helpers receive `this` context with:
- `this.blockParams` - Array of block parameter names from `|param1, param2|`
- `this.renderPrimary(newContext)` - Render the primary block content
- `this.renderInverse(newContext)` - Render the else block content

Function signature: `function(context, namedArgs, ...positionalArgs)`

### Test Structure

Tests in `test/` use `kixx-assert` for assertions. The test runner:
1. Runs expected error cases (`expected-error-cases.js`)
2. Compares tokenize/AST output against JSON snapshots in `test/partials/*.json` and `test/templates/*.json`
3. Renders full templates and compares against `test/output-snapshot.html`

Template engine integration example is in `test/template-engine.js`.

## Template Syntax

- Variables: `{{ variable }}`, `{{ object.property }}`, `{{ array[0] }}`
- Block helpers: `{{#helper}}...{{else}}...{{/helper}}`
- Block params: `{{#each items as |item, index|}}...{{/each}}`
- Partials: `{{> partial-name.html }}`
- Comments: `{{!-- comment --}}`
- Named args: `{{ helper arg key=value }}`

Path expressions are auto-escaped for HTML; helper output is not escaped.
