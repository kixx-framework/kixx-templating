// CLI utility to generate syntax tree (AST) snapshot files for test fixtures.
//
// Usage: node test/file-to-syntax-tree.js path/to/template.html
//
// Output: Creates a .tree.json file with the same name in the
// same directory as the input file.

import process from 'node:process';
import path from 'node:path';
import tokenize from '../lib/tokenize.js';
import buildSyntaxTree from '../lib/build-syntax-tree.js';
import { readUtf8File, saveSyntaxTreeFile } from './shared.js';


async function main() {
    const filepath = path.resolve(process.argv[2]);

    // Extract directory and filename separately for saving the output file.
    const dirpath = path.dirname(filepath);
    const filename = path.basename(filepath);

    const utf8 = await readUtf8File(filepath);

    // Run the tokenizer (first phase of the compilation pipeline).
    // The first argument (options) is unused, so we pass null.
    const tokens = tokenize(null, filename, utf8);

    // Build the syntax tree (second phase of the compilation pipeline).
    const tree = buildSyntaxTree(null, tokens);

    // Save the AST as a JSON file (e.g., template.html -> template.tree.json).
    await saveSyntaxTreeFile(dirpath, filename, tree);
}

// eslint-disable-next-line no-console
main().catch((err) => console.error(err));
