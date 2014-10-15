var gulp = require('gulp'),
    connect = require('gulp-connect'),
    open = require('gulp-open'),
    port = process.env.port || 3001;

gulp.task('open', function(){
  var options = {
    url: 'http://localhost:' + port,
  };
  gulp.src('./www/index.html')
  .pipe(open('', options));
});

gulp.task('connect', function() {
  connect.server({
    root: 'www',
    port: port,
    livereload: true
  });
});

gulp.task('test', function() {
  connect.server({
    root: '.',
    port: port - 1,
    livereload: true
  });

  var options = {
    url: 'http://localhost:' + (port - 1),
  };
  gulp.src('./test/index.html')
  .pipe(open('', options))
});

gulp.task('js', function () {
  gulp.src('./www/**/*.js')
    .pipe(connect.reload());
});

gulp.task('html', function () {
  gulp.src('./www/*.html')
    .pipe(connect.reload());
});

gulp.task('watch', function() {
    gulp.watch('www/dist/js/*.js', ['js']);
    gulp.watch('www/index.html', ['html']);
});

gulp.task('default', ['connect', 'watch']);

gulp.task('serve', ['connect', 'watch', 'open']);