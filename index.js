'use strict';

const _ = require('lodash');
const path = require('path');
const enb = require('./enb');
const fileEval = require('file-eval');
const emptyBemhtml = require('bem-xjst').bemhtml.compile('');
const nodeEval = require('node-eval');


const defaultBundleDir = path.join(process.cwd(), '.enb/tmp/bundles');

// tests
// readme english

function onErrorNoExistent(defValue) {
    return function(err) {
        if ((err.code === 'ENOENT') || (err.syscall === 'open')) {
            return defValue;
        } else throw err;
    }
}

module.exports = function(opts) {
    let enbMake = enb(opts);

    return function render(name, options, callback) {
        var log = (options && options.debug) ? console.log.bind(console) : function() {},
            bundleName = path.basename(name).replace(/\.bem(html|tree|decl)\.js/i, ''),
            bundleDir = path.join(defaultBundleDir, bundleName)

        log('name', name, bundleName, path.dirname(name), options);

        enbMake(_.assign({}, options, { bundleName, bundleDir }))
            .then(res => {
                if (res.bemhtml.length) log('Bemh', res.bemhtml[0].path, nodeEval(res.bemhtml[0].contents.toString()));
                return Promise.all([
                    fileEval(path.join(bundleDir, bundleName + '.bemtree.js'))
                        .then(res => res.BEMTREE ? res.BEMTREE : res)
                        .catch(onErrorNoExistent(null)),
                    fileEval(path.join(bundleDir, bundleName + '.bemhtml.js'))
                        .then(res => res.BEMHTML ? res.BEMHTML : res)
                        .catch(onErrorNoExistent(emptyBemhtml))
                ])
            })
            .then(bemParts => {
                log('Loaded from enb: ', bemParts);
                                                        // if there is no bemtree fallback to bemjson
                let bemjson = bemParts[0] ? bemParts[0].apply(options) : options.bemjson;
                log('bemjson', JSON.stringify(bemjson, null, 2));

                let html = bemParts[1].apply(bemjson);
                log('html:\n', html);

                callback(null, html);
            })
            .catch(e => {
                callback(e, null);
            });
    };
}

