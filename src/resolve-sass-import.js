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
    if (!importPath.endsWith('.scss')) {
        importPath = importPath + '.scss';
    }

    let absoluteIncludePath = includePath;
    if (!path.isAbsolute(includePath)) {
        absoluteIncludePath = path.normalize(path.join(process.cwd(), includePath));
    }

    if (contextPath != null) {
        contextPath = path.normalize(contextPath);
        if (!path.isAbsolute(contextPath)) {
            contextPath = path.normalize(path.join(process.cwd(), contextPath));
        }
    }

    let containsSep = importPath.includes('/');
    let base = containsSep ? importPath.substr(0, importPath.lastIndexOf('/')) + '/' : '';
    let fileName = containsSep ? importPath.substr(importPath.lastIndexOf('/') + 1) : importPath;

    let build = (a,b) => { return path.normalize(path.join(absoluteIncludePath, path.join(a,b)))};

    let full = build(base, fileName);
    let partial = build(base, `_${fileName}`);

    if (path.exists(full)) {
        return full;

    } else if (!fileName.startsWith('_') && path.exists(partial)) {
        return partial;

    } else if (contextPath != null && contextPath.startsWith(absoluteIncludePath)) {
        let relativeContext = path.relative(absoluteIncludePath, contextPath);
        let fixedPath = path.normalize(path.join(relativeContext, importPath));
        return resolveSassImport(fixedPath, includePath, null);
    }

    return null;
}

module.exports = resolveSassImport;