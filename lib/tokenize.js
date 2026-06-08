export default function tokenize(_options, filename, utf8) {
    const lineInfo = createLineInfo(utf8);
    const tokens = [];

    let openDelimiter = '{{';
    let closeDelimiter = '}}';
    let contentStart = 0;
    let index = 0;

    function pushToken(tokenString, startOffset, endOffset) {
        if (tokenString.length === 0) {
            return;
        }

        const loc = lineInfo.locate(startOffset);
        tokens.push({
            filename,
            lineNumber: loc.lineNumber,
            startPosition: loc.startPosition,
            endPosition: endOffset - loc.lineStart,
            tokenString,
            line: loc.line,
        });
    }

    function pushContent(endOffset) {
        if (contentStart < endOffset) {
            pushToken(utf8.slice(contentStart, endOffset), contentStart, endOffset);
        }
    }

    function pushTag(openTokenString, closeTokenString, startOffset, openEndOffset, closeStartOffset, closeEndOffset) {
        pushContent(startOffset);
        pushToken(openTokenString, startOffset, openEndOffset);
        pushToken(utf8.slice(openEndOffset, closeStartOffset), openEndOffset, closeStartOffset);
        pushToken(closeTokenString, closeStartOffset, closeEndOffset);
        contentStart = closeEndOffset;
        index = closeEndOffset;
    }

    function pushOpenWithoutClose(tokenString, startOffset, openEndOffset, nextOpenOffset) {
        pushContent(startOffset);
        pushToken(tokenString, startOffset, openEndOffset);
        pushToken(utf8.slice(openEndOffset, nextOpenOffset), openEndOffset, nextOpenOffset);
        contentStart = nextOpenOffset;
        index = nextOpenOffset;
    }

    while (index < utf8.length) {
        if (openDelimiter === '{{' && utf8.startsWith('{{!--', index)) {
            const closeIndex = utf8.indexOf('--}}', index + 5);
            const nextOpenIndex = utf8.indexOf('{{!--', index + 5);
            if (nextOpenIndex !== -1 && (closeIndex === -1 || nextOpenIndex < closeIndex)) {
                pushOpenWithoutClose('{{!--', index, index + 5, nextOpenIndex);
                continue;
            }
            if (closeIndex === -1) {
                pushContent(index);
                pushToken('{{!--', index, index + 5);
                pushToken(utf8.slice(index + 5), index + 5, utf8.length);
                contentStart = utf8.length;
                index = utf8.length;
            } else {
                pushTag('{{!--', '--}}', index, index + 5, closeIndex, closeIndex + 4);
            }
            continue;
        }

        if (openDelimiter === '{{' && utf8.startsWith('{{{', index)) {
            const closeIndex = utf8.indexOf('}}}', index + 3);
            const nextOpenIndex = utf8.indexOf('{{{', index + 3);
            if (nextOpenIndex !== -1 && (closeIndex === -1 || nextOpenIndex < closeIndex)) {
                pushOpenWithoutClose('{{{', index, index + 3, nextOpenIndex);
                continue;
            }
            if (closeIndex === -1) {
                pushContent(index);
                pushToken('{{{', index, index + 3);
                pushToken(utf8.slice(index + 3), index + 3, utf8.length);
                contentStart = utf8.length;
                index = utf8.length;
            } else {
                pushTag('{{{', '}}}', index, index + 3, closeIndex, closeIndex + 3);
            }
            continue;
        }

        if (utf8.startsWith(openDelimiter, index)) {
            const openEndOffset = index + openDelimiter.length;
            const closeIndex = utf8.indexOf(closeDelimiter, openEndOffset);
            const nextOpenIndex = utf8.indexOf(openDelimiter, openEndOffset);

            if (nextOpenIndex !== -1 && (closeIndex === -1 || nextOpenIndex < closeIndex)) {
                pushOpenWithoutClose('{{', index, openEndOffset, nextOpenIndex);
                continue;
            }

            if (closeIndex === -1) {
                pushContent(index);
                pushToken('{{', index, openEndOffset);
                pushToken(utf8.slice(openEndOffset), openEndOffset, utf8.length);
                contentStart = utf8.length;
                index = utf8.length;
                continue;
            }

            pushTag('{{', '}}', index, openEndOffset, closeIndex, closeIndex + closeDelimiter.length);

            const delimiters = parseSetDelimiter(utf8.slice(openEndOffset, closeIndex));
            if (delimiters) {
                openDelimiter = delimiters.openDelimiter;
                closeDelimiter = delimiters.closeDelimiter;
            }
            continue;
        }

        index += 1;
    }

    pushContent(utf8.length);

    return tokens;
}

function parseSetDelimiter(tagString) {
    const trimmed = tagString.trim();

    if (!trimmed.startsWith('=') || !trimmed.endsWith('=')) {
        return null;
    }

    const parts = trimmed.slice(1, -1).trim().split(/\s+/);

    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
        return null;
    }

    return {
        openDelimiter: parts[0],
        closeDelimiter: parts[1],
    };
}

function createLineInfo(utf8) {
    const rawLines = utf8.split('\n');
    const lines = [];
    const lineStarts = [];
    let offset = 0;

    for (let i = 0; i < rawLines.length; i += 1) {
        const line = i < rawLines.length - 1 ? rawLines[i] + '\n' : rawLines[i];
        lines.push(line);
        lineStarts.push(offset);
        offset += line.length;
    }

    return {
        locate(position) {
            let lineIndex = lineStarts.length - 1;

            for (let i = 0; i < lineStarts.length; i += 1) {
                if (i === lineStarts.length - 1 || position < lineStarts[i + 1]) {
                    lineIndex = i;
                    break;
                }
            }

            return {
                line: lines[lineIndex],
                lineNumber: lineIndex + 1,
                lineStart: lineStarts[lineIndex],
                startPosition: position - lineStarts[lineIndex],
            };
        },
    };
}
