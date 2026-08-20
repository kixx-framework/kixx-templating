import { assertEqual } from '../vendor/kixx-assert/mod.js';
import tokenize from '../lib/tokenize.js';
import buildSyntaxTree from '../lib/build-syntax-tree.js';
import createRenderFunction from '../lib/create-render-function.js';
import builtinHelpers from '../lib/helpers/mod.js';

/* eslint-disable no-invalid-this */


const NO_PARTIALS = new Map();


function compile(name, source, helpers = new Map()) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    return createRenderFunction(null, helpers, tree);
}


// Focused tests for behavior NOT covered by the Mustache spec suite: the helper
// extension mechanism (constraint #3) and a couple of core regressions.
export default [
    function dataSectionIteratesArrays() {
        const render = compile('t', '{{#items}}<li>{{name}}</li>{{/items}}');
        assertEqual('<li>a</li><li>b</li>', render({ items: [ { name: 'a' }, { name: 'b' } ] }, NO_PARTIALS));
    },

    function dataSectionIteratesMaps() {
        const render = compile('t', '{{#items}}{{root}}:{{name}};{{/items}}');
        const items = new Map([
            [ 'a', { name: 'A' } ],
            [ 'b', { name: 'B' } ],
        ]);

        assertEqual('R:A;R:B;', render({ root: 'R', items }, NO_PARTIALS));
    },

    function dataSectionIteratesSets() {
        const render = compile('t', '{{#items}}({{.}}){{/items}}');
        assertEqual('(a)(b)', render({ items: new Set([ 'a', 'b' ]) }, NO_PARTIALS));
    },

    function dataSectionIteratesObjects() {
        const render = compile('t', '{{#items}}{{root}}:{{name}};{{/items}}');
        const items = {
            a: { name: 'A' },
            b: { name: 'B' },
        };

        assertEqual('R:A;R:B;', render({ root: 'R', items }, NO_PARTIALS));
    },

    function invertedSectionRendersWhenEmpty() {
        const render = compile('t', '{{^items}}none{{/items}}');
        assertEqual('none', render({ items: [] }, NO_PARTIALS));
    },

    function invertedSectionRendersWhenObjectEmpty() {
        const render = compile('t', '{{^items}}none{{/items}}');
        assertEqual('none', render({ items: {} }, NO_PARTIALS));
    },

    function implicitIterator() {
        const render = compile('t', '{{#list}}({{.}}){{/list}}');
        assertEqual('(1)(2)(3)', render({ list: [ 1, 2, 3 ] }, NO_PARTIALS));
    },

    function upwardLookupThroughFrames() {
        const render = compile('t', '{{#a}}{{#b}}{{root}}{{inner}}{{/b}}{{/a}}');
        assertEqual('R!', render({ root: 'R', a: [ { b: [ { inner: '!' } ] } ] }, NO_PARTIALS));
    },

    function eachHelperWithBlockParams() {
        const helpers = new Map([ [ 'each', builtinHelpers.get('each') ] ]);
        const render = compile('t', '{{#each items as |item idx|}}{{idx}}:{{item}};{{/each}}', helpers);
        assertEqual('0:a;1:b;', render({ items: [ 'a', 'b' ] }, NO_PARTIALS));
    },

    function eachHelperCanReadParentFrames() {
        const helpers = new Map([ [ 'each', builtinHelpers.get('each') ] ]);
        const render = compile('t', '{{#each items as |item|}}{{root}}:{{item}};{{/each}}', helpers);
        assertEqual('R:a;R:b;', render({ root: 'R', items: [ 'a', 'b' ] }, NO_PARTIALS));
    },

    function eachHelperRendersInverseForEmptyCollections() {
        const helpers = new Map([ [ 'each', builtinHelpers.get('each') ] ]);
        const render = compile('t', '{{#each items as |item|}}{{item}}{{else}}none{{/each}}', helpers);
        assertEqual('none', render({ items: [] }, NO_PARTIALS));
        assertEqual('none', render({ items: new Map() }, NO_PARTIALS));
        assertEqual('none', render({ items: new Set() }, NO_PARTIALS));
        assertEqual('none', render({ items: {} }, NO_PARTIALS));
    },

    function ifHelperWithElse() {
        const helpers = new Map([ [ 'if', builtinHelpers.get('if') ] ]);
        const render = compile('t', '{{#if x}}yes{{else}}no{{/if}}', helpers);
        assertEqual('yes', render({ x: true }, NO_PARTIALS));
        assertEqual('no', render({ x: false }, NO_PARTIALS));
    },

    function helperCanRenderTheCurrentFrame() {
        const helpers = new Map([
            [ 'same', function same_helper() {
                return this.renderPrimary();
            } ],
        ]);
        const render = compile('t', '{{#value}}{{#same}}{{.}}{{/same}}{{/value}}', helpers);
        assertEqual('x', render({ value: 'x' }, NO_PARTIALS));
    },

    function withHelperUsesFrameStackForParentScope() {
        const helpers = new Map([ [ 'with', builtinHelpers.get('with') ] ]);
        const render = compile('t', '{{#with child}}{{root}}/{{name}}{{/with}}', helpers);
        assertEqual('R/C', render({ root: 'R', child: { name: 'C' } }, NO_PARTIALS));
    },

    function nestedHelpersRestoreTheCurrentFrame() {
        const helpers = new Map([
            [ 'wrap', function wrap_helper(_ctx, _opts, name) {
                return this.renderPrimary({ name }) + this.renderPrimary({ name: `${ name }2` });
            } ],
        ]);
        const render = compile(
            't',
            '{{#wrap "A"}}{{name}}[{{#wrap "B"}}{{name}}{{/wrap}}]{{name}};{{/wrap}}',
            helpers,
        );

        assertEqual('A[BB2]A;A2[BB2]A2;', render({}, NO_PARTIALS));
    },

    function inlineHelperReceivesArgsAndHash() {
        const helpers = new Map([
            [ 'shout', (_ctx, opts, val) => String(val).toUpperCase() + (opts.bang ? '!' : '') ],
        ]);
        const render = compile('t', '{{shout name bang=true}}', helpers);
        assertEqual('HELLO!', render({ name: 'hello' }, NO_PARTIALS));
    },

    function helperOutputIsNotEscaped() {
        const helpers = new Map([ [ 'raw', () => '<b>x</b>' ] ]);
        const render = compile('t', '{{raw}}', helpers);
        assertEqual('<b>x</b>', render({}, NO_PARTIALS));
    },

    function partialsInheritTheContextStack() {
        const partials = new Map();
        partials.set('row', compile('row', '<td>{{game}}</td><td>{{player}}</td>'));
        const render = compile('t', '{{#players}}{{> row}}{{/players}}');
        assertEqual(
            '<td>G</td><td>p1</td><td>G</td><td>p2</td>',
            render({ game: 'G', players: [ { player: 'p1' }, { player: 'p2' } ] }, partials),
        );
    },

    function partialsResolveLazilyAtRenderTime() {
        const partials = new Map();
        const render = compile('t', 'a{{> late}}b');

        partials.set('late', compile('late', '{{x}}'));

        assertEqual('aXb', render({ x: 'X' }, partials));
    },

    function latePartialsInheritTheContextStack() {
        const partials = new Map();
        const render = compile('t', '{{#players}}{{> row}}{{/players}}');

        partials.set('row', compile('row', '{{game}}/{{name}};'));

        assertEqual('G/a;G/b;', render({ game: 'G', players: [ { name: 'a' }, { name: 'b' } ] }, partials));
    },

    function duckTypedPartialsLookupWorks() {
        const partial = compile('partial', '{{value}}');
        const partials = {
            has(name) {
                return name === 'item';
            },
            get(name) {
                return name === 'item' ? partial : undefined;
            },
        };
        const render = compile('t', '[{{> item}}]');

        assertEqual('[duck]', render({ value: 'duck' }, partials));
    },

    function renderSelectsInvocationPartialsWithoutFallback() {
        const render = compile('t', '{{> item}}');
        const firstPartials = new Map([ [ 'item', () => 'first' ] ]);
        const secondPartials = new Map([ [ 'item', () => 'second' ] ]);

        assertEqual('first', render({}, firstPartials));
        assertEqual('second', render({}, secondPartials));
        assertEqual('', render({}, NO_PARTIALS));
    },

    function nestedPartialsUseRootInvocationLookup() {
        const partials = new Map();
        partials.set('first', compile('first', '1{{> second}}'));
        partials.set('second', compile('second', '2{{> third}}'));
        partials.set('third', compile('third', '3'));
        const render = compile('t', '0{{> first}}');

        assertEqual('0123', render({}, partials));
    },

    function helperBlocksUseInvocationPartials() {
        const helpers = new Map([ [ 'both', function both_helper() {
            return this.renderPrimary() + this.renderInverse();
        } ] ]);
        const partials = new Map([
            [ 'primary', () => 'P' ],
            [ 'inverse', () => 'I' ],
        ]);
        const render = compile(
            't',
            '{{#both}}{{> primary}}{{else}}{{> inverse}}{{/both}}',
            helpers,
        );

        assertEqual('PI', render({}, partials));
    },

    function recursivePartialUsesInvocationLookup() {
        const partials = new Map();
        const node = compile('node', '{{value}}{{#next}}{{> node}}{{/next}}');
        partials.set('node', node);
        const render = compile('t', '{{> node}}');
        const data = { value: 'A', next: [ { value: 'B', next: [ { value: 'C', next: false } ] } ] };

        assertEqual('ABC', render(data, partials));
    },

    function reentrantHelperRestoresInvocationPartials() {
        let nested = false;
        const state = { render: null };
        const firstPartials = new Map([ [ 'item', () => 'A' ] ]);
        const secondPartials = new Map([ [ 'item', () => 'B' ] ]);
        const helpers = new Map([ [ 'reenter', function reenter_helper() {
            if (nested) {
                return this.renderPrimary();
            }

            const before = this.renderPrimary();
            nested = true;
            const middle = state.render({}, secondPartials);
            nested = false;
            return before + middle + this.renderPrimary();
        } ] ]);
        state.render = compile('t', '{{#reenter}}{{> item}}{{/reenter}}', helpers);

        assertEqual('ABA', state.render({}, firstPartials));
    },

    function barePartialReceivesOneArgumentAndCallerAppliesIndentation() {
        let receivedData;
        let receivedArgumentCount;
        const partials = new Map([ [ 'bare', function bare_partial(data) {
            receivedData = data;
            receivedArgumentCount = arguments.length;
            return `${ data.value }\nnext\n`;
        } ] ]);
        const render = compile('t', '>\n  {{> bare}}\n<');
        const data = { value: 'first' };

        assertEqual('>\n  first\n  next\n<', render(data, partials));
        assertEqual(data, receivedData);
        assertEqual(1, receivedArgumentCount);
    },

    function noSpuriousTrailingNewline() {
        assertEqual('a\nb', compile('t', 'a\nb')({}, NO_PARTIALS));
        assertEqual('x\n', compile('t', 'x\n')({}, NO_PARTIALS));
    },

    function escapedInterpolationUsesSpecSet() {
        const render = compile('t', '{{x}}');
        // Spec set escapes & < > " but NOT ' ` =
        assertEqual('&amp;&lt;&gt;&quot;', render({ x: '&<>"' }, NO_PARTIALS));
        assertEqual("'`=", render({ x: "'`=" }, NO_PARTIALS));
    },

    function tripleMustacheIsUnescaped() {
        const render = compile('t', '{{{x}}}');
        assertEqual('<b>&</b>', render({ x: '<b>&</b>' }, NO_PARTIALS));
    },

    function ampersandIsUnescaped() {
        const render = compile('t', '{{&x}}');
        assertEqual('<b>&</b>', render({ x: '<b>&</b>' }, NO_PARTIALS));
    },

    function singleBangCommentProducesNoOutput() {
        const render = compile('t', 'a{{! ignore me }}b');
        assertEqual('ab', render({}, NO_PARTIALS));
    },

    function missingPartialRendersEmpty() {
        const render = compile('t', 'a{{> nope}}b');
        assertEqual('ab', render({}, NO_PARTIALS));
    },

    function setDelimitersChangeFollowingTags() {
        const render = compile('t', '({{=<% %>=}}<%text%>)');
        assertEqual('(Hey!)', render({ text: 'Hey!' }, NO_PARTIALS));
    },

    function setDelimitersStayLocalToPartials() {
        const partials = new Map();

        partials.set('include', compile('include', '.{{value}}. {{= | | =}} .|value|.'));

        const render = compile(
            't',
            '[ {{>include}} ]\n{{= | | =}}[ |>include| ]\n[ .{{value}}.  .|value|. ]\n',
            new Map(),
        );

        assertEqual('[ .yes.  .yes. ]\n[ .yes.  .yes. ]\n[ .{{value}}.  .yes. ]\n', render({ value: 'yes' }, partials));
    },

    function standaloneSectionLinesAreRemoved() {
        const render = compile('t', 'A\n{{#x}}\nB\n{{/x}}\nC\n');
        assertEqual('A\nB\nC\n', render({ x: true }, NO_PARTIALS));
    },

    function standalonePartialIndentationAppliesToSourceLines() {
        const partials = new Map();

        partials.set('row', compile('row', '|\n{{{value}}}\n|\n'));

        const render = compile('t', '>\n  {{> row}}\n<\n');
        assertEqual('>\n  |\n  a\nb\n  |\n<\n', render({ value: 'a\nb' }, partials));
    },

    function pluggableEscapeHook() {
        const escape = (value) => String(value).replace(/'/g, '&#x27;');
        const tokens = tokenize(null, 't', '{{x}}');
        const tree = buildSyntaxTree(null, tokens);
        const render = createRenderFunction({ escape }, new Map(), tree);
        assertEqual('&#x27;', render({ x: "'" }, NO_PARTIALS));
    },
];
