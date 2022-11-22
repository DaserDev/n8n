const path = require('path');
const glob = require('fast-glob');
const { createContext, Script } = require('vm');
const { LoggerProxy } = require('n8n-workflow');
const { packageDir, writeJSON } = require('./common');

LoggerProxy.init({
	log: console.log.bind(console),
	warn: console.warn.bind(console),
});

const context = Object.freeze(createContext({ require }));
const loadClass = (sourcePath) => {
	try {
		const [className] = path.parse(sourcePath).name.split('.');
		const absolutePath = path.resolve(packageDir, sourcePath);
		const script = new Script(`new (require('${absolutePath}').${className})()`);
		const instance = script.runInContext(context);
		return { instance, sourcePath, className };
	} catch (e) {
		LoggerProxy.warn('Failed to load %s: %s', sourcePath, e.message);
	}
};

const generate = (kind) => {
	const data = glob
		.sync(`dist/${kind}/**/*.${kind === 'nodes' ? 'node' : kind}.js`, {
			cwd: packageDir,
		})
		.filter((filePath) => !/[vV]\d.node\.js$/.test(filePath))
		.map(loadClass)
		.filter((data) => !!data)
		.reduce((obj, { className, sourcePath, instance }) => {
			const name = kind === 'nodes' ? instance.description.name : instance.name;
			if (name in obj) console.error('already loaded', kind, name, sourcePath);
			else obj[name] = { className, sourcePath };
			return obj;
		}, {});
	LoggerProxy.info(`Detected ${Object.keys(data).length} ${kind}`);
	return writeJSON(`known/${kind}.json`, data);
};

(async () => {
	await Promise.all([generate('credentials'), generate('nodes')]);
})();
