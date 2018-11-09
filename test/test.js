const assert = require('assert');

const gulp = require('gulp');
const dependencyTracker = new require('../src/dependency-tracker');

process.chdir('test');

before(function () {
    gulp.src('sass/*.scss')
        .pipe(dependencyTracker.inspect());
});

describe('Import-Detection', function () {
    describe('#inspect()', function () {
        it('child depends on \'parent\'', function () {

        });

        it('child depends on \'partial\'', function () {

        });
    })
});