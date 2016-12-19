'use strict';

const _ = require('lodash');
const fs = require('mz/fs');
const path = require('path');
const gulp = require('gulp');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const bemxjst = require('gulp-bem-xjst');
const bemSrc = require('gulp-bem-src');
const watcherBuilder = require('./watcher');
const crypto = require('crypto');
const fileEval = require('file-eval');

const uglify = require('gulp-uglify');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const csso = require('gulp-csso');
const merge = require('merge2');
const stylus = require('gulp-stylus');
const postcssUrl = require('postcss-url');
const filter = require('through2-filter').obj;


function genIdx() {
    return crypto.createHash('md5').update(JSON.stringify(arguments)).digest('hex');
}

var debug = true;
var log   = (!debug) ? function() { } : console.log.bind(console);
var stLog = (!debug) ? function() { } : function(descr, st) {
    st.on('data', f => log(descr, f.path));
}

var watcher,
    goodCache = { },
    promiseChain = null,
    waiters = 0;

module.exports = function(options) {
    options = _.assign({
        staticDir: 'static',
        viewsDir: 'views',
        bundleDir: '.enb/tmp/bundles',
        levels: [ ],
        techMap: {
            bemhtml: [ 'bemhtml.js' ],
            bemtree: [ 'bemtree.js' ],
            js: [ 'vanilla.js', 'browser.js', 'js' ],
            css: [ 'styl', 'css' ]
        }
    }, options);
    options.pipelines = _.assign({
        bemhtml: stream =>
            stream
                .pipe(concat('src.bemhtml.js'))
                .pipe(bemxjst.bemhtml()),
        bemtree: stream =>
            stream
                .pipe(concat('src.bemtree.js'))
                .pipe(bemxjst.bemtree()),
        css: stream =>
            stream
                .pipe(stylus())
                .pipe(postcss([
                    autoprefixer({
                        browsers: [ 'ie >= 10', 'last 2 versions', 'opera 12.1', '> 2%' ]
                    }),
                    postcssUrl({ url: 'inline' })
                ]))
                .pipe(concat('src.min.css'))
                .pipe(csso()),
        js: stream =>
            merge(
                gulp.src(require.resolve('ym')),
                stream.pipe(filter(f => ~[ 'vanilla.js', 'browser.js', 'js' ].indexOf(f.tech))),
                stream.pipe(filter(file => file.tech === 'bemhtml.js'))
                    .pipe(concat('browser.bemhtml.js')).pipe(bemxjst.bemhtml())
            )
                .pipe(uglify())
                .pipe(concat('src.min.js'))
    }, options.pipelines);

    if (!watcher) {
        watcher = watcherBuilder({
            path: options.levels.concat([ options.viewsDir ]),
            onChange: function(filename) {
                log(`FS change event ${filename} => invalidate cache`);
                goodCache = { };
            } }
        );
    }

    return function(localOptions) {
        localOptions = _.assign({ }, options, localOptions);

        return buildBundle(localOptions);
    }
};


function buildBundle(opts) {

    var curConfHash = genIdx(opts.levels, opts.viewsDir, opts.bundleDir, opts.staticDir, opts.bundleName);

    if (goodCache[curConfHash])
        return Promise.resolve(goodCache[curConfHash]);

    waiters++;
    return (promiseChain = (waiters === 1) ? doBuildBundle() : promiseChain.then(doBuildBundle));

    function doBuildBundle() {

        if (goodCache[curConfHash])
            return Promise.resolve(goodCache[curConfHash]);

        return fileEval(path.join(opts.viewsDir, opts.bundleName + '.bemdecl.js'))
            .then(decl => new Promise((resolve, reject) => {
                try {
                    log('decl', decl);

                    let streamsFinished = 0;
                    let techList = Object.keys(opts.techMap);
                    let totalStreamsCount = techList.length;
                    let buildResult = techList.reduce((res, techName) => {
                        res[techName] = [];
                        return res;
                    }, {});

                    techList.forEach(tech => {
                        let target = ((tech === 'bemhtml') || (tech === 'bemtree'))
                            ? { dst: opts.bundleDir, name: `${opts.bundleName}.${tech}.js` }     // .enb/tmp/bundles/index/index.bemhtml.js
                            : { dst: opts.staticDir, name: `${opts.bundleName}.min.${tech}` };   // static/index.min.css
                        target.fullName = path.join(target.dst, target.name);

                        let stream = bemSrc(opts.levels, decl.blocks, tech,
                            {
                                read: true,
                                techMap: opts.techMap
                            }
                        );

                        stLog(tech,  stream);

                        let outputStream = (opts.pipelines[tech] ? opts.pipelines[tech](stream) : stream)
                            .pipe(concat(target.name))
                            .pipe(rename(function(file) {
                                file.dirname = file.extname = '';
                                file.basename = target.name;
                            }))
                            .pipe(gulp.dest(target.dst));

                        stLog(`${tech} => `, outputStream);

                        outputStream.on('data', (file)=>{
                            buildResult[tech].push(file);
                        });
                        outputStream.on('finish', () => {
                            if (~buildResult[tech].indexOf(target.fullName)) {
                                removeIfExists(target.fullName);
                            }
                            if (++streamsFinished === totalStreamsCount) {
                                goodCache[curConfHash] = buildResult;
                                waiters--;
                                resolve(buildResult);
                            }
                        });

                    });

                } catch (e) {
                    console.log('e', e, e.stack);
                    waiters--;
                    reject(e);
                }
            })
        )
    }
}


function removeIfExists(fileName) {
    fs.access(fileName)
        .then(()=>{
            log('Empty output => cleaning cache file', fileName);
            return fs.unlink(fileName);
        }).catch(()=>{})
}
