
export function resolve(_context, _options, val, defaultVal) {
    if (val || val === false || val === 0) {
        // eslint-disable-next-line no-implicit-coercion
        return '' + val;
    }

    return defaultVal;
}

export function image(_context, _opts, ...positionals) {
    const srcset = positionals.filter((x) => Boolean(x)).join(', ');
    return `<img src="${ positionals[0] }" srcset="${ srcset }">`;
}

export function format_date(_context, opts, dateString) {
    const { format } = opts;
    // eslint-disable-next-line no-undef
    const isoString = new Date(dateString).toISOString();
    return `${ isoString.split('T')[0] } format=${ format }`;
}
