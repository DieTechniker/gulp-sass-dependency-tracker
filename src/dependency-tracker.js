'use strict';

// General utilities
const logging = require('./logging');

// Stream utilities
const map = require('map-stream');

// Gulp utilities
const gIgnore = require('gulp-ignore');

// Custom functions (exported for readability)
const resolveImport = require('./resolve-sass-import');
const inspectStream = require('./inspect-stream');

// Ponyfill for `path`
const path = require('./path-ponyfill');

const SassDependencyTree = require('./dependency-tree');

const importRegex = /@import ['"]([\w./-]+)['"];/g;
let partialExclusionWarning = true;

/**
 * Main class of a helpful module for sass compilation tasks with GulpJS.
 * For the full module documentation please consult the readMe.md file.
 *
 * @property sassTree {SassDependencyTree} Manager of the dependency tree. Please use {@link getTree} instead of directly accessing this property so the contract can be upheld!
 */
class DependencyTracker {

    // --- Private fields --- //

    // TODO: Use when supported by Node.
    //#sassTree;

    // --- Public methods --- //

    /**
     * Constructs a new tracker instance.
     */
    constructor(options = {debug: false, suppressOutput: false}) {
        this.sassTree = new SassDependencyTree(options);
        this.options = options;
    }

    /**
     * Internal method for checking the debug setting.
     */
    isDebug() {
        return this.options.debug || false;
    }

    /**
     * Internal function for checking if the output should be suppressed.
     */
    isOutputSuppressed() {
        return this.options.suppressOutput || false;
    }

    /**
     * Filters the stream to only include files that need to be recompiled.
     *
     * @returns {stream}
     */
    filter() {
        const me = this;
        return gIgnore.include(function (file) {
            return !file.path.endsWith('.scss') || !me.getTree().isCompiled(file);
        });
    }

    /**
     * Inspects the streams files to track import statements.
     *
     * @param sassOptions to retrieve the includePaths
     * @returns {stream}
     */
    inspect(sassOptions) {
        const me = this;
        return inspectStream(importRegex, function (match, file) {
            if (file.path.endsWith('.scss')) {
                me.reportImport(match, file, sassOptions);
            }
        });
    }

    /**
     * Just sends a log message about the included files.
     *
     * @returns {stream}
     */
    logFiles() {
        let me = this;
        return map(function (file, cb) {
            if (!me.isOutputSuppressed()) {
                let filePath = path.normalize(file.path);
                let baseName = path.basename(file.path);

                if (!baseName.startsWith('_')) {
                    logging.log.info(logging.colors.debug(`Will be compiling: ${filePath}`));
                } else if (partialExclusionWarning) {
                    partialExclusionWarning = false;
                    logging.log.warn(logging.colors.warn('Partials have been encountered in your stream.'));
                    logging.log.warn(logging.colors.info('Be aware that they will not be compiled by gulp-sass and thus cannot be properly filtered.'));
                    logging.log.warn(logging.colors.info('See https://github.com/DieTechniker/gulp-sass-dependency-tracker/issues/3 for more information.'));
                    logging.log.warn(logging.colors.info('This message will not be displayed again during this runtime.'))
                }
            }
            return cb(null, file);
        });
    }

    /**
     * Reports a file as compiled so it does not get recompiled the next time.
     * Call this after the sass compilation.
     *
     * @returns {stream}
     */
    reportCompiled() {
        let me = this;
        return map(function (file, cb) {
            // Support for renaming files.
            // Search for the earliest name ending in the scss extension.
            for (let filePath of file.history) {
                if (filePath.endsWith('.scss')) {
                    me.getTree().markAsCompiled(filePath);
                }
            }
            cb(null, file)
        })
    }

    /**
     * Resets the dependency tracker to its initial state after construction.
     */
    reset() {
        this.sassTree.clear();
    }

    /**
     * Resolves and registers an import found in a Vinyl file.
     *
     * @param match The RegEx match (group 0).
     * @param file Vinyl file the import was found in.
     * @param sassOptions to retrieve the includePaths
     * @returns {void}
     */
    reportImport(match, file, sassOptions) {
        let includePaths = sassOptions.includePaths || ['.'];
        let filePath = path.normalize(file.path);
        let regex = RegExp(importRegex.source, importRegex.flags);
        let importPath = regex.exec(match)[1];

        if (this.isDebug() && !this.isOutputSuppressed()) {
            logging.log.info(logging.colors.debug(`Found import: "${importPath}" in ${filePath}`));
        }

        let importFilePath;
        for (let inclPath of includePaths) {
            let parentDir = path.normalize(path.dirname(file.path));
            importFilePath = resolveImport(importPath, inclPath, parentDir);

            if (importFilePath) {
                break;
            }
        }

        if (importFilePath) {
            this.sassTree.addDependency(file, importFilePath);

        } else if (!this.isOutputSuppressed()) {
            logging.log.warn(logging.colors.warn(`Unable to resolve dependency "${importPath} for ${filePath}`));
        }
    }

    /**
     * Returns whether or not a file has been marked for a rebuild.
     * @see SassDependencyTree#isCompiled for more information.
     * @param file {Vinyl|Map|string|object}
     */
    needsRebuild(file) {
        return this.sassTree.isCompiled(file);
    }

    /**
     * Marks a file as dirty for recompilation.
     * Does so recursively for any files that depend on the original file.
     *
     * @param file A Vinyl file or a normalized absolute path.
     */
    queueRebuild(file) {
        this.sassTree.markAsNotCompiled(file);
    }

    /**
     * Accessor for the dependency tree.
     * Use its public contract for manually adding/removing dependencies and/or marking compilation state.
     *
     * @returns {SassDependencyTree}
     */
    getTree() {
        return this.sassTree;
    }
}

module.exports = DependencyTracker;