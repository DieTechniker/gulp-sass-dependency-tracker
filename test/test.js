'use strict';

// --- Dependencies --- //
const assert = require('assert');

const gulp = require('gulp');
const gRename = require('gulp-rename');
const map = require('map-stream');
const Vinyl = require('vinyl');

const path = require('../src/path-ponyfill');
const SassDepTracker = require('../index');
const dependencyTracker = new SassDepTracker({
    debug: false,
    suppressOutput: true
});

// --- Setup --- //

process.chdir('test');

const globPattern = './sass/**/*.scss';

const sassOptions = {
    includePathes: [
        path.resolve('./sass')
    ]
};

let commonCWD = path.resolve('./');
let commonBase = path.resolve('./sass');

let child = new Vinyl({
    cwd: commonCWD,
    base: commonBase,
    path: path.resolve('./sass/child.scss'),
    contents: null
});

let parent = new Vinyl({
    cwd: commonCWD,
    base: commonBase,
    path: path.resolve('./sass/parent.scss')
});

let partialParent = new Vinyl({
    cwd: commonCWD,
    base: commonBase,
    path: path.resolve('./sass/_partial.scss')
});

let unrelated = new Vinyl({
    cwd: commonCWD,
    base: commonBase,
    path: path.resolve('./sass/unrelated.scss')
});

let relativeImporting = new Vinyl({
    cwd: commonCWD,
    base: path.join(commonBase, 'subdir'),
    path: path.resolve('./sass/subdir/2/relative-import.scss')
});

let relativeDependency = new Vinyl({
    cwd: commonCWD,
    base: path.join(commonBase, 'subdir'),
    path: path.resolve('./sass/subdir/2/relative-dependency.scss')
});

// --- Readability helper --- //
let childPath = path.normalize(child.path);

let getEntry = function(file) {
    // noinspection JSDeprecatedSymbols - function created for this test purpose.
    return dependencyTracker.getTree().getEntry(file);
};

let getDependencies = (file = child) => {
    return getEntry(file).get('dependencies');
};

let aggregateFilesFromStream = function(files) {
    return map(function (file, cb) {
        let filePath = path.normalize(file.path);
        files.push(filePath);
        return cb(null, file);
    });
};

// --- Mocha tests --- //

describe('SassDependencyTracker', function () {
    before(function (cb) {
        dependencyTracker.reset();
        gulp.src(globPattern)
            .pipe(dependencyTracker.inspect(sassOptions))
            .pipe(dependencyTracker.logFiles())
            .pipe(dependencyTracker.reportCompiled())
            .on('end', cb);
    });

    describe('#inspect()', function () {
        it('recognized child', function () {
            assert.notEqual(getEntry(child), null, `Template was not tracked as: ${childPath}!`)
        });

        it('should have two dependencies for child', function () {
            let dependencies = getEntry(child).get('dependencies');
            assert.equal(dependencies.length, 2, 'Dependencies count does not match!')
        });

        it('should list child dependent on \'parent\'', function () {
            let parentPath = path.normalize(parent.path);
            assert(getDependencies().includes(parentPath), 'Parent is not listed as dependency!');
        });

        it('should list child dependent on \'partial\'', function () {
            let partialPath = path.normalize(partialParent.path);
            assert(getDependencies().includes(partialPath), 'Partial is not listed as dependency!');
        });

        it('should have resolved the relative dependency', function () {
            let dependencyPath = path.normalize(relativeDependency.path);
            assert(getDependencies(relativeImporting).includes(dependencyPath), 'Relative import is not found or unresolved!')
        })
    });

    describe('#filter()', function () {
        it('will include no file for no changes', function () {
            let files = [];
            gulp.src(globPattern)
                .pipe(dependencyTracker.filter())
                .pipe(aggregateFilesFromStream(files));

            assert(!files.includes(path.normalize(child.path)), 'Child not filtered!');
            assert(!files.includes(path.normalize(parent.path)), 'Parent not filtered!');
            assert(!files.includes(path.normalize(partialParent.path)), 'Partial not filtered!');
            assert(!files.includes(path.normalize(unrelated.path)), 'Unrelated not filtered!');
        });

        it('marks two files as dirty', function () {
            dependencyTracker.queueRebuild(path.normalize(partialParent.path));
            assert(getEntry(partialParent).get('recompile') === true, 'Partial not queued for rebuild!');
            assert(getEntry(child).get('recompile') === true, 'Child not queued for rebuild!');
        });

        it('will include child when partial changes', function () {
            dependencyTracker.queueRebuild(path.normalize(partialParent.path));
            let files = [];
            return new Promise(function (resolve, reject) {
                gulp.src(globPattern)
                    .pipe(dependencyTracker.filter())
                    .pipe(aggregateFilesFromStream(files))
                    .on('end', function () {
                        resolve();
                    })
                    .on('error', reject);

            }).then(function () {
                assert(files.includes(path.normalize(child.path)), 'Child not included!');
                assert(!files.includes(path.normalize(parent.path)), 'Parent not filtered!');
                assert(files.includes(path.normalize(partialParent.path)), 'Partial not included!');
                assert(!files.includes(path.normalize(unrelated.path)), 'Unrelated not filtered!');
            });
        })
    });

    describe('#reportCompiled()', function () {
        it('will remove files from being dirty upon recompilation - even if renamed', function () {
            return new Promise(function (resolve, reject) {
                gulp.src(globPattern)
                    .pipe(gRename(function (file) {
                        file.extname += '.css'
                    }))
                    .pipe(dependencyTracker.reportCompiled())
                    .on('end', function () {
                        resolve();
                    })
                    .on('error', reject);
            }).then(function () {
                assert.strictEqual(getEntry(child).get('recompile'), false, 'Child still dirty!');
                assert.strictEqual(getEntry(partialParent).get('recompile'), false, 'Partial still dirty!');
            });
        });
    });
});