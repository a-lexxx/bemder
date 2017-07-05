
const gulp = require('gulp');
const bemxjst = require('gulp-bem-xjst');
const uglify = require('gulp-uglify');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const csso = require('gulp-csso');
const merge = require('merge2');
const stylus = require('gulp-stylus');
const postcssUrl = require('postcss-url');
const filter = require('through2-filter').obj;
const concat = require('gulp-concat');

module.exports = {
    staticDir: 'static',
    viewsDir: 'views',
    bundleDir: '.enb/tmp/bundles',
    levels: [],

    techMap: {
        bemhtml: ['bemhtml.js'],
        bemtree: ['bemtree.js'],
        js: ['vanilla.js', 'browser.js', 'js', 'bemhtml.js'],
        css: ['styl', 'css']
    },

    pipelines: {
        bemhtml: stream => stream
            .pipe(concat('src.bemhtml.js'))
            .pipe(bemxjst.bemhtml()),
        bemtree: stream => stream
            .pipe(concat('src.bemtree.js'))
            .pipe(bemxjst.bemtree()),
        css: stream => stream
            .pipe(stylus())
            .pipe(postcss([
                autoprefixer({
                    browsers: ['ie >= 10', 'last 2 versions', 'opera 12.1', '> 2%']
                }),
                postcssUrl({ url: 'inline' })
            ]))
            .pipe(concat('src.min.css'))
            .pipe(csso()),
        js: stream =>
            merge(
                gulp
                    .src(require.resolve('ym')),
                stream
                    .pipe(filter(file => ({ 'vanilla.js': 1, 'browser.js': 1, js: 1 }[file.tech]))),
                stream
                    .pipe(filter(file => file.tech === 'bemhtml.js'))
                    .pipe(concat('browser.bemhtml.js')).pipe(bemxjst.bemhtml())
            )
                .pipe(uglify())
    }
};
