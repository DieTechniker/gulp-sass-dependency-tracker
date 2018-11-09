'use strict';

// General utilities
const log = require('fancy-log');

// Stream utilities
const map = require('map-stream');

// Gulp utilities
const gIgnore = require('gulp-ignore');

// Custom functions (exported for readability)
const resolveImport = require('./resolve-sass-import');
const inspectStream = require('./inspect-stream');

// Ponyfill for `path`
const path = require('./path-ponyfill');

const colorSupport = require('color-support');
const color = require('cli-color');

const c = {};
if (colorSupport.level > 0) {
    c.success = color.greenBright;
    c.info = color.white;
    c.debug = color.blackBright;
    c.warn = color.yellow;
    c.error = color.red;
} else {
    let dummy = msg => msg;
    c.success = dummy;
    c.info = dummy;
    c.debug = dummy;
    c.warn = dummy;
    c.error = dummy;
}

const importRegex = /@import ['"]([\w./-]+)['"];/g;

/**
 * Main class of a helpful module for sass compilation tasks with GulpJS.
 * For the full module documentation please consult the readMe.md file.
 */
class DependencyTracker {

    /**
     * Constructs a new tracker instance.
     */
    constructor(options) {
        this.sass_tree = new Map();
        this.options = options || {
            debug: false
        }
    }

    /**
     * Internal method for checking the debug setting.
     */
    isDebug() {
        return this.options.debug || false;
    }

    /**
     * Filters the stream to only include files that need to be recompiled.
     *
     * @returns {stream}
     */
    filter() {
        const me = this;
        return gIgnore.include(function (file) {
            return !file.path.endsWith('.scss') || me.needsRebuild(file);
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
            let filepath = path.normalize(file.path);
            log.info(c.debug(`Will be compiling: ${filepath}`));
            me.getOrCreateEntry(filepath).set('recompile', false);
            return cb(null, file);
        });
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

        let importFilePath;
        for (let inclPath of includePaths) {
            importFilePath = resolveImport(importPath, inclPath, path.normalize(file.base));

            if (importFilePath) {
                break;
            }
        }

        if (importFilePath) {
            this.getOrCreateEntry(filePath).get('dependencies').push(importFilePath);
            if (this.isDebug()) {
                log.info(c.debug(`${file.path} =dep=> ${importFilePath}`));
            }

        } else {
            log.warn(c.warn(`Unable to resolve dependency "${importPath} for ${filePath}`));
        }
    }

    /**
     * Convenience function to gracefully get entries from the internal mapping.
     *
     * @param normalizedPath Normalized absolute file path.
     * @returns {Map}
     */
    getOrCreateEntry(normalizedPath) {
        if (!this.sass_tree.has(normalizedPath)) {
            let entry = new Map();
            entry.set('recompile', true);
            entry.set('dependencies', []);
            this.sass_tree.set(normalizedPath, entry);
        }

        return this.sass_tree.get(normalizedPath);
    }

    /**
     * Returns whether or not a file has been marked for a rebuild.
     *
     * @param file A Vinyl file or a normalized absolute path.
     * @returns {boolean}
     */
    needsRebuild(file) {
        let filepath = (typeof  file === 'string') ? file : file.path;
        filepath = path.normalize(filepath);

        return this.getOrCreateEntry(filepath).get('recompile') === true;
    }

    /**
     * Marks a file as dirty for recompilation.
     * Does so recursively for any files that depend on the original file.
     *
     * @param file A Vinyl file or a normalized absolute path.
     */
    queueRebuild(file) {
        let filepath = (typeof file === 'string') ? file : file.path;
        filepath = path.normalize(filepath);

        log.info(c.info(`Queuing ${filepath} for rebuild.`));
        let mapEntry = this.getOrCreateEntry(filepath);
        mapEntry.set('recompile',true);

        let rebuildDepends = [];
        let rebuildCheck = (entry, key, map) => {
            let dependencies = entry.get('dependencies');
            if (entry.get('recompile') === false && dependencies.includes(filepath)) {
                rebuildDepends.push(key);

                if (this.isDebug()) {
                    log.info(c.debug(`Found dependency: ${key}`));
                }
            }
        };

        let rebuildQueue = entry => {
            this.queueRebuild(entry);
        };

        this.sass_tree.forEach(rebuildCheck);
        rebuildDepends.forEach(rebuildQueue);
    }
}

module.exports = DependencyTracker;