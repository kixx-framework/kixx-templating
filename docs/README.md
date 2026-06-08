# Kixx Templating

A simple and robust markup and text templating system for JavaScript environments.

## Mustache Compatibility

Kixx supports core Mustache-style templates plus Kixx helper extensions. The optional
Mustache spec extensions `~lambdas`, `~dynamic-names`, and `~inheritance` are
intentionally unsupported.

One intentional divergence from core Mustache: pure data sections iterate arrays, Maps,
Sets, and plain object values. Core Mustache treats plain object sections as a single
pushed context.

Data functions are treated like ordinary values; the renderer does not call them or
re-parse returned strings as templates. Use inline helpers for computed interpolation and
block helpers for custom section behavior.

Kixx data sections treat `false`, `null`, `undefined`, empty arrays, empty Maps, empty
Sets, and empty plain objects as falsey. Numeric `0` and empty strings render as scalar
section values.

## Basic Expressions

Kixx Templating uses Mustache-style syntax with double curly braces `{{ ... }}` for
template expressions.

### Simple Variable Output

```javascript
const context = {
    album: 'Follow the Leader',
    artist: 'Eric B. & Rakim',
};
```

```html
<h1>{{ album }}</h1>
<p>by {{ artist }}</p>
```

Output:

```html
<h1>Follow the Leader</h1>
<p>by Eric B. &amp; Rakim</p>
```

Notice that the `&` was converted to `&amp;`. HTML escaping is automatic. See
[HTML Escaping](#html-escaping) for more details.

### Raw Output

Use triple mustache or ampersand tags for trusted content that should not be escaped:

```html
<article>{{{ htmlBody }}}</article>
<article>{{& htmlBody }}</article>
```

Raw output bypasses HTML escaping. Only use it for content you trust.

### Nested Property Access

Use dot notation for nested objects:

```html
<p>{{ song.writer.firstName }} {{ song.writer.lastName }}</p>
<p>Released: {{ song.released }}</p>
```

### Array Access

Use bracket notation for array indexes:

```html
<img src="{{ images[0].src }}" alt="{{ images[0].alt }}" />
<p>{{ articles[0].comments[2].author.name }}</p>
```

### Bracket Notation for Special Characters

Properties with special characters like dashes need bracket notation:

```javascript
const context = {
    headers: {
        'Content-Type': 'text/html',
        'Content-Length': 199,
    },
};
```

```html
<dd>{{ headers[Content-Type] }}</dd>
```

Bracket contents are literal path segments, not JavaScript expressions. Use
`[Content-Type]`, not `["Content-Type"]`. Use numeric bracket segments for array
indexes, such as `images[0]`.

### Comments

```html
{{! This is a Mustache comment }}

{{!-- This is a single line comment --}}

{{!--
    This is a multi-line
    comment.
--}}

{{!-- Comments can contain {{ mustaches }} --}}
{{!-- and they won't be processed. --}}
```

## Sections

Mustache sections render based on data, without registering helpers.

### Array Sections

An array section renders once for each item. The item is pushed onto the context stack,
so `{{.}}` resolves to the current item and object properties resolve from the item first.
Parent context remains visible.

```javascript
const context = {
    listName: 'Tracks',
    tracks: [
        { title: 'Follow the Leader' },
        { title: 'Microphone Fiend' },
    ],
};
```

```html
<h2>{{ listName }}</h2>
<ul>
{{#tracks}}
    <li>{{ title }}</li>
{{/tracks}}
</ul>
```

### Map, Set, and Object Sections

Map and Set sections render once for each value. Plain object sections render once for
each own enumerable property value, in `Object.keys()` order. Empty Maps, Sets, and plain
objects render the inverted section.

```html
{{#usersById}}
    <p>{{ name }}</p>
{{/usersById}}
```

### Scalar Sections

A scalar section renders once unless the value is `false`, `null`, or `undefined`.
Numeric `0` and empty strings render once. Use `{{.}}` to output the scalar itself.

```html
{{#status}}Status: {{.}}{{/status}}
```

```html
{{#count}}Count: {{.}}{{/count}}
```

### Inverted Sections

An inverted section renders when a value is `false`, `null`, `undefined`, an empty
array, an empty Map, an empty Set, or an empty plain object.

```html
{{#articles}}
    <article>{{ title }}</article>
{{/articles}}
{{^articles}}
    <p>No articles available.</p>
{{/articles}}
```

Kixx data sections do not expose indexes, keys, or `{{else}}`. Map keys and object
property names are not available inside data sections. Use `{{^name}}` for inverse data
sections, and use the `#each` helper when you need indexes, keys, or block params.

## Delimiters

Templates can change delimiters with Mustache set-delimiter tags:

```html
{{=<% %>=}}
<h1><% title %></h1>
```

Delimiter changes apply to the current template source from that point forward. Partials
are parsed separately, so delimiter changes in a parent template do not affect how a
partial source is parsed.

## Built-in Helpers

Helpers are Kixx extensions. Data sections should be preferred for ordinary Mustache
iteration and conditionals; helpers are for block params, indexes, object/Map/Set
iteration, equality checks, formatting, and other custom behavior.

| Helper | Type | Description |
|--------|------|-------------|
| `#each` | Block | Iterate over arrays, objects, Maps, and Sets |
| `#if` | Block | Conditional rendering based on truthiness |
| `#unless` | Block | Render when a value is falsey |
| `#ifEqual` | Block | Equality comparison using `==` |
| `#with` | Block | Change the context scope |
| `unescape` | Inline | Prevent automatic HTML escaping |
| `plusOne` | Inline | Add 1 to a number (useful for array indexes) |

`{{else}}` splits helper blocks into primary and inverse branches. Whitespace around
`{{else}}` is preserved, so place it intentionally when exact text output matters.

### each Helper

Iterate over arrays, Maps, Sets, or plain objects:

```html
<ul>
    {{#each images as |image| }}
    <li>
        <img src="{{ image.src }}" alt="{{ image.alt }}" />
    </li>
    {{/each}}
</ul>
```

Remember to include the closing `{{/each}}` tag. The first block parameter is required.
Block parameter names are separated by whitespace; do not use commas.

The second block parameter references different things based on the iterable type:

| Iterable | Second parameter |
|----------|------------------|
| Array | index |
| Map | key |
| Set | (none) |
| Object | property name |

```html
{{#each weatherStations as |stationCode index| }}
<li>
    <span>{{plusOne index }}.</span>
    <a href="/stations/{{ stationCode }}">{{ stationCode }}</a>
</li>
{{/each}}
```

For Maps and plain objects, the second block parameter is the key or property name:

```html
{{#each usersById as |user id| }}
    <a href="/users/{{ id }}">{{ user.name }}</a>
{{/each}}
```

Use `else` to handle empty arrays, missing values, `null`, and non-object values:

```html
{{#each images as |image| }}
    <div><img src="{{ image.src }}" /></div>
{{else}}
    <p>No images to display</p>
{{/each}}
```

Current implementation note: empty Maps, Sets, and plain objects render no output from
`#each` instead of rendering the `else` branch.

### if Helper

Conditional rendering based on truthiness:

```html
{{#if user.isLoggedIn}}
    <p>Welcome back, {{ user.name }}!</p>
{{else}}
    <p>Please <a href="/login">log in</a>.</p>
{{/if}}
```

**Truthy values:** non-empty strings, non-zero numbers, `true`, plain objects,
including empty plain objects, and non-empty arrays/Maps/Sets

**Falsey values:** `false`, `0`, `""`, `null`, `undefined`, empty arrays `[]`, and empty
Maps/Sets

### unless Helper

Renders when the value is falsey:

```html
{{#unless articles}}
    <p>No articles available.</p>
{{else}}
    <p>Found {{ articles.length }} articles.</p>
{{/unless}}
```

`#unless` renders its primary block for `false`, `0`, `""`, `null`, `undefined`, empty
arrays, empty Maps, empty Sets, and empty plain objects.

### ifEqual Helper

Compares two values using `==` equality:

```html
{{#ifEqual user.role "admin"}}
    <span class="admin-badge">Administrator</span>
{{else}}
    <span class="user-badge">User</span>
{{/ifEqual}}
```

Chain for switch-like behavior:

```html
{{#ifEqual user.role "admin"}}
    <a href="/dashboard/admin">Administrator</a>
{{else}}{{#ifEqual user.role "moderator"}}
    <a href="/dashboard/mod">Moderator</a>
{{else}}
    <a href="/dashboard">Dashboard</a>
{{/ifEqual}}{{/ifEqual}}
```

### with Helper

Changes the context scope for a block. Useful for reducing repetition when accessing
nested properties:

```javascript
const context = {
    site: { name: 'My Blog' },
    user: {
        profile: {
            name: 'Jane Doe',
            bio: 'Software developer',
            email: 'jane@example.com',
        },
    },
};
```

```html
{{#with user.profile}}
    <h2>{{ name }}</h2>
    <p>{{ bio }}</p>
    <p>Email: {{ email }}</p>
    <p>On {{ site.name }}</p>
{{else}}
    <p>No profile information available.</p>
{{/with}}
```

The value is pushed onto the context stack, so its properties are resolved first and
parent context properties like `site.name` remain accessible.

The else block renders when the value is:

- Falsey (`null`, `undefined`, `false`, `0`, `""`)
- An empty array `[]`
- An empty Map or Set

An empty plain object is treated as a context value and renders the primary block.

### plusOne Helper

Adds 1 to a number. Useful for displaying 1-based indexes:

```html
{{#each images as |image index| }}
<div>
    <span>{{plusOne index }}.</span>
    <img src="{{ image.src }}" alt="{{ image.alt }}" />
</div>
{{/each}}
```

### Multi-line Helpers

All helpers can span multiple lines:

```html
<p>Game start: {{formatDate game.startTime
    zone="America/New_York"
    locale="en-US"
    format="DATETIME_MED"
}}</p>
```

Helper arguments can be paths, quoted string literals, integer literals, boolean
literals, `null`, or `undefined`. Named arguments are collected into the `options`
object passed to the helper.

## HTML Escaping

Escaped interpolation tags, like `{{ value }}`, escape the core Mustache HTML set:
`&`, `<`, `>`, and `"`.

```html
{{#comments}}
<div>{{.}}</div>
{{/comments}}
```

If a comment contains `<script src="http://evil.com/hack.js" />`, the output is:

```html
<div>&lt;script src=&quot;http://evil.com/hack.js&quot; /&gt;</div>
```

Characters outside the Mustache set, including `'`, `` ` ``, and `=`, are not escaped by
the default escape function. If your application needs a stricter policy, pass a custom
`escape` function to `createRenderFunction()`.

### Raw Trusted HTML

For trusted HTML content, such as markdown converted to HTML, use triple mustache,
ampersand tags, or the `unescape` helper:

```html
<div>{{{ markdownContent }}}</div>
<div>{{& markdownContent }}</div>
<div>{{unescape markdownContent }}</div>
```

Only use raw output with content you trust. Never use it with untrusted user input.

### Escaping in Custom Helpers

Helper output is not automatically escaped, even when the helper is called with double
braces. Return escaped strings yourself when helper output includes untrusted content:

```javascript
import { escapeHTMLChars } from 'kixx-templating';

function myHelper(context, options, userInput) {
    return escapeHTMLChars(userInput);
}
```

Helpers should return strings for predictable rendering. `null` and `undefined` helper
returns are not converted to empty strings automatically.

## Partials

Partials are reusable template fragments. Include them with `{{> partial-name }}`:

```html
<!DOCTYPE html>
<html>
<head>{{> head.html }}</head>
<body>
    {{> header.html }}
    <main>{{{ content }}}</main>
    {{> footer.html }}
</body>
</html>
```

Partials inherit the current context:

```html
{{#players}}
    {{> cards/game-player.html }}
{{/players}}
```

Inside `cards/game-player.html`, you can access both the current player fields and
parent context fields:

```html
<tr>
    <td>{{ game.formattedName }}</td>
    <td>{{ name }}</td>
    <td>{{ goals }}</td>
</tr>
```

If a partial name is not registered, it renders as an empty string.

Partial names are literal. Dynamic partial names such as `{{>*name}}` are part of an
optional Mustache extension and are not supported.

Standalone partials preserve indentation:

```html
<ul>
  {{> row }}
</ul>
```

Each rendered line from `row` receives the two-space indentation before the partial tag.

## Custom Helpers

### Helper Signature

```javascript
function helperName(context, options, ...positionals) {
    return output;
}
```

| Parameter | Description |
|-----------|-------------|
| `context` | The current frame value |
| `options` | Named arguments passed to the helper |
| `...positionals` | Positional arguments |

Positional path arguments are resolved before the helper is called. Named arguments such
as `format="long"` are available on `options`.

### Inline Helper Example

```javascript
function formatDate(context, options, dateString) {
    const { format = 'short' } = options;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { dateStyle: format });
}
```

Usage:

```html
<p>Published: {{ formatDate article.date format="long" }}</p>
```

### Block Helper Example

Block helpers use `this` context for rendering:

| Property/Method | Description |
|-----------------|-------------|
| `this.blockParams` | Array of block parameter names |
| `this.renderPrimary(newContext)` | Render the primary block |
| `this.renderInverse(newContext)` | Render the else block |

```javascript
function repeat(context, options, count) {
    let output = '';
    for (let i = 0; i < count; i += 1) {
        output += this.renderPrimary({ index: i });
    }
    return output;
}
```

Usage:

```html
{{#repeat 3}}
    <span>Item {{ index }}</span>
{{/repeat}}
```

The object passed to `renderPrimary()` is pushed onto the context stack. Parent context
values remain visible without copying them into the new object.

Block helpers can also use the names declared with `as |...|`:

```javascript
function entries(context, options, value) {
    const [ valueName, keyName ] = this.blockParams;
    let output = '';

    for (const key of Object.keys(value)) {
        output += this.renderPrimary({
            [keyName]: key,
            [valueName]: value[key],
        });
    }

    return output;
}
```

Usage:

```html
{{#entries settings as |value key| }}
    <dt>{{ key }}</dt>
    <dd>{{ value }}</dd>
{{/entries}}
```

## API Reference

### Exports

```javascript
import {
    tokenize,
    buildSyntaxTree,
    createRenderFunction,
    helpers,
    escapeHTMLChars,
} from 'kixx-templating';
```

### tokenize(options, filename, utf8)

Tokenizes template source into an array of tokens. Tokenization handles dynamic
delimiter changes and standalone whitespace metadata.

- `options` - Pass `null` (reserved for future use)
- `filename` - Template name for error reporting
- `utf8` - Template source string

### buildSyntaxTree(options, tokens)

Builds an AST from tokens.

- `options` - Pass `null`
- `tokens` - Array from `tokenize()`

### createRenderFunction(options, helpers, partials, tree)

Creates a render function from an AST.

- `options` - Pass `null`, or an object with `escape` to override escaped interpolation
  output
- `helpers` - Map of helper functions
- `partials` - Map of compiled partial render functions
- `tree` - AST from `buildSyntaxTree()`

Returns a render function: `(context) => string`. Partials are looked up at render time,
so a template can reference partials registered after the template was compiled.

### helpers

Map containing all built-in helper functions.

### escapeHTMLChars(str)

Escapes the Mustache HTML special characters: `& < > "`

## Putting it All Together

Using the primitives provided by Kixx Templating, you can create a small template engine
and then add application-specific behavior such as template caching.

```javascript
import {
    tokenize,
    buildSyntaxTree,
    createRenderFunction,
    helpers,
} from 'kixx-templating';

class TemplateEngine {
    #helpers = new Map(helpers);
    #partials = new Map();

    registerHelper(name, fn) {
        this.#helpers.set(name, fn);
    }

    registerPartial(name, source) {
        const tokens = tokenize(null, name, source);
        const tree = buildSyntaxTree(null, tokens);
        const partial = createRenderFunction(null, this.#helpers, this.#partials, tree);
        this.#partials.set(name, partial);
    }

    compileTemplate(name, source) {
        const tokens = tokenize(null, name, source);
        const tree = buildSyntaxTree(null, tokens);
        return createRenderFunction(null, this.#helpers, this.#partials, tree);
    }
}
```

```javascript
const engine = new TemplateEngine();

engine.registerPartial('track-row', '<li>{{ title }} - {{ duration }}</li>');

const render = engine.compileTemplate('track-list', `
<h1>{{ album }}</h1>
<ol>
{{#tracks}}
    {{> track-row }}
{{/tracks}}
</ol>
`);

render({
    album: 'Follow the Leader',
    tracks: [
        { title: 'Follow the Leader', duration: '5:36' },
        { title: 'Microphone Fiend', duration: '5:17' },
    ],
});
```
