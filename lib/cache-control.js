'use strict';

module.exports = (itemBuilder, hashFunction) => {
    hashFunction || (hashFunction = (...args) => require('crypto').createHash('md5')
        .update(JSON.stringify(args)).digest('hex'));
    let cache = {};
    let buildChain = Promise.resolve();
    return {
        get(data) {
            const hash = hashFunction(data);

            if (cache.hasOwnProperty(hash)) return Promise.resolve(cache[hash]);

            const resultBuildItem = buildChain
                .then(() => itemBuilder(data))
                .then(result => {
                    cache[hash] = result;

                    return result;
                });

            buildChain = resultBuildItem;

            return resultBuildItem;
        },

        invalidate() {
            cache = {};
        }
    };
};
