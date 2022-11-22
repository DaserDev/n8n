const { LoggerProxy, NodeHelpers } = require('n8n-workflow');
const { PackageDirectoryLoader } = require('n8n-core');
const { packageDir, writeJSON } = require('./common');

LoggerProxy.init({
	log: console.log.bind(console),
	warn: console.warn.bind(console),
});

(async () => {
	const loader = new PackageDirectoryLoader(packageDir);
	await loader.loadAll();

	const credentialTypes = Object.values(loader.credentialTypes).map((data) => data.type);

	const nodeTypes = Object.values(loader.nodeTypes)
		.map((data) => data.type)
		.flatMap((nodeData) => {
			const allNodeTypes = NodeHelpers.getVersionedNodeTypeAll(nodeData);
			return allNodeTypes.map((element) => element.description);
		});

	await Promise.all([
		writeJSON('types/credentials.json', credentialTypes),
		writeJSON('types/nodes.json', nodeTypes),
	]);
})();
