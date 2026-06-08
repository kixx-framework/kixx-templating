import LineSyntaxError from './line-syntax-error.js';
import { escapeHTMLChars } from './utils.js';


// Phase 1 engine: a closure-composition renderer over a zero-copy context stack.
//
// Compilation walks the AST once and emits a tree of pre-bound closures. Rendering
// then calls those closures over a stack of "frames" ({ value, parent }) instead of
// copying the context object at every scope change. The same frame stack provides
// Mustache's upward name resolution.
export default function createRenderFunction(options, helpers, partials, tree) {

    // The escape policy is pluggable: callers can pass a stricter escape function
    // via options.escape. The default escapes the Mustache spec set (& < > ").
    const escapeFunction = options && typeof options.escape === 'function'
        ? options.escape
        : escapeHTMLChars;

    const renderRoot = compileNodes(tree);

    function render(data) {
        return renderRoot({ value: data, parent: null });
    }

    // Partials inherit the caller's full frame stack. Exposing the frame-accepting
    // renderer lets a {{> partial}} render against the current stack rather than a
    // fresh root.
    render.renderWithFrame = renderRoot;

    return render;

    // --- Compilation -------------------------------------------------------

    function compileNodes(nodes) {
        const steps = [];
        let pendingContent = '';

        function flushContent() {
            if (pendingContent) {
                const str = pendingContent;
                steps.push(function renderContent() {
                    return str;
                });
                pendingContent = '';
            }
        }

        for (const node of nodes) {
            // Coalesce adjacent literal content into a single step.
            if (node.type === 'CONTENT') {
                pendingContent += node.str;
                continue;
            }
            // Comments, block-close markers, and stray else markers emit nothing.
            if (node.type === 'COMMENT' || node.type === 'SET_DELIMITERS' || node.type === 'BLOCK_CLOSE' || node.type === 'ELSE') {
                continue;
            }

            flushContent();
            const step = compileNode(node);
            if (step) {
                steps.push(step);
            }
        }

        flushContent();

        if (steps.length === 0) {
            return noopRender;
        }
        if (steps.length === 1) {
            return steps[0];
        }

        return function renderSteps(frame) {
            let out = '';
            for (let i = 0; i < steps.length; i += 1) {
                out += steps[i](frame);
            }
            return out;
        };
    }

    function compileNode(node) {
        switch (node.type) {
            case 'PATH_EXPRESSION':
            case 'HELPER_EXPRESSION':
                return compileMustache(node);
            case 'BLOCK_OPEN':
                return compileBlock(node);
            case 'PARTIAL':
                return compilePartial(node);
            default:
                return null;
        }
    }

    // A non-block mustache: a helper call (if the name is a registered helper or the
    // expression carries arguments) or a plain data interpolation.
    function compileMustache(node) {
        const exp = node.exp;
        const head = exp[0];

        if (exp.length > 1 || isHelperName(head)) {
            return compileHelper(node, false);
        }

        return compileInterpolation(head, node.escape !== false);
    }

    function compileInterpolation(sub, escape) {
        const path = pathForHead(sub);

        // A genuine literal in name position (a quoted string or a number) renders
        // its value directly.
        if (!path) {
            const value = escape ? escapeFunction(sub.value) : coerce(sub.value);
            return function renderLiteral() {
                return value;
            };
        }

        if (escape) {
            return function renderEscaped(frame) {
                return escapeFunction(lookup(frame, path));
            };
        }

        return function renderUnescaped(frame) {
            return coerce(lookup(frame, path));
        };
    }

    function compileBlock(node) {
        const head = node.exp[0];
        const inverted = node.inverted === true;

        // Inverted sections ({{^x}}) are always data-driven. A regular {{#x}} is a
        // helper call when x is a registered helper or arguments are present.
        if (!inverted && (node.exp.length > 1 || isHelperName(head))) {
            return compileHelper(node, true);
        }

        const path = pathForHead(head) || [];
        const program = compileNodes(node.children || []);

        if (inverted) {
            return function renderInvertedSection(frame) {
                return isSectionFalsey(lookup(frame, path)) ? program(frame) : '';
            };
        }

        return function renderSection(frame) {
            const value = lookup(frame, path);

            if (isSectionFalsey(value)) {
                return '';
            }

            if (Array.isArray(value)) {
                let out = '';
                for (let i = 0; i < value.length; i += 1) {
                    out += program({ value: value[i], parent: frame });
                }
                return out;
            }

            return program({ value, parent: frame });
        };
    }

    function compileHelper(node, isBlock) {
        const head = node.exp[0];
        const helperName = head.path[0];
        const helperFunction = helpers.get(helperName);
        const openToken = node.tokens[0];

        if (!helperFunction) {
            throw new LineSyntaxError(
                `No helper named "${ helperName }" in "${ openToken.filename }" on line ${ openToken.lineNumber }`,
                openToken,
            );
        }

        const positionalArguments = [];
        const namedArguments = {};
        let blockParams = [];

        for (const t of node.exp.slice(1)) {
            switch (t.type) {
                case 'PATH':
                case 'LITERAL':
                    positionalArguments.push(t);
                    break;
                case 'KEY_VALUE':
                    namedArguments[t.key] = t.value;
                    break;
                case 'BLOCK_PARAMS':
                    blockParams = t.params;
                    break;
            }
        }

        let renderPrimary = noopRender;
        let renderInverse = noopRender;

        if (isBlock && node.children && node.children.length > 0) {
            const primaryNodes = [];
            const inverseNodes = [];
            let inElse = false;

            for (const child of node.children) {
                if (child.type === 'BLOCK_CLOSE') {
                    continue;
                }
                if (child.type === 'ELSE') {
                    inElse = true;
                    continue;
                }
                (inElse ? inverseNodes : primaryNodes).push(child);
            }

            if (primaryNodes.length > 0) {
                renderPrimary = compileNodes(primaryNodes);
            }
            if (inverseNodes.length > 0) {
                renderInverse = compileNodes(inverseNodes);
            }
        }

        return function renderHelper(frame) {
            const positionalArgs = positionalArguments.map((arg) => resolveArgument(arg, frame));

            const namedArgs = {};
            for (const key of Object.keys(namedArguments)) {
                namedArgs[key] = resolveArgument(namedArguments[key], frame);
            }

            const thisHelperContext = {
                blockParams,

                renderPrimary(newData) {
                    return renderPrimary({ value: newData, parent: frame });
                },

                renderInverse(newData) {
                    return renderInverse({ value: newData, parent: frame });
                },
            };

            try {
                return helperFunction.call(thisHelperContext, frame.value, namedArgs, ...positionalArgs);
            } catch (cause) {
                const errorData = Object.assign({ cause }, openToken);
                throw new LineSyntaxError(
                    `Error in helper "${ helperName }" in "${ openToken.filename }" on line ${ openToken.lineNumber }`,
                    errorData,
                );
            }
        };
    }

    function compilePartial(node) {
        const partialName = node.exp;

        return function renderPartial(frame) {
            // Per the Mustache spec, a missing partial renders as an empty string.
            if (!partials.has(partialName)) {
                return '';
            }

            const partial = partials.get(partialName);
            if (typeof partial.renderWithFrame === 'function') {
                return partial.renderWithFrame(frame);
            }
            return partial(frame.value);
        };
    }

    // --- Runtime helpers ---------------------------------------------------

    function isHelperName(sub) {
        return sub.type === 'PATH' && sub.path.length === 1 && helpers.has(sub.path[0]);
    }

    function resolveArgument(arg, frame) {
        if (arg.type === 'LITERAL') {
            return arg.value;
        }
        return lookup(frame, arg.path);
    }

    // Mustache name resolution: search the frame stack for the first frame whose
    // value carries the first path segment, then resolve the remaining segments
    // directly on that value (broken chains do not re-search the stack). An empty
    // path is the implicit iterator: the current frame's value.
    function lookup(frame, segments) {
        if (segments.length === 0) {
            return frame ? frame.value : undefined;
        }

        const first = segments[0];
        let container;

        for (let f = frame; f; f = f.parent) {
            const value = f.value;
            // typeof null === 'object', so guard against null explicitly. undefined
            // and primitives fail the typeof check and fall through to the parent.
            if (value !== null && typeof value === 'object' && hasKey(value, first)) {
                container = value;
                break;
            }
        }

        if (container === undefined) {
            return undefined;
        }

        let current = container[first];
        for (let i = 1; i < segments.length; i += 1) {
            if (current === null || typeof current === 'undefined') {
                return undefined;
            }
            current = current[segments[i]];
        }
        return current;
    }
}


// The resolvable path for an expression's head/name. PATH sub-tokens carry their
// segments directly; a keyword literal (true/false/null/undefined) in name position
// is treated as a single-segment property path. A genuine literal returns null.
function pathForHead(sub) {
    if (sub.type === 'PATH') {
        return sub.path;
    }
    if (sub.type === 'LITERAL' && typeof sub.keyword === 'string') {
        return [ sub.keyword ];
    }
    return null;
}

function hasKey(value, key) {
    if (Array.isArray(value) && typeof key === 'number') {
        return key >= 0 && key < value.length;
    }
    return Object.prototype.hasOwnProperty.call(value, key);
}

function isSectionFalsey(value) {
    if (value === false || value === null || typeof value === 'undefined') {
        return true;
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    return false;
}

function coerce(value) {
    if (value === null || typeof value === 'undefined') {
        return '';
    }
    return typeof value === 'string' ? value : String(value);
}

function noopRender() {
    return '';
}
