'use strict';

const path = require('./path-ponyfill');
const Vinyl = require('vinyl');
const logging = require('./logging');

/**
 * Retrieves a path from a file-like input parameter.
 * Convenience function so we support more than just strict normalized paths.
 * May be:
 * * Vinyl file
 * * Map containing a 'path' key with the resolvable path
 * * string as the resolvable path itself
 * * object containing a 'path' property as the resolvable path
 *
 * @param file {Vinyl|Map<string, string>|string|object}
 * @return {string} the resolved file path.
 */
function fileArgumentToNormalizedPath(file) {
    if (file !== undefined && file !== null) {

        if (Vinyl.isVinyl(file)) {
            return path.normalize(file.path);
        }

        let typeName = typeof file;
        if (file instanceof Map && file.has('path')) {
            return fileArgumentToNormalizedPath(file.get('path'));

        } else if (typeName === 'string') {
            return path.normalize(path.resolve(file));

        } else if (typeName === 'object' && file.hasOwnProperty('path')) {
            return path.normalize(path.resolve(file.path));

        } else if (typeName === 'object' && file.path !== undefined && file.path !== null) {
            return path.normalize(path.resolve(file.path));
        }
    }

    throw new Error(`Cannot retrieve normalized path from: ${file}`)
}

const _getOrCreateEntry = Symbol('internalGetOrCreateEntry');
const _getDependencies = Symbol('internalGetDependencies');
const _isDebug = Symbol('isDebug');
const _isOutputSuppressed = Symbol('isOutputSuppressed');

/**
 * @property internalTree {Map} Internal representation of the dependency tree. Avoid using this as it may change EVEN IN MINOR UPDATES!
 */
class SassDependencyTree {

    // --- Private fields --- //

    // TODO: Use when supported by Node.
    //#internalTree;
    //#options;

    // --- Public methods --- //

    constructor(options = {debug: false, suppressOutput: false}) {
        this.internalTree = new Map();
        this.options = options;
    }

    /**
     * Adds a direct dependency to the tracking for a file.
     *
     * @param sourceFile {Vinyl|Map|string|object} The file that has the dependency. File-like by: {@link fileArgumentToNormalizedPath}
     * @param dependencyFile {Vinyl|Map|string|object} The file that is the dependency File-like by: {@link fileArgumentToNormalizedPath}
     * @return {void}
     */
    addDependency(sourceFile, dependencyFile) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        let dependencyPath = fileArgumentToNormalizedPath(dependencyFile);

        if (this[_isDebug] && !this[_isOutputSuppressed]) {
            logging.log.info(logging.colors.debug(`Dependency added: ${sourceFilePath} => ${dependencyPath}`));
        }

        let entry = this[_getOrCreateEntry](sourceFilePath);
        entry.get('dependencies').push(dependencyPath);
    }

    /**
     * Removes a direct dependency to the tracking for a file.
     *
     * @param sourceFile {Vinyl|Map|string|object} The file that has the dependency. File-like by: {@link fileArgumentToNormalizedPath}
     * @param dependencyFile {Vinyl|Map|string|object} The file that is the dependency File-like by: {@link fileArgumentToNormalizedPath}
     * @return {void}
     */
    removeDependency(sourceFile, dependencyFile) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        let dependencyPath = fileArgumentToNormalizedPath(dependencyFile);

        if (this[_isDebug] && !this[_isOutputSuppressed]) {
            logging.log.info(logging.colors.debug(`Dependency removed: ${sourceFilePath} =/=> ${dependencyPath}`));
        }

        let entry = this[_getOrCreateEntry](sourceFilePath);
        let directDependencies = entry.get('dependencies');
        let dependencyIndex = directDependencies.indexOf(dependencyPath);
        if (dependencyIndex >= 0) {
            directDependencies.remove(dependencyIndex);
        }
    }

    /**
     * Lists the dependencies of a particular file.
     *
     * @param sourceFile {Vinyl|Map|string|object} The file that has the dependencies. File-like by: {@link fileArgumentToNormalizedPath}
     * @param deep {boolean} Whether or not to recursively look up the files dependencies and add them to the result.
     * @return {Array} Of normalized string paths. The dependencies of that file.
     */
    getDependencies(sourceFile, deep = false) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        let dependencies = [];
        this[_getDependencies](sourceFilePath, dependencies.push, deep);
        return dependencies;
    }

    /**
     * Marks a file as compiled
     *
     * @param sourceFile {Vinyl|Map|string|object} The source file. File-like by: {@link fileArgumentToNormalizedPath}
     * @return {void}
     */
    markAsCompiled(sourceFile) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        let entry = this[_getOrCreateEntry](sourceFilePath);

        if (this[_isDebug] && !this[_isOutputSuppressed]) {
            logging.log.info(logging.colors.debug(`AsCompiled: ${sourceFilePath}`));
        }

        entry.set('recompile', false);
    }

    /**
     * Sets a files state to "not compiled" meaning that it should be included on the next compile run.
     * Will also mark all files dependent on this file as "not compiled"
     *
     * @param sourceFile {Vinyl|Map|string|object} The source file. File-like by: {@link fileArgumentToNormalizedPath}
     * @return {void}
     */
    markAsNotCompiled(sourceFile) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        let entry = this[_getOrCreateEntry](sourceFilePath);
        entry.set('recompile', true);

        if (this[_isDebug] && !this[_isOutputSuppressed]) {
            logging.log.info(logging.colors.debug(`Marking for recompilation: ${sourceFilePath}`));
        }

        let dependingFiles = [];
        this.internalTree.forEach((value, key) => {
            let dependencies = value.get('dependencies');
            if (dependencies.indexOf(sourceFilePath) >= 0
                && value.get('recompile') === false) {
                dependingFiles.push(key);
            }
        });

        for (let dependent of dependingFiles) {
            this.markAsNotCompiled(dependent);
        }
    }

    /**
     *
     * @param sourceFile {Vinyl|Map|string|object} The source file. File-like by: {@link fileArgumentToNormalizedPath}
     * @return {boolean} Whether or not the file is marked as compiled.
     */
    isCompiled(sourceFile) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        let entry = this[_getOrCreateEntry](sourceFilePath);
        return entry.get('recompile') === false;
    }

    /**
     * Clears all dependencies from the internal representation.
     * @return {void}
     */
    clear() {
        this.internalTree.clear();
    }

    /**
     * Public method for our own mocha tests.
     * It is highly DISCOURAGED to use this function.
     * Its contract is also not covered by semver!
     *
     * @return {Map} the entry for that file
     * @deprecated To stress the discouragement of this function. Please do not use this in any use case - other than tests maybe.
     */
    getEntry(sourceFile) {
        let sourceFilePath = fileArgumentToNormalizedPath(sourceFile);
        return this[_getOrCreateEntry](sourceFilePath);
    }

    // --- Private methods --- //

    [_isDebug]() {
        return this.options.debug || false;
    }

    [_isOutputSuppressed]() {
        return this.options.suppressOutput || false;
    }

    /**
     *
     *
     * @param normalizedPath
     * @return {Map} The entry from the dependency tree.
     */
    [_getOrCreateEntry](normalizedPath) {
        let entry = null;

        if (!this.internalTree.has(normalizedPath)) {
            entry = new Map();
            entry.set('recompile', true);
            entry.set('path', normalizedPath);
            entry.set('dependencies', []);
            this.internalTree.set(normalizedPath, entry);
        } else {
            entry = this.internalTree.get(normalizedPath, entry);
        }

        return entry;
    }

    /**
     *
     * @param normalizedPath
     * @param aggregator
     * @param deep
     * @return {void}
     */
    [_getDependencies](normalizedPath, aggregator, deep = false) {
        if (aggregator === undefined || aggregator === null || (typeof aggregator) !== 'function') {
            throw new Error('Cannot aggregate on non-function');
        }

        let entry = this[_getOrCreateEntry](normalizedPath);
        let dependencies = entry.get('dependencies');

        for (let dependency of dependencies) {
            aggregator(dependency);

            if (deep === true) {
                this[_getDependencies](dependency, aggregator, deep);
            }
        }
    }
}

module.exports = SassDependencyTree;