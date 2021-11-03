var browserSync = require("browser-sync");
var gulp = require("gulp");
var gulpEjs = require("gulp-ejs");
var gulpMinify = require("gulp-minify");
var gulpPlumber = require("gulp-plumber");
var gulpRename = require("gulp-rename");
var gulpSass = require("gulp-sass")(require("sass"));
var gulpTypescript = require("gulp-typescript");
var tsProject = gulpTypescript.createProject("tsconfig.json");

gulp.task("default", function () {
  // Default task code
});

gulp.task("bs", function () {
  browserSync({
    server: {
      baseDir: "build",
    },
    port: 10001
  });
});

gulp.task("html", function () {
  return gulp
    .src(["src/ejs/**/*.ejs", "!" + "src/ejs/**/_*.ejs", "!"])
    .pipe(gulpPlumber())
    .pipe(gulpRename({ extname: ".html" }))
    .pipe(gulpEjs())
    .pipe(gulp.dest("build"))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task("css", function () {
  return gulp.src("src/sass/**/*.scss")
    .pipe(gulpPlumber())
    .pipe(gulpSass({ outputStyle: "compressed" }))
    .pipe(gulp.dest("build/css"))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task("js", function () {
  return tsProject.src()
    .pipe(tsProject())
    .js
    .pipe(gulpMinify({ ext: { src: ".js", min: ".min.js" } }))
    .pipe(gulp.dest("build/js"))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task("watch", gulp.parallel(
  "bs",
  "html",
  "css",
  "js",
  function (done) {
    gulp.watch("src/ejs/**/*.ejs", gulp.task("html"));
    gulp.watch("src/sass/**/*.scss", gulp.task("css"));
    gulp.watch("src/ts/**/*.ts", gulp.task("js"));
    done();
  }
));

gulp.task("build", gulp.parallel(
  "html",
  "css",
  "js"
));
