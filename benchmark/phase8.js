import fsp from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';

import {
    tokenize,
    buildSyntaxTree,
    createRenderFunction,
    helpers as builtinHelpers,
} from '../mod.js';


const REPORT_PATHNAME = new URL('../tmp/phase8-benchmark-report.md', import.meta.url);
const DEFAULT_SAMPLE_MS = 250;
const DEFAULT_WARMUP_MS = 100;
const DEFAULT_SAMPLES = 5;
const DEFAULT_ITEMS = 250;

let consumed = 0;


async function main() {
    const options = parseArgs(process.argv.slice(2));
    const items = makeItems(options.items);
    const benchmarks = createCurrentEngineBenchmarks(items)
        .concat(createOutputBufferingBenchmarks(items))
        .concat(createScopeRepresentationBenchmarks(items));

    const results = [];

    for (const bench of benchmarks) {
        results.push(measureBenchmark(bench, options));
    }

    const report = createReport(results, options);

    if (options.report) {
        await fsp.mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
        await fsp.writeFile(REPORT_PATHNAME, report, { encoding: 'utf8' });
    }

    printSummary(results, options);

    // Keep the benchmark return values observable.
    if (consumed === -1) {
        console.log(''); // eslint-disable-line no-console
    }
}

function parseArgs(argv) {
    const options = {
        items: DEFAULT_ITEMS,
        report: true,
        sampleMs: DEFAULT_SAMPLE_MS,
        samples: DEFAULT_SAMPLES,
        warmupMs: DEFAULT_WARMUP_MS,
    };

    for (const arg of argv) {
        if (arg === '--no-report') {
            options.report = false;
        } else if (arg === '--quick') {
            options.sampleMs = 100;
            options.warmupMs = 50;
            options.samples = 3;
        } else if (arg.startsWith('--items=')) {
            options.items = positiveInteger(arg, '--items=');
        } else if (arg.startsWith('--sample-ms=')) {
            options.sampleMs = positiveInteger(arg, '--sample-ms=');
        } else if (arg.startsWith('--samples=')) {
            options.samples = positiveInteger(arg, '--samples=');
        } else if (arg.startsWith('--warmup-ms=')) {
            options.warmupMs = positiveInteger(arg, '--warmup-ms=');
        }
    }

    return options;
}

function positiveInteger(arg, prefix) {
    const value = Number.parseInt(arg.slice(prefix.length), 10);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Expected ${ prefix }<positive integer>`);
    }
    return value;
}

function makeItems(count) {
    const items = [];
    for (let i = 0; i < count; i += 1) {
        items.push({
            id: i,
            name: `Item ${ i }`,
            type: i % 2 === 0 ? 'even' : 'odd',
            meta: {
                score: i * 3,
                label: `L${ i }`,
            },
        });
    }
    return items;
}

function createCurrentEngineBenchmarks(items) {
    const itemsMap = new Map();
    const itemsObject = {};
    for (let i = 0; i < items.length; i += 1) {
        itemsMap.set(`item-${ i }`, items[i]);
        itemsObject[`item-${ i }`] = items[i];
    }

    const baseData = {
        site: 'Kixx',
        items,
        itemsMap,
        itemsObject,
        level1: [
            {
                name: 'A',
                level2: [
                    {
                        name: 'B',
                        level3: [
                            { name: 'C' },
                            { name: 'D' },
                        ],
                    },
                ],
            },
        ],
    };

    const helperMap = new Map(builtinHelpers);
    helperMap.set('label', (_context, options, value) => {
        return `${ options.prefix }:${ value }`;
    });

    const partials = new Map();
    partials.set(
        'row',
        compileTemplate('row', '{{site}}/{{name}}/{{meta.score}}\n', new Map()),
    );

    return [
        currentEngineBenchmark(
            'array-section',
            '{{#items}}<li>{{site}}/{{name}}/{{meta.score}}</li>\n{{/items}}',
            baseData,
        ),
        currentEngineBenchmark(
            'map-section',
            '{{#itemsMap}}<li>{{site}}/{{name}}/{{meta.score}}</li>\n{{/itemsMap}}',
            baseData,
        ),
        currentEngineBenchmark(
            'object-section',
            '{{#itemsObject}}<li>{{site}}/{{name}}/{{meta.score}}</li>\n{{/itemsObject}}',
            baseData,
        ),
        currentEngineBenchmark(
            'deep-stack',
            '{{#level1}}{{site}}/{{name}}:{{#level2}}{{site}}/{{name}}:{{#level3}}{{site}}/{{name}};{{/level3}}{{/level2}}{{/level1}}',
            baseData,
        ),
        currentEngineBenchmark(
            'helper-heavy',
            '{{#each items as |item index|}}{{label item.name prefix=site}}#{{index}};{{/each}}',
            baseData,
            helperMap,
        ),
        currentEngineBenchmark(
            'partial-heavy',
            '{{#items}}{{> row}}{{/items}}',
            baseData,
            new Map(),
            partials,
        ),
    ];
}

function currentEngineBenchmark(name, source, data, helpers, partials) {
    const partialLookup = partials || new Map();
    const render = compileTemplate(name, source, helpers || new Map());

    return {
        group: 'current-engine',
        name,
        run() {
            return render(data, partialLookup);
        },
    };
}

function compileTemplate(name, source, helpers) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    return createRenderFunction(null, helpers, tree);
}

function createOutputBufferingBenchmarks(items) {
    const returnString = createReturnStringOutputRenderer(items);
    const writerSink = createWriterSinkOutputRenderer(items);

    assertSameOutput('output-buffering', returnString, writerSink);

    return [
        {
            group: 'output-buffering',
            name: 'return-string',
            run: returnString,
        },
        {
            group: 'output-buffering',
            name: 'writer-sink',
            run: writerSink,
        },
    ];
}

function createReturnStringOutputRenderer(items) {
    const itemSteps = [
        () => '<li>',
        (item) => item.name,
        () => ':',
        (item) => String(item.meta.score),
        () => ':',
        (item) => item.type,
        () => '</li>\n',
    ];

    return function renderReturnStringOutput() {
        let out = '<ul>\n';
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            for (let j = 0; j < itemSteps.length; j += 1) {
                out += itemSteps[j](item);
            }
        }
        return out + '</ul>\n';
    };
}

function createWriterSinkOutputRenderer(items) {
    const itemSteps = [
        (_item, out) => out.push('<li>'),
        (item, out) => out.push(item.name),
        (_item, out) => out.push(':'),
        (item, out) => out.push(String(item.meta.score)),
        (_item, out) => out.push(':'),
        (item, out) => out.push(item.type),
        (_item, out) => out.push('</li>\n'),
    ];

    return function renderWriterSinkOutput() {
        const out = [ '<ul>\n' ];
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            for (let j = 0; j < itemSteps.length; j += 1) {
                itemSteps[j](item, out);
            }
        }
        out.push('</ul>\n');
        return out.join('');
    };
}

function createScopeRepresentationBenchmarks(items) {
    const linked = createLinkedScopeRenderer(items);
    const prototypeCopy = createPrototypeCopyScopeRenderer(items);
    const contextCopy = createContextCopyScopeRenderer(items);

    assertSameOutput('scope-representation', linked, prototypeCopy);
    assertSameOutput('scope-representation', linked, contextCopy);

    return [
        {
            group: 'scope-representation',
            name: 'linked-frames',
            run: linked,
        },
        {
            group: 'scope-representation',
            name: 'prototype-copy',
            run: prototypeCopy,
        },
        {
            group: 'scope-representation',
            name: 'context-copy',
            run: contextCopy,
        },
    ];
}

function createLinkedScopeRenderer(items) {
    const rootFrame = {
        value: {
            site: 'Kixx',
            suffix: '!',
        },
        parent: null,
    };

    return function renderLinkedScope() {
        let out = '';
        for (let i = 0; i < items.length; i += 1) {
            const frame = { value: items[i], parent: rootFrame };
            out += lookupLinked(frame, [ 'site' ]);
            out += ':';
            out += lookupLinked(frame, [ 'name' ]);
            out += ':';
            out += lookupLinked(frame, [ 'meta', 'score' ]);
            out += lookupLinked(frame, [ 'suffix' ]);
            out += '\n';
        }
        return out;
    };
}

function createPrototypeCopyScopeRenderer(items) {
    const rootScope = {
        site: 'Kixx',
        suffix: '!',
    };

    return function renderPrototypeCopyScope() {
        let out = '';
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const scope = Object.create(rootScope);
            const keys = Object.keys(item);
            for (let j = 0; j < keys.length; j += 1) {
                scope[keys[j]] = item[keys[j]];
            }

            out += scope.site;
            out += ':';
            out += scope.name;
            out += ':';
            out += scope.meta.score;
            out += scope.suffix;
            out += '\n';
        }
        return out;
    };
}

function createContextCopyScopeRenderer(items) {
    const rootContext = {
        site: 'Kixx',
        suffix: '!',
    };

    return function renderContextCopyScope() {
        let out = '';
        for (let i = 0; i < items.length; i += 1) {
            const context = Object.assign({}, rootContext, items[i]);

            out += context.site;
            out += ':';
            out += context.name;
            out += ':';
            out += context.meta.score;
            out += context.suffix;
            out += '\n';
        }
        return out;
    };
}

function lookupLinked(frame, segments) {
    const first = segments[0];
    let container;

    for (let f = frame; f; f = f.parent) {
        const value = f.value;
        if (value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, first)) {
            container = value;
            break;
        }
    }

    if (typeof container === 'undefined') {
        return '';
    }

    let current = container[first];
    for (let i = 1; i < segments.length; i += 1) {
        if (current === null || typeof current === 'undefined') {
            return '';
        }
        current = current[segments[i]];
    }
    return current;
}

function assertSameOutput(name, a, b) {
    const expected = a();
    const actual = b();

    if (expected !== actual) {
        throw new Error(`${ name } benchmark variants produced different output`);
    }
}

function measureBenchmark(bench, options) {
    runFor(bench.run, options.warmupMs);

    const samples = [];
    for (let i = 0; i < options.samples; i += 1) {
        samples.push(runFor(bench.run, options.sampleMs));
    }

    const rates = samples.map((sample) => sample.opsPerSecond).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)];

    return {
        group: bench.group,
        name: bench.name,
        opsPerSecond: median,
        samples,
    };
}

function runFor(fn, minimumMs) {
    const started = performance.now();
    let iterations = 0;
    let elapsed = 0;

    do {
        consume(fn());
        iterations += 1;
        elapsed = performance.now() - started;
    } while (elapsed < minimumMs);

    return {
        iterations,
        ms: elapsed,
        opsPerSecond: iterations / (elapsed / 1000),
    };
}

function consume(value) {
    consumed = (consumed + String(value).length) % 1000000007;
}

function createReport(results, options) {
    const generatedAt = new Date().toISOString(); // eslint-disable-line no-undef
    const outputDecision = decideBetween(results, 'output-buffering', 'return-string', 'writer-sink');
    const scopeDecision = decideBetween(results, 'scope-representation', 'linked-frames', 'prototype-copy');

    const lines = [];
    lines.push('# Phase 8 Benchmark Report');
    lines.push('');
    lines.push(`Generated: ${ generatedAt }`);
    lines.push(`Node: ${ process.version }`);
    lines.push(`Platform: ${ os.platform() } ${ os.arch() }`);
    lines.push(`Items per render: ${ options.items }`);
    lines.push(`Samples: ${ options.samples } x ${ options.sampleMs }ms, warmup ${ options.warmupMs }ms`);
    lines.push('');
    lines.push('## Decisions');
    lines.push('');
    lines.push(`- Output buffering: **${ outputDecision.winner }** (${ outputDecision.summary }).`);
    lines.push(`- Scope representation: **${ scopeDecision.winner }** (${ scopeDecision.summary }).`);
    lines.push('');
    lines.push('These benchmarks keep the current production representation locked in when the');
    lines.push('incumbent is faster or when the challenger is not clearly better. A future rewrite');
    lines.push('should rerun this script on target runtimes before changing the hot path.');
    lines.push('');
    lines.push('## Current Engine Workloads');
    lines.push('');
    appendGroupTable(lines, results, 'current-engine');
    lines.push('');
    lines.push('## Candidate Hot Paths');
    lines.push('');
    appendGroupTable(lines, results, 'output-buffering');
    lines.push('');
    appendGroupTable(lines, results, 'scope-representation');
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push('- `return-string` models the current closure shape: each step returns a string and its parent concatenates.');
    lines.push('- `writer-sink` models passing one output array through child steps and joining once at the top.');
    lines.push('- `linked-frames` models the current `{ value, parent }` frame stack and explicit Mustache lookup.');
    lines.push('- `prototype-copy` models `Object.create(parentScope)` plus copying item keys into each child scope.');
    lines.push('- `context-copy` models the old scope strategy: copy parent and child data into a fresh object.');
    lines.push('- Handlebars is not benchmarked here because it is not a project dependency; adding it would violate the zero-dependency benchmark constraint unless vendored separately.');
    lines.push('');

    return `${ lines.join('\n') }\n`;
}

function decideBetween(results, group, incumbentName, challengerName) {
    const incumbent = findResult(results, group, incumbentName);
    const challenger = findResult(results, group, challengerName);
    const ratio = challenger.opsPerSecond / incumbent.opsPerSecond;
    const percent = Math.abs((ratio - 1) * 100).toFixed(1);

    if (ratio > 1.10) {
        return {
            winner: challengerName,
            summary: `${ challengerName } was ${ percent }% faster than ${ incumbentName }`,
        };
    }
    if (ratio < 0.90) {
        return {
            winner: incumbentName,
            summary: `${ incumbentName } was ${ percent }% faster than ${ challengerName }`,
        };
    }

    return {
        winner: incumbentName,
        summary: `${ challengerName } was within ${ percent }% of ${ incumbentName }, below the 10% rewrite threshold`,
    };
}

function findResult(results, group, name) {
    const result = results.find((r) => r.group === group && r.name === name);
    if (!result) {
        throw new Error(`No benchmark result for ${ group }/${ name }`);
    }
    return result;
}

function appendGroupTable(lines, results, group) {
    const groupResults = results.filter((result) => result.group === group);
    const fastest = Math.max(...groupResults.map((result) => result.opsPerSecond));

    lines.push('| Benchmark | Ops/sec | Relative |');
    lines.push('|-----------|--------:|---------:|');

    for (const result of groupResults) {
        const relative = result.opsPerSecond / fastest;
        lines.push(`| ${ result.name } | ${ formatNumber(result.opsPerSecond) } | ${ (relative * 100).toFixed(1) }% |`);
    }
}

function formatNumber(value) {
    return Math.round(value).toLocaleString('en-US');
}

function printSummary(results, options) {
    const reportPathname = REPORT_PATHNAME.pathname;
    const outputDecision = decideBetween(results, 'output-buffering', 'return-string', 'writer-sink');
    const scopeDecision = decideBetween(results, 'scope-representation', 'linked-frames', 'prototype-copy');

    console.log(`Phase 8 benchmarks complete (${ options.items } items/render).`); // eslint-disable-line no-console
    console.log(`Output buffering: ${ outputDecision.winner } - ${ outputDecision.summary }.`); // eslint-disable-line no-console
    console.log(`Scope representation: ${ scopeDecision.winner } - ${ scopeDecision.summary }.`); // eslint-disable-line no-console
    if (options.report) {
        console.log(`Report: ${ reportPathname }`); // eslint-disable-line no-console
    }
}

main().then(null, (error) => {
    console.error(error); // eslint-disable-line no-console
    process.exit(1);
});
