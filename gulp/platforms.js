var platformsPath = '../platforms/';

var gulp = require('gulp');
var path = require('path');
var source = require('vinyl-source-stream');

var $ = require('gulp-load-plugins')({
    pattern: ['gulp-*', 'main-bower-files', 'browserify', 'del']
});

var version = '/*cordova */\n';

//var suppPlatforms = require(platformsPath + 'platforms');

gulp.task('platforms', [], function () {
    for (var plt in suppPlatforms) {
        $.browserify('../platforms/' + plt + '/platform_www/cordova.js')
            .require('../platforms/' + plt + '/platform_www/cordova.js')
            .bundle()
            .pipe(source(path.basename('../platforms/' + plt + '/platform_www/cordova.js')))
            //.pipe($.concat('cordova.js'))
            //.pipe(buffer())
            .pipe($.insert.prepend(version))
            .pipe($.rename(function (path) {
                path.basename = 'cordova-' + plt;
            }))
            .pipe(gulp.dest('./'));
    }

    return;//stream.merge.apply(null, tasks);

});
