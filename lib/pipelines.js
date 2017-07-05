
const gulp = require('gulp');
const bemxjst = require('gulp-bem-xjst');
const merge = require('merge2');
const filter = require('through2-filter').obj;
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const headerfooter = require('gulp-headerfooter');

// это раньше работало в enb ??? -xjst, потом сделали в bemxjst, но битую, потом починили с опцией.
// TODO: пойти в bem-xjst в ПР про фикс обвязки, проверить что она работает, заапить этот ПР, заапить это внедрение в
// gulp-bem-xjst  -> PROFIT!

const bemhtmlPrefix = `var BEMHTML;

    (function(global) {
        function buildBemXjst(__bem_xjst_libs__) {
            var exports = {};

`;

const bemhtmlSuffix = `
var defineAsGlobal = true;

// Provide with CommonJS
if (typeof module === 'object' && typeof module.exports === 'object') {
    exports['BEMHTML'] = buildBemXjst({});
    defineAsGlobal = false;
}

// Provide to YModules
if (typeof modules === 'object') {
    modules.define(
        'BEMHTML',
        [],
        function(provide) {
                provide(buildBemXjst({}));
            }
        );

    defineAsGlobal = false;
}

// Provide to global scope
if (defineAsGlobal) {
    BEMHTML = buildBemXjst({});
    global['BEMHTML'] = BEMHTML;
}
}})(typeof window !== "undefined" ? window : global || this);`;

function finalizePipe(target, stream) {
    return stream
        .pipe(concat(target.name))
        .pipe(rename(function(file) {
            file.dirname = file.extname = '';
            file.basename = target.name;
        }))
        .pipe(gulp.dest(target.dst));
}

const baseTechPipelines = {
    bemhtml: stream => stream
        .pipe(concat('src.bemhtml.js'))
        .pipe(bemxjst.bemhtml({ escapeContent: true, elemJsInstances: true })),
    bemtree: stream => stream
        .pipe(concat('src.bemtree.js'))
        .pipe(bemxjst.bemtree()),
    css: stream => stream,
    js: stream =>
        merge(
            gulp.src(require.resolve('ym')),
            stream
                .pipe(filter(file => file.tech === 'bemhtml.js'))
                .pipe(concat('browser.bemhtml.js'))
                .pipe(bemxjst.bemhtml({ escapeContent: true, elemJsInstances: true }))
                .pipe(headerfooter(bemhtmlPrefix, bemhtmlSuffix)),
            stream
                .pipe(filter(file => file.tech !== 'bemhtml.js'))
        )
};

const pipelineTemplate(target, stream, premodules, modules, postmodules) {
    return src
        .user_handlers('premodules') // default
        .add_mandatory_modules + concat
        .user_handlers('postmodules')
}

module.exports = {
    bemhtml: (target, ) => {},
    preUserPipeline: {},

    postUserPipeline: ['bemhtml', 'bemtree', 'css', 'js'].reduce((acc, item) => {
        acc[item] = finalizePipe;
        return acc;
    }, {})
};
