const exec = require('child_process').exec;
const colors = require('colors');

const compareVersion = require('compare-versions');
const debugInstalledPackage = require('debug')('debugInstalledPackage');
const npmCheck = require('npm-check');
const path = require('path');
const packageJson = require('package-json');
const semver = require('semver');
const findModulePath = require('./find-module-path');
const pathExists = require('path-exists');
const readPackageJson = require('./read-package-json');

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
	let includesModules = opts.checkModulesVersion.include;
	if (opts.checkModulesVersion && includesModules) {
		if (Array.isArray(includesModules) && includesModules.length > 0) {
			npmCheckConfig.ignore = checkModuleArray.filter(item => {
				return includesModules.indexOf(item) === -1;
			})
		}
	}

// let checkModules = ['zhida-koa-utils', 'zkt-polyfill'];
	let currentState = {}
	await npmCheck(npmCheckConfig).then(states => {

			states.get('packages').forEach((item) => {
				if (includesModules.indexOf(item.moduleName) !== -1) {
					currentState[item.moduleName] = item
				}
			});

		}
	)
	if (currentState) {
		for (var item in currentState) {
			let currentPackage = currentState[item];
			if (currentPackage) {
				if (currentPackage.regError) {
					console.error('获取包信息出错了：请检查包名和源是否正确：' + currentPackage.regError);
					return;

				}
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

	let tagInstallList = {};
	await asyncForEach(includesModules, async (item) => {

		if (!currentState[item]) {
			var modulePath = findModulePath(item, opts.pkgPath);
			var packageIsInstalled = pathExists.sync(modulePath);
			let installedVersion = '';
			if (packageIsInstalled) {
				var modulePackageJson = readPackageJson(path.join(modulePath, 'package.json'));
				installedVersion = modulePackageJson.version;
				var isPrivate = Boolean(modulePackageJson.private);
				if (isPrivate) {
					return false;
				}

			}
			// Ignore private packages
			let packageVersion = checkModules[item]
			let addTagVersion = await tagVersion(item, packageVersion, installedVersion);
			if (addTagVersion) {
				tagInstallList[item] = packageVersion;
				console.log(colors.green(`--------------------------------${colors.blue('更新tag版本')}-----------------------------------`));
				console.log(`${colors.green(item)}已安装版本：${colors.green(installedVersion)} vs package中版本为${colors.yellow('TAG:' + packageVersion)}，版本号为：${colors.yellow(addTagVersion.unInstallVersion)} vs 最新版本 ${colors.green(item + '@latest: ' + addTagVersion.latestVersion)}`);
				console.log(colors.red(` ！！！！注意：当package.json中的版本号为[tag]时，会始终安装当前[tag]的最新版本，不会更新到[latest]的最新版，请谨慎使用！！！！`));
			}
		}
	})
	if (opts.update) {
		await installPackage(installList)
		await installPackage(tagInstallList, 'tag')
		return opts.callback && opts.callback();
	}
	else {
		return opts.callback && opts.callback();

	}



}

async function installPackage(installList, type = "") {
	let command = `npm i  `, isRun = false;

	if (Object.keys(installList).length !== 0) {
		for (let item in installList) {
			command += ` ${item}@${installList[item]} `;

		}
		console.log(colors.blue(`----------------更新${type}版本：${command}-----------------`));
		return await new Promise(resolve => {
			exec(command + (type === 'tag' && ' --no-save'), function(error, stdout, stderr) {
				console.log(colors.green('更新版本日志：'), stdout);
				if (stderr && stderr.indexOf('npm ERR') !== -1) {
					console.error('更新版本日志:', stderr);
					process.exit();
				}
				resolve(1);
			});
		})


	} else {
		isRun = true;
	}
	return isRun
}

async function asyncForEach(array, callback, stopCallback) {
	for (let index = 0; index < array.length; index++) {
		if (stopCallback && stopCallback()) {
			break;
		}
		await callback(array[index], index, array)
	}
}

async function tagVersion(packageName, packageVersion, installedVersion) {
	let res = await packageJson(packageName, {fullMetadata: true, allVersions: true});
	if (res && res['dist-tags'][packageVersion] && res['dist-tags'][packageVersion] !== installedVersion && installedVersion) {
		return {
			unInstallVersion: res['dist-tags'][packageVersion],
			latestVersion: res['dist-tags']['latest']
		}
	}
	return null;
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

