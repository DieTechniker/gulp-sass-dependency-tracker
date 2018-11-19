'use strict';

// General utilities
const fs = require('fs');

/**
 * Path library Ponyfill.
 *
 * @type {{isAbsolute: boolean, resolve: string, join: string, normalize: string, relative: string, exists: boolean}}
 */

const path = {
    isAbsolute: require('is-absolute'), // path.isAbsolute
    resolve: require('path-resolve'), // path.resolve
    dirname: require('path-dirname'), // path.dirname
    join: require('path.join'), // path.join
    normalize: require('normalize-path'), // path.normalize
    relative: require('relative').toBase, // path.relative
    basename: require('basename'), //path.basename
    exists: function (file) { // path.existsSync
        file = path.normalize(file);
        return fs.existsSync(path.resolve(file))
    }
};

module.exports = path;