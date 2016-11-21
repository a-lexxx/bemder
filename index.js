
const path = require('path'),
	enbMake = require('./enb');

const debug = false;
function _d(){
	if (debug)
		console.log.apply(console, arguments);
}
// watchThemAll();

// globalLevel, config
// var plugin = require('cool-bem-ololo')({
// 	blah: 123
// });

// https://www.npmjs.com/package/clear-require
// https://github.com/nodules/file-eval

var buildDir = path.join(process.cwd(), '.enb/tmp/build' );


module.exports.render = function(name, options, calabock){
	var view, waiter = [],
		vname = path.dirname(name),
		base = path.basename(name).replace(/\.bem(html|tree|decl)\.js/i, ''),
		bhtmlFile = path.join(buildDir, base + '.bemhtml.js'),
		btreeFile = path.join(buildDir, base + '.bemtree.js'),
		bemjson, html, decl;

	_d( 'name', name, base, vname, btreeFile);

	enbMake({bundleName: base, levels: ['blocks'], buildDir})
		.then( (cdecl) => {
			decl = cdecl;

			var rootRender = options.enbRoot ? options.enbRoot :
				( ( decl && decl[0] && decl[0].block) ? decl[0].block : 'root');

			delete require.cache[ btreeFile ];
			var bTree = require( btreeFile );

			if (bTree.BEMTREE) bTree = bTree.BEMTREE;
			bemjson = bTree.apply({
				block: rootRender,
				data: options
			});
		}).catch(e => {
			if ((e.code === 'MODULE_NOT_FOUND') || (e.syscall === 'open') ) {
						// мы тут, если файла bemtree нe существует
				bemjson = decl;
			} else throw e;					// всё остальное пробрасываем дальше
		}).then(()=>{
			_d( 'bemjson', JSON.stringify(bemjson, null, 2) );

			delete require.cache[ bhtmlFile ];
			var bHtml = require( bhtmlFile );
			var bTree;
			if (bHtml.BEMHTML) bTree = bHtml.BEMHTML;

			html = bHtml.apply(bemjson);

		}).catch((e)=>{
			if ((e.code === 'MODULE_NOT_FOUND') || (e.syscall === 'open')) {
						// мы тут, если файла bemhtml нe существует
				html = bemjson;
			} else throw e;					// всё остальное пробрасываем дальше
		}).then(()=>{
			_d( 'html:\n', html );
			calabock(null, html);
		})
		.catch( e => {
			calabock(e, null);
		});
};


