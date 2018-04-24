const exec = require('child_process').exec;


const compareVersion = require('compare-versions');
const debugInstalledPackage = require('debug')('debugInstalledPackage');
const npmCheck = require('npm-check');
const path = require('path');
// const promat = require('prompt');
//验证包版本
module.exports = async function(opts = {}) {

	opts = Object.assign({
		pkgPath: path.resolve(process.cwd(), 'package.json'),
		updateToSpecailTag: null,
		update: true
	}, opts);

	debugInstalledPackage(opts.pkgPath);
	let pkg;
	try {
		pkg = require(opts.pkgPath);
	} catch (e) {
	}
	if (!pkg) {
		console.error('文件找不到:' + pkgPath);
		process.exit(-1);
	}
	if (pkg.checkModulesVersion && pkg.checkModulesVersion.include) {
		opts = Object.assign({}, pkg.checkModulesVersion, opts);
	}
	let installList = {};

	let npmCheckConfig = {}
	let checkModules = Object.assign({}, pkg.devDependencies, pkg.dependencies);
	let checkModuleArray = Object.keys(checkModules);
	if (opts.checkModulesVersion && opts.checkModulesVersion.include) {
		let inc = opts.checkModulesVersion.include;
		if (Array.isArray(inc) && inc.length > 0) {
			npmCheckConfig.ignore = checkModuleArray.filter(item => {
				return opts.checkModulesVersion.include.indexOf(item) === -1;
			})
		}
	}

// let checkModules = ['zhida-koa-utils', 'zkt-polyfill'];
	let currentState = {}
	await npmCheck(npmCheckConfig).then(states => {

			states.get('packages').forEach((item) => {
				if (opts.checkModulesVersion.include.indexOf(item.moduleName) !== -1) {
					currentState[item.moduleName] = item
				}
			});

		}
	)
	if (currentState) {
		for (var item in currentState) {
			let currentPackage = currentState[item];
			if (currentPackage) {

				let installedVersion = currentPackage.isInstalled ? currentPackage.installed : null;
				let latestVersion = currentPackage.latest;
				let packageVersion = currentPackage.packageJson || currentPackage.installed;
				let unInstallVersion = getNeedVersion(packageVersion, installedVersion, latestVersion, currentPackage.isInstalled);


				if (unInstallVersion) {

					installList[item] = unInstallVersion
					console.log("\x1b[31m", ` ${item}已安装版本：${installedVersion} vs package中版本：${packageVersion} vs 最新版本 ${item + '@latest: ' + latestVersion}不一致`);
					console.log("\x1b[31m", ` 如果配置文件中版本<${packageVersion}> 小于 @latest<${latestVersion}>版本，则安装 @latest<${latestVersion}>版本，并更新配置文件版本为<${latestVersion}>`);
					console.log("\x1b[31m", ` 如果配置文件中版本<${packageVersion}> 大于 @latest<${latestVersion}>版本，则安装 配置文件中版本<${packageVersion}>`);


				}


			}
		}


	}

	if (opts.update) {
		let command = `npm i  `;
		if (Object.keys(installList).length !== 0) {
			for (let item in installList) {
				command += ` ${item}@${installList[item]} `;

			}
			console.log(`更新版本：${command}`);
			exec(command, function(error, stdout, stderr) {
				console.log(stdout);
				console.error(stderr);
				if (stderr && stderr.indexOf('npm ERR') !== -1) {
					process.exit();
				}
				return opts.callback && opts.callback();
			});

		} else {
			return opts.callback && opts.callback();
		}
	}
	else {
		return opts.callback && opts.callback();

	}



}

function getNeedVersion(packageVersion, installedVersion, latestVersion) {
	packageVersion = packageVersion && packageVersion.replace(/^(\^|\~)/, '');
	installedVersion = installedVersion && installedVersion.replace(/^(\^|\~)/, '');
	latestVersion = latestVersion && latestVersion.replace(/^(\^|\~)/, '');

	let needVersion = packageVersion;

	//如果配置中的版本小于最新版本，则配置中的版本设为最新版本
	if (compareVersion(latestVersion, packageVersion) > 0) {
		needVersion = latestVersion;
	}

	//如果未安装包或者已安装包的版本不等于实际需要安装包的版本，则安装实际需要的包的版本
	if (!installedVersion || compareVersion(installedVersion, packageVersion) !== 0 || compareVersion(needVersion, installedVersion) !== 0) {
		return needVersion
	}
	return null;
}

