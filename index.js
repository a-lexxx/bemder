'use strict';

const _ = require('lodash');
const path = require('path');
const fileEval = require('file-eval');
const emptyBemhtml = require('bem-xjst').bemhtml.compile('');

const enb = require('./lib/enb');

const defaultBundleDir = path.join(process.cwd(), '.enb/tmp/bundles');

// tests
// readme english

function onErrorNoExistent(defValue) {
    return function(err) {
        if ((err.code === 'ENOENT') || (err.syscall === 'open')) {
            return defValue;
        } else {
            throw err;
        }
    };
}

module.exports = function(opts) {
    const enbMake = enb(opts);

    return function render(name, options, callback) {
        const log = (options && options.debug) ? console.log : () => {};
        const bundleName = path.basename(name).replace(/\.bem(html|tree|decl)\.js/i, '');
        const bundleDir = path.join(defaultBundleDir, bundleName);

        log('name', name, bundleName, path.dirname(name), options);

        enbMake(_.assign({}, options, { bundleName, bundleDir }))
            .then(res => {
                res.bemhtml.length && log('Bemh', res.bemhtml[0].path);
                return Promise.all([
                    fileEval(path.join(bundleDir, bundleName + '.bemtree.js'))
                        .then(data => data.BEMTREE ? data.BEMTREE : data)
                        .catch(onErrorNoExistent(null)),
                    fileEval(path.join(bundleDir, bundleName + '.bemhtml.js'))
                        .then(data => data.BEMHTML ? data.BEMHTML : data)
                        .catch(onErrorNoExistent(emptyBemhtml))
                ]);
            })
            .then(bemParts => {
                // if there is no bemtree fallback to bemjson
                const bemjson = bemParts[0] ? bemParts[0].apply(options) : options.bemjson || {};
                log('bemjson', JSON.stringify(bemjson, null, 2));

                const html = bemParts[1].apply(bemjson);
                log('html:\n', html);

                callback(null, html);
            })
            .catch(e => {
                callback(e, null);
            });
    };
};

