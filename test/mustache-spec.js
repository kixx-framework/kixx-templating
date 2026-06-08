import process from 'node:process';
import fsp from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';

import { tokenize, buildSyntaxTree, createRenderFunction } from '../mod.js';


// The Mustache spec is split across these files. The core six define compliance;
// the "~" prefixed files are OPTIONAL parts of the spec and are tracked separately.
const CORE_FILES = [
    'interpolation',
    'sections',
    'inverted',
    'comments',
    'partials',
    'delimiters',
];

const OPTIONAL_FILES = [
    '~lambdas',
    '~dynamic-names',
    '~inheritance',
];

const SPEC_DIR_URL = new URL('./mustache-spec/', import.meta.url);
const BASELINE_URL = new URL('./mustache-spec-baseline.json', import.meta.url);
const REPORT_URL = new URL('../tmp/mustache-conformance-report.md', import.meta.url);
const ENGINE_LABEL = 'current Kixx (through Phase 3 partial semantics; standalone whitespace deferred)';


// Render a single spec test through the CURRENT Kixx pipeline. No helpers are
// registered: spec compliance is measured against pure data-driven behavior.
function runSpecTest(test) {
    const helpers = new Map();
    const partials = new Map();

    const data = materializeData(test.data);

    if (test.partials) {
        for (const name of Object.keys(test.partials)) {
            const tokens = tokenize(null, name, test.partials[name]);
            const tree = buildSyntaxTree(null, tokens);
            // Kixx resolves partials lazily at render time, so forward/recursive
            // references between partials resolve against this shared Map.
            partials.set(name, createRenderFunction(null, helpers, partials, tree));
        }
    }

    const tokens = tokenize(null, test.name, test.template);
    const tree = buildSyntaxTree(null, tokens);
    const render = createRenderFunction(null, helpers, partials, tree);
    return render(data);
}

// Spec lambdas are encoded as { __tag__: "code", js: "...", ... }. Reconstruct the
// JS function so lambda tests can execute once the engine supports them. This uses
// the Function constructor, which is acceptable in TEST tooling (it never ships in
// the library, where it is a hard constraint).
function materializeData(value) {
    if (!value || typeof value !== 'object') {
        return value;
    }
    if (value.__tag__ === 'code' && typeof value.js === 'string') {
        // eslint-disable-next-line no-new-func
        return Function(`return (${ value.js });`)();
    }
    if (Array.isArray(value)) {
        return value.map(materializeData);
    }
    const out = {};
    for (const key of Object.keys(value)) {
        out[key] = materializeData(value[key]);
    }
    return out;
}

function evaluate(test) {
    let output;
    try {
        output = runSpecTest(test);
    } catch (error) {
        return { outcome: 'threw', error: error.message || String(error) };
    }

    if (output === test.expected) {
        return { outcome: 'pass', output };
    }
    return { outcome: 'fail', output };
}

// Heuristic root-cause tagging so the report explains WHY a test fails, grouping
// failures by the engine gap responsible rather than listing raw diffs.
function classifyCause(spec, test, result) {
    if (result.outcome === 'pass') {
        return null;
    }

    if (spec.file === '~lambdas') {
        return 'lambdas';
    }
    if (spec.file === '~dynamic-names') {
        return 'dynamic-names';
    }
    if (spec.file === '~inheritance') {
        return 'inheritance';
    }

    const tpl = test.template;
    const err = result.error || '';

    if (/\{\{\s*=/.test(tpl)) {
        return 'set-delimiters';
    }
    if (/\{\{!(?!--)/.test(tpl)) {
        return 'comment-syntax';
    }
    if (/\{\{\^/.test(tpl)) {
        return 'inverted-section';
    }
    if (/\{\{\{|\{\{&/.test(tpl)) {
        return 'unescaped-mustache';
    }
    if (/No partial named/.test(err)) {
        return 'partial-missing-throws';
    }
    if (/No helper named/.test(err)) {
        return 'implicit-section';
    }
    if (/\{\{#/.test(tpl)) {
        return 'implicit-section';
    }
    if (/\{\{\s*\.\s*\}\}/.test(tpl)) {
        return 'implicit-iterator';
    }

    if (result.outcome === 'fail') {
        if (whitespaceOnlyDiff(result.output, test.expected)) {
            return 'standalone-whitespace';
        }
        if (escapingSupersetDiff(result.output, test.expected)) {
            return 'escaping-superset';
        }
    }

    return 'other';
}

function whitespaceOnlyDiff(output, expected) {
    return output !== expected
        && output.replace(/\s+/g, '') === expected.replace(/\s+/g, '');
}

function escapingSupersetDiff(output, expected) {
    const deEscaped = output
        .replace(/&#x27;/g, "'")
        .replace(/&#x3D;/g, '=')
        .replace(/&#x60;/g, '`');
    return output !== expected && deEscaped === expected;
}


async function loadSpecFile(file) {
    const url = new URL(`${ file }.json`, SPEC_DIR_URL);
    const json = await fsp.readFile(fileURLToPath(url), { encoding: 'utf8' });
    const parsed = JSON.parse(json);
    return { file, optional: file.startsWith('~'), tests: parsed.tests };
}

async function runAll() {
    const files = CORE_FILES.concat(OPTIONAL_FILES);
    const specs = await Promise.all(files.map(loadSpecFile));

    const results = [];

    for (const spec of specs) {
        for (const test of spec.tests) {
            const id = `${ spec.file }:${ test.name }`;
            const result = evaluate(test);
            const cause = classifyCause(spec, test, result);
            results.push({
                id,
                file: spec.file,
                optional: spec.optional,
                name: test.name,
                outcome: result.outcome,
                cause,
            });
        }
    }

    return results;
}

function toBaseline(results) {
    const tests = {};
    for (const r of results) {
        tests[r.id] = r.cause ? { outcome: r.outcome, cause: r.cause } : { outcome: r.outcome };
    }
    return tests;
}

async function readCommit() {
    try {
        const url = new URL('./COMMIT.txt', SPEC_DIR_URL);
        const txt = await fsp.readFile(fileURLToPath(url), { encoding: 'utf8' });
        return txt.trim();
    } catch {
        return 'unknown';
    }
}


function summarize(results) {
    const byFile = new Map();
    const byCause = new Map();
    let corePass = 0;
    let coreTotal = 0;

    for (const r of results) {
        if (!byFile.has(r.file)) {
            byFile.set(r.file, { pass: 0, fail: 0, threw: 0, total: 0, optional: r.optional });
        }
        const f = byFile.get(r.file);
        f.total += 1;
        f[r.outcome] += 1;

        if (!r.optional) {
            coreTotal += 1;
            if (r.outcome === 'pass') {
                corePass += 1;
            }
        }
        if (r.cause) {
            byCause.set(r.cause, (byCause.get(r.cause) || 0) + 1);
        }
    }

    return { byFile, byCause, corePass, coreTotal };
}

function outcomeMark(outcome) {
    if (outcome === 'pass') {
        return '✅';
    }
    if (outcome === 'threw') {
        return '💥';
    }
    return '❌';
}

async function writeReport(results, commit) {
    const { byFile, byCause, corePass, coreTotal } = summarize(results);
    const pct = (n, d) => (d === 0 ? '0' : ((n / d) * 100).toFixed(1));

    const lines = [];
    lines.push('# Mustache Conformance Report');
    lines.push('');
    lines.push(`Spec commit: \`${ commit }\``);
    lines.push(`Generated: ${ new Date().toISOString() }`); // eslint-disable-line no-undef
    lines.push(`Engine: ${ ENGINE_LABEL }`);
    lines.push('');
    lines.push(`**Core compliance: ${ corePass } / ${ coreTotal } (${ pct(corePass, coreTotal) }%)**`);
    lines.push('');

    lines.push('## Per-file results');
    lines.push('');
    lines.push('| File | Tier | Pass | Fail | Threw | Total | Pass % |');
    lines.push('|------|------|------|------|-------|-------|--------|');
    for (const [ file, f ] of byFile) {
        const tier = f.optional ? 'optional' : 'core';
        lines.push(`| ${ file } | ${ tier } | ${ f.pass } | ${ f.fail } | ${ f.threw } | ${ f.total } | ${ pct(f.pass, f.total) } |`);
    }
    lines.push('');

    lines.push('## Failure causes');
    lines.push('');
    lines.push('| Cause | Count |');
    lines.push('|-------|-------|');
    const causes = [ ...byCause.entries() ].sort((a, b) => b[1] - a[1]);
    for (const [ cause, count ] of causes) {
        lines.push(`| ${ cause } | ${ count } |`);
    }
    lines.push('');

    lines.push('## Detail');
    lines.push('');
    let currentFile = null;
    for (const r of results) {
        if (r.file !== currentFile) {
            currentFile = r.file;
            lines.push('');
            lines.push(`### ${ r.file }${ r.optional ? ' (optional)' : '' }`);
            lines.push('');
        }
        const mark = outcomeMark(r.outcome);
        const tag = r.cause ? ` _(${ r.cause })_` : '';
        lines.push(`- ${ mark } ${ r.name }${ tag }`);
    }
    lines.push('');

    await fsp.writeFile(fileURLToPath(REPORT_URL), lines.join('\n'), { encoding: 'utf8' });
}

async function writeBaseline(results, commit) {
    const baseline = {
        spec_commit: commit,
        note: 'Cause-tagged expected outcomes. `npm run spec` gates on actual === outcome. Regenerate with `node test/mustache-spec.js --update`.',
        tests: toBaseline(results),
    };
    await fsp.writeFile(
        fileURLToPath(BASELINE_URL),
        JSON.stringify(baseline, null, 2) + '\n',
        { encoding: 'utf8' },
    );
}

async function readBaseline() {
    try {
        const json = await fsp.readFile(fileURLToPath(BASELINE_URL), { encoding: 'utf8' });
        return JSON.parse(json).tests;
    } catch {
        return null;
    }
}

// Compare current results to the baseline. Gate on outcome (cause is informational).
function diffAgainstBaseline(results, baseline) {
    const regressions = [];
    const improvements = [];
    const added = [];

    const seen = new Set();
    for (const r of results) {
        seen.add(r.id);
        const expected = baseline[r.id];
        if (!expected) {
            added.push(r.id);
            continue;
        }
        if (r.outcome !== expected.outcome) {
            if (r.outcome === 'pass') {
                improvements.push(`${ r.id } (${ expected.outcome } -> pass)`);
            } else if (expected.outcome === 'pass') {
                regressions.push(`${ r.id } (pass -> ${ r.outcome })`);
            } else {
                // fail <-> threw: still a change worth surfacing, but not a regression.
                improvements.push(`${ r.id } (${ expected.outcome } -> ${ r.outcome })`);
            }
        }
    }

    const removed = Object.keys(baseline).filter((id) => !seen.has(id));
    return { regressions, improvements, added, removed };
}


async function main() {
    const args = process.argv.slice(2);
    const update = args.includes('--update');
    const report = update || args.includes('--report');

    const commit = await readCommit();
    const results = await runAll();
    const { corePass, coreTotal } = summarize(results);

    if (report) {
        await writeReport(results, commit);
    }

    if (update) {
        await writeBaseline(results, commit);
        // eslint-disable-next-line no-console
        console.log(`Baseline written. Core compliance: ${ corePass }/${ coreTotal }. Report: tmp/mustache-conformance-report.md`);
        return;
    }

    const baseline = await readBaseline();
    if (!baseline) {
        // eslint-disable-next-line no-console
        console.error('No baseline found. Run: node test/mustache-spec.js --update');
        process.exit(1);
        return;
    }

    const diff = diffAgainstBaseline(results, baseline);
    const log = (...a) => console.log(...a); // eslint-disable-line no-console

    log(`Mustache spec: core compliance ${ corePass }/${ coreTotal }`);

    if (diff.improvements.length > 0) {
        log(`\nImprovements (update the baseline to lock these in):`);
        diff.improvements.forEach((s) => log(`  + ${ s }`));
    }
    if (diff.added.length > 0) {
        log(`\nNew tests not in baseline:`);
        diff.added.forEach((s) => log(`  ? ${ s }`));
    }
    if (diff.removed.length > 0) {
        log(`\nBaseline tests no longer present:`);
        diff.removed.forEach((s) => log(`  - ${ s }`));
    }
    if (diff.regressions.length > 0) {
        log(`\nREGRESSIONS:`);
        diff.regressions.forEach((s) => log(`  ! ${ s }`));
        process.exit(1);
        return;
    }

    if (diff.improvements.length > 0 || diff.added.length > 0 || diff.removed.length > 0) {
        log(`\nNo regressions, but results drifted from baseline. Run --update to refresh.`);
        process.exit(1);
        return;
    }

    log('Matches baseline. No regressions.');
}

main().then(null, (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});
