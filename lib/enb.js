'use strict';

const _ = require('lodash');
const fs = require('mz/fs');
const path = require('path');
const bemSrc = require('gulp-bem-src');
const fileEval = require('file-eval');

const watcherBuilder = require('./watcher');
const defaultConfig = require('../default-config'); // require('../example1-config');
const pipelines = require('./pipelines');

module.exports = function(params) {

    const log = (!params.debug) ? () => {} : console.log;
    const streamLog = (!params.debug) ? () => {} :
        (description, stream) => stream.on('data', f => log(description, f.path));
    const cacheControl = require('./cache-control')(buildBundle);

    let watcher;

    const globalOptions = buildGlobalOptions(params);

    if (!watcher && !globalOptions.doNotWatchOnChanges) {
        watcher = watcherBuilder({
            path: globalOptions.levels.concat([globalOptions.viewsDir]),
            onChange: function(filename) {
                log(`FS change event ${filename} => invalidate cache`);
                cacheControl.invalidate();
            }
        });
    }

    return localOptions => cacheControl.get(buildLocalOptions(globalOptions, localOptions));

    function buildBundle(opts) {

        return fileEval(path.join(opts.viewsDir, opts.bundleName + '.bemdecl.js'))
            .then(decl => {
                log('decl', decl);

                let techList = Object.keys(opts.techMap);
                let buildResult = techList.reduce((res, techName) => {
                    res[techName] = [];
                    return res;
                }, {});

                return Promise.all(techList.map(tech => new Promise(resolve => {
                    let target = ((tech === 'bemhtml') || (tech === 'bemtree')) ?
                        // .enb/tmp/bundles/index/index.bemhtml.js
                        { dst: opts.bundleDir, name: `${opts.bundleName}.${tech}.js` } :
                        // static/index.min.css
                        { dst: opts.staticDir, name: `${opts.bundleName}.min.${tech}` };

                    target.fullName = path.join(target.dst, target.name);

                    let stream = bemSrc(opts.levels, decl.blocks, tech, {
                        read: true,
                        techMap: opts.techMap
                    });

                    streamLog(tech,  stream);

                    const pipe = opts.pipelines[tech];

                    let outputStream = pipelines[tech](target, (pipe ? pipe(stream) : stream));

                    outputStream.on('data', (file) => {
                        buildResult[tech].push(file);
                    });
                    outputStream.on('finish', () => {
                        const filename = target.fullName;
                        if (~buildResult[tech].indexOf(filename)) {
                            log('Empty output => cleaning cache file', filename);
                            removeIfExists(filename);
                        }

                        resolve(buildResult);
                    });

                    streamLog(`${tech} => `, outputStream);

                })))
                .then(() => buildResult);
            });
    }
};

function removeIfExists(fileName) {
    fs.access(fileName)
        .then(() => fs.unlink(fileName))
        .catch(() => {});
}

function buildLocalOptions(globalOptions, params) {
    return Object.assign({ }, globalOptions, _.omit(params, []));
}

function buildGlobalOptions(params) {
    const options = Object.assign(defaultConfig, _.omit(params, ['techMap', 'pipelines']));

    options.techMap = Object.assign(defaultConfig.techMap, params.techMap);

    options.pipelines = Object.assign(defaultConfig.pipelines, params.pipelines);

    return options;
}
