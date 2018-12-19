'use strict';

const path = require('./path-ponyfill');

/**
 * Tries to resolve a sass import based on some contextual information.
 * (Includes testing for a partial.)
 * Returns the path of the import target if found.
 *
 * @param importPath the path used in the import statement.
 * @param includePath The sass include path. (Invoke multiple times for multiple include paths.)
 * @param contextPath The base path of the importing file. (Used for relative imports.)
 * @returns {string|null}
 */
function resolveSassImport(importPath, includePath, contextPath) {
    let lookupPath = importPath;
    if (!lookupPath.endsWith('.scss') && !lookupPath.endsWith('.sass')) {
        lookupPath = lookupPath + '.scss';
    }

    let absoluteIncludePath = path.normalize(includePath);
    if (!path.isAbsolute(includePath)) {
        absoluteIncludePath = path.normalize(path.join(process.cwd(), includePath));
    }

    if (contextPath != null) {
        contextPath = path.normalize(contextPath);
        if (!path.isAbsolute(contextPath)) {
            contextPath = path.normalize(path.join(process.cwd(), contextPath));
        }
    }

    let containsSep = lookupPath.includes('/');
    let base = containsSep ? lookupPath.substr(0, lookupPath.lastIndexOf('/')) + '/' : '';
    let fileName = containsSep ? lookupPath.substr(lookupPath.lastIndexOf('/') + 1) : lookupPath;

    let build = (a,b) => { return path.normalize(path.join(absoluteIncludePath, path.join(a,b)))};

    let full = build(base, fileName);
    let partial = build(base, `_${fileName}`);

    if (path.exists(full)) {
        return full;

    } else if (!fileName.startsWith('_') && path.exists(partial)) {
        return partial;

    } else if (contextPath != null && contextPath.startsWith(absoluteIncludePath)) {
        let relativeContext = path.relative(absoluteIncludePath, contextPath);
        let fixedPath = path.normalize(path.join(relativeContext, lookupPath));
        return resolveSassImport(fixedPath, includePath, null);

    } else if (!importPath.endsWith('.scss') && !importPath.endsWith('.sass') && lookupPath.endsWith('.scss')) {
        // When the file type has not been explicitly provided and we only looked for an SCSS file,
        // also look for a sassy version ending in ".sass"
        let sassyPath = `${importPath}.sass`;
        return resolveSassImport(sassyPath, includePath, contextPath);
    }

    return null;
}

module.exports = resolveSassImport;