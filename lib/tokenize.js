export default function tokenize(_options, filename, utf8) {
    const lines = utf8.split('\n');

    let token = null;
    const tokens = [];

    function pushToken(attrs) {
        if (token) {
            Object.assign(token, attrs);
            tokens.push(token);
        }
    }

    let lineIndex = 0;
    let inComment = false;

    // Each line will break down as a new token, disregarding the "{{" "}}" syntax.
    for (; lineIndex < lines.length; lineIndex += 1) {
        // Add the newline character back after splitting it out, but only for lines
        // that were actually followed by a newline. The final split segment had no
        // trailing newline, so re-adding one would spuriously double it.
        const line = lineIndex < lines.length - 1 ? lines[lineIndex] + '\n' : lines[lineIndex];

        let tokenString = '';

        let index = 0;

        token = {
            filename,
            lineNumber: lineIndex + 1,
            startPosition: index,
        };

        for (; index < line.length; index += 1) {
            const char = line[index];

            if (char === '{') {
                const openComment = line.slice(index, index + 5);
                if (openComment === '{{!--') {
                    if (tokenString.length > 0) {
                        pushToken({
                            endPosition: index - 1,
                            tokenString,
                            line,
                        });
                    }
                    token = {
                        filename,
                        lineNumber: lineIndex + 1,
                        startPosition: index,
                    };
                    tokenString = '{{!--';
                    inComment = true;
                    index += 4;
                    continue;
                }
                if (!inComment) {
                    const openTriple = line.slice(index, index + 3);
                    if (openTriple === '{{{') {
                        if (tokenString.length > 0) {
                            pushToken({
                                endPosition: index - 1,
                                tokenString,
                                line,
                            });
                        }
                        token = {
                            filename,
                            lineNumber: lineIndex + 1,
                            startPosition: index,
                        };
                        tokenString = '{{{';
                        index += 2;
                        continue;
                    }
                    const openMustache = line.slice(index, index + 2);
                    if (openMustache === '{{') {
                        if (tokenString.length > 0) {
                            pushToken({
                                endPosition: index - 1,
                                tokenString,
                                line,
                            });
                        }
                        token = {
                            filename,
                            lineNumber: lineIndex + 1,
                            startPosition: index,
                        };
                        tokenString = '{{';
                        index += 1;
                        continue;
                    }
                }
            }

            if (char === '}') {
                const closeComment = line.slice(index - 2, index + 2);
                if (closeComment === '--}}') {
                    if (tokenString.length > 0) {
                        pushToken({
                            endPosition: index - 3,
                            tokenString: tokenString.slice(0, -2),
                            line,
                        });
                    }
                    token = {
                        filename,
                        lineNumber: lineIndex + 1,
                        startPosition: index - 2,
                    };
                    tokenString = '--}}';
                    inComment = false;
                    index += 1;
                    continue;
                }

                if (!inComment) {
                    const closeTriple = line.slice(index, index + 3);
                    if (closeTriple === '}}}') {
                        if (tokenString.length > 0) {
                            pushToken({
                                endPosition: index - 1,
                                tokenString,
                                line,
                            });
                        }
                        token = {
                            filename,
                            lineNumber: lineIndex + 1,
                            startPosition: index,
                        };
                        tokenString = '}}}';
                        index += 2;
                        continue;
                    }
                    const closeMustache = line.slice(index, index + 2);
                    if (closeMustache === '}}') {
                        if (tokenString.length > 0) {
                            pushToken({
                                endPosition: index - 1,
                                tokenString,
                                line,
                            });
                        }
                        token = {
                            filename,
                            lineNumber: lineIndex + 1,
                            startPosition: index,
                        };
                        tokenString = '}}';
                        index += 1;
                        continue;
                    }
                }
            }

            if (tokenString === '{{!--' || tokenString === '--}}') {
                pushToken({
                    endPosition: index - 1,
                    tokenString,
                    line,
                });
                token = {
                    filename,
                    lineNumber: lineIndex + 1,
                    startPosition: index,
                };
                tokenString = char;
                continue;
            }
            if (!inComment && (tokenString === '{{' || tokenString === '}}' || tokenString === '{{{' || tokenString === '}}}')) {
                pushToken({
                    endPosition: index - 1,
                    tokenString,
                    line,
                });
                token = {
                    filename,
                    lineNumber: lineIndex + 1,
                    startPosition: index,
                };
                tokenString = char;
                continue;
            }

            tokenString += char;
        }

        pushToken({
            endPosition: index,
            tokenString,
            line,
        });
    }

    return tokens;
}
