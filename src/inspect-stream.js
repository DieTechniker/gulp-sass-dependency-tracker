'use strict';

// Stream utilities
const map = require('map-stream');

/**
 * Invokes a callback for each regex match in the contents of the files in a stream.
 *
 * @param regExp The regular expression to match against.
 * @param matchCallback The function to invoke when a match has been found. (func (match, file))
 * @returns {stream}
 */

function inspect(regExp, matchCallback) {
    return map(function (file, strmCallback) {

        // Copy regex
        regExp = RegExp(regExp.source, regExp.flags);

        let content = file.contents;
        let match;
        while (match = regExp.exec(content)) {
            matchCallback(match, file);
        }

        return strmCallback(null, file);
    });
}

module.exports = inspect;