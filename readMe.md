# GulpSassDependencyTracker [![GitHub version](https://badge.fury.io/gh/DieTechniker%2Fgulp-sass-dependency-tracker.svg)](https://badge.fury.io/gh/DieTechniker%2Fgulp-sass-dependency-tracker) [![npm version](https://badge.fury.io/js/%40dietechniker%2Fgulp-sass-dependency-tracker.svg)](https://badge.fury.io/js/%40dietechniker%2Fgulp-sass-dependency-tracker)

A NodeJS module for keeping things easy in sass tasks for Gulp.  
This gulp plugin filters the file stream to include only scss files that have to be recompiled.  
Also features automatic dependency tracking based on the same stream.  
Best fitted for gulp watch tasks where partial rebuilds are desirable.

## Example usage

Firstly, here's a quick example:

```js
// Sass-Dependency-Tracker for partial recompilation
const SassDepTracker = require('@dietechniker/gulp-sass-dependency-tracker');
const sassDepTracker = new SassDepTracker();

const fileGlob = 'resources/sass/**/*.scss';

gulp.task('sass', function () {
    gulp.src(fileGlob)
                .pipe(sassDepTracker.filter())
                .pipe(gulpPrependAppend.prependText(`@import 'some-mandatory-import-prepended';`))
                .pipe(sassDepTracker.inspect(sassOptions))
                .pipe(sassDepTracker.logFiles())
                .pipe(sass(sassOptions).on('error', sass.logError))
                .pipe(sassDepTracker.reportCompiled())
                .pipe(gulp.dest('.'))
});

gulp.task('sass:watch', function () {
    let watcher = gulp.watch(fileGlob, 'sass');
    
    watcher.on('unlink', file => {
        log.info(`File deleted: ${file.path}`);
        sassDepTracker.queueRebuild(file);
    });
    
    watcher.on('add', file => {
        log.info(`File added: ${file.path}`);
    });
    
    watcher.on('change', file => {
        log.info(`File changed: ${file.path}`);
        sassDepTracker.queueRebuild(file);
    });
});
```

As you can see, we have four main things to register in order to get things flying:
1. Create our instance of the sass helper  
2. Pipe the stream into ``DependencyTracker#filter()``  
  2.1 Optionally pipe through ``DependencyTracker#logFiles()`` if you want a notification about whats left in the stream.
3. Pipe the stream into ``DependencyTracker#inspect(<sassOptions>)``  
4. Pipe the stream into ``gulp-sass`` or any similar compilation package.
5. Pipe the stream into ``DependencyTracker#reportCompiled()`` to mark them as compiled.
6. Notify the sass helper when a file is removed or changed so we can mark them dirty.  

Note: On the first run all files in the stream are marked dirty as none of them have been analyzed yet.

### ``filter()``
The filter function is responsible for keeping only the files in the stream which need to be recompiled.  
When a file change is reported (``#queueRebuild``), the file and all its depending files will be marked for recompile.  

### ``inspect(<sassOptions>)``
When the stream is piped through this function, the plugin reads ``@import`` statements from the files contents.  
This information is used to determine which files depend on which.  
That also means, that any dependencies not in the stream cannot be tracked. (Little hint at the bottom)

### ``queueRebuild(<file>)`` on watchers
When a file has been changed, it needs to be marked for recompilation with its depending files.  
This method does exactly that.  
It is recommended that ``file`` is a Vinyl file but an absolute normalized path should work too.  

### ``logFiles``
Just a convenience function that logs out the absolute file paths from the stream so you know what will be compiled.

### Dependency detection
In normal use cases, the helper can detect all dependencies through the ``inspect`` function.  
That means that any dynamically injected imports will have to be added __before__ ``filter()`` is called.  
If you need to have dependencies tracked which are not/never included in the stream, you may manually register them.  
Take a look at ``#reportImport(<match>, <file>, <sassOptions>)`` for that purpose.

## Options
There are two kinds of options:

1. SassOptions  
  Used to retrieve the ``includePaths`` from the options so we can properly resolve the imports.
2. Module options with:  
  ```js
    {
      debug: false // Whether or not to provide debug log message (e.g. from the dependency detection)  
      suppressOutput: false // Whether or not to suppress all console messages (does not apply to debug output!)
    }
  ```