import { assertEqual } from '../vendor/kixx-assert/mod.js';
import tokenize from '../lib/tokenize.js';
import buildSyntaxTree from '../lib/build-syntax-tree.js';
import createRenderFunction from '../lib/create-render-function.js';
import builtinHelpers from '../lib/helpers/mod.js';


function compile(name, source, helpers = new Map(), partials = new Map()) {
    const tokens = tokenize(null, name, source);
    const tree = buildSyntaxTree(null, tokens);
    return createRenderFunction(null, helpers, partials, tree);
}


// Focused tests for behavior NOT covered by the Mustache spec suite: the helper
// extension mechanism (constraint #3) and a couple of core regressions.
export default [
    function dataSectionIteratesArrays() {
        const render = compile('t', '{{#items}}<li>{{name}}</li>{{/items}}');
        assertEqual('<li>a</li><li>b</li>', render({ items: [ { name: 'a' }, { name: 'b' } ] }));
    },

    function invertedSectionRendersWhenEmpty() {
        const render = compile('t', '{{^items}}none{{/items}}');
        assertEqual('none', render({ items: [] }));
    },

    function implicitIterator() {
        const render = compile('t', '{{#list}}({{.}}){{/list}}');
        assertEqual('(1)(2)(3)', render({ list: [ 1, 2, 3 ] }));
    },

    function upwardLookupThroughFrames() {
        const render = compile('t', '{{#a}}{{#b}}{{root}}{{inner}}{{/b}}{{/a}}');
        assertEqual('R!', render({ root: 'R', a: { b: { inner: '!' } } }));
    },

    function eachHelperWithBlockParams() {
        const helpers = new Map([ [ 'each', builtinHelpers.get('each') ] ]);
        const render = compile('t', '{{#each items as |item idx|}}{{idx}}:{{item}};{{/each}}', helpers);
        assertEqual('0:a;1:b;', render({ items: [ 'a', 'b' ] }));
    },

    function ifHelperWithElse() {
        const helpers = new Map([ [ 'if', builtinHelpers.get('if') ] ]);
        const render = compile('t', '{{#if x}}yes{{else}}no{{/if}}', helpers);
        assertEqual('yes', render({ x: true }));
        assertEqual('no', render({ x: false }));
    },

    function inlineHelperReceivesArgsAndHash() {
        const helpers = new Map([
            [ 'shout', (_ctx, opts, val) => String(val).toUpperCase() + (opts.bang ? '!' : '') ],
        ]);
        const render = compile('t', '{{shout name bang=true}}', helpers);
        assertEqual('HELLO!', render({ name: 'hello' }));
    },

    function helperOutputIsNotEscaped() {
        const helpers = new Map([ [ 'raw', () => '<b>x</b>' ] ]);
        const render = compile('t', '{{raw}}', helpers);
        assertEqual('<b>x</b>', render({}));
    },

    function partialsInheritTheContextStack() {
        const partials = new Map();
        partials.set('row', compile('row', '<td>{{game}}</td><td>{{player}}</td>', new Map(), partials));
        const render = compile('t', '{{#players}}{{> row}}{{/players}}', new Map(), partials);
        assertEqual(
            '<td>G</td><td>p1</td><td>G</td><td>p2</td>',
            render({ game: 'G', players: [ { player: 'p1' }, { player: 'p2' } ] }),
        );
    },

    function partialsResolveLazilyAtRenderTime() {
        const partials = new Map();
        const render = compile('t', 'a{{> late}}b', new Map(), partials);

        partials.set('late', compile('late', '{{x}}', new Map(), partials));

        assertEqual('aXb', render({ x: 'X' }));
    },

    function latePartialsInheritTheContextStack() {
        const partials = new Map();
        const render = compile('t', '{{#players}}{{> row}}{{/players}}', new Map(), partials);

        partials.set('row', compile('row', '{{game}}/{{name}};', new Map(), partials));

        assertEqual('G/a;G/b;', render({ game: 'G', players: [ { name: 'a' }, { name: 'b' } ] }));
    },

    function noSpuriousTrailingNewline() {
        assertEqual('a\nb', compile('t', 'a\nb')({}));
        assertEqual('x\n', compile('t', 'x\n')({}));
    },

    function escapedInterpolationUsesSpecSet() {
        const render = compile('t', '{{x}}');
        // Spec set escapes & < > " but NOT ' ` =
        assertEqual('&amp;&lt;&gt;&quot;', render({ x: '&<>"' }));
        assertEqual("'`=", render({ x: "'`=" }));
    },

    function tripleMustacheIsUnescaped() {
        const render = compile('t', '{{{x}}}');
        assertEqual('<b>&</b>', render({ x: '<b>&</b>' }));
    },

    function ampersandIsUnescaped() {
        const render = compile('t', '{{&x}}');
        assertEqual('<b>&</b>', render({ x: '<b>&</b>' }));
    },

    function singleBangCommentProducesNoOutput() {
        const render = compile('t', 'a{{! ignore me }}b');
        assertEqual('ab', render({}));
    },

    function missingPartialRendersEmpty() {
        const render = compile('t', 'a{{> nope}}b');
        assertEqual('ab', render({}));
    },

    function pluggableEscapeHook() {
        const escape = (value) => String(value).replace(/'/g, '&#x27;');
        const tokens = tokenize(null, 't', '{{x}}');
        const tree = buildSyntaxTree(null, tokens);
        const render = createRenderFunction({ escape }, new Map(), new Map(), tree);
        assertEqual('&#x27;', render({ x: "'" }));
    },
];
