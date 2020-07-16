const exec = require('child_process').exec;


const colors = require('colors');
const compareVersion = require('compare-versions');
const debugInstalledPackage = require('debug')('debugInstalledPackage');
const npmCheck = require('npm-check');
const path = require('path');
const packageJson = require('package-json');
const branchName = require('current-git-branch');
const isInstalled = require('./isInstalled');
const findModulePath = require('./find-module-path');
const readPackageJson = require('./read-package-json');
const pathExists = require('path-exists');

async function getTagVersion(packageName, tag) {
	let res = await packageJson(packageName, {fullMetadata: true, allVersions: true});
	return res['dist-tags'][tag];

	// return null;
}
async function getPackageJsonList(packageList, opts) {
	let list = packageList.map(item => {
		return packageJson(item, {fullMetadata: true, allVersions: true})

	});
	let result = await Promise.all(list);
	return result.map(item => {
		item.isInstalled = isInstalled(item.name);
		if (item.isInstalled) {
			let modulePath = findModulePath(item.name, opts.cwd);
			item.installedModulePackageJson = readPackageJson(path.join(modulePath, 'package.json'));
			item.installedVersion=item.installedModulePackageJson.version
		}
		return item
	})
}

// const promat = require('prompt');
//验证包版本
module.exports = async function(opts = {}) {

	opts = Object.assign({
		cwd: process.cwd(),
		pkgPath: path.resolve(process.cwd(), 'package.json'),
		updateToSpecailTag: null,
		update: true,
		currentBranch: branchName(),
		gitBranchVersion: {
			"zkt_trunk": 'beta'
		}
	}, opts);

	let checkGitVersion = opts.gitBranchVersion[opts.currentBranch];
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
	let currentState = await getPackageJsonList(opts.checkModulesVersion.include)

	// let npmCheckConfig = {}
	// let checkModules = Object.assign({}, pkg.devDependencies, pkg.dependencies);
	// let checkModuleArray = Object.keys(checkModules);
	// if (opts.checkModulesVersion && opts.checkModulesVersion.include) {
	// 	let inc = opts.checkModulesVersion.include;
	// 	if (Array.isArray(inc) && inc.length > 0) {
	// 		npmCheckConfig.ignore = checkModuleArray.filter(item => {
	// 			return opts.checkModulesVersion.include.indexOf(item) === -1;
	// 		})
	// 	}
	// }

// // let checkModules = ['zhida-koa-utils', 'zkt-polyfill'];
// 	let currentState = {}
// 	await npmCheck(npmCheckConfig).then(states => {
//
// 			states.get('packages').forEach((item) => {
// 				if (opts.checkModulesVersion.include.indexOf(item.moduleName) !== -1) {
// 					currentState[item.moduleName] = item
// 				}
// 			});
//
// 		}
// 	)

	if (currentState) {

		for (var item in currentState) {
			let currentPackage = currentState[item];
			if (currentPackage) {

				let installedVersion = currentPackage.isInstalled ? currentPackage.installed : null;
				let latestVersion = currentPackage.latest;
				let packageVersion = currentPackage.packageJson || currentPackage.installed;
				let tagVersion = await getTagVersion(item, checkGitVersion)
				let unInstallVersion = getNeedVersion(packageVersion, installedVersion, latestVersion, tagVersion, currentPackage.isInstalled);


				if (unInstallVersion) {

					installList[item] = unInstallVersion;
					console.log('----------包:', item, colors.green(` ----------当前分支:` + opts.currentBranch), ' and 对应tag:', colors.cyan(checkGitVersion));
					if (tagVersion) {
						if (compareVersion(tagVersion, latestVersion) > 0) {
							console.log(colors.blue(` @latest<${latestVersion}>版本 <  tag:[${checkGitVersion}]版本：${tagVersion}`));
						}

						console.log(colors.red(` ${item}已安装版本：${colors.blue(installedVersion)} vs package中版本：${colors.blue(packageVersion)} vs 最新版本 ${item + '@latest: ' + colors.blue(latestVersion)} vs tag:[${colors.blue(checkGitVersion)}]版本：${colors.blue(tagVersion)} 不一致`));

						console.log(colors.red(` 如果配置文件中版本<${packageVersion}> 小于 @latest<${latestVersion}>版本或 tag:[${checkGitVersion}]版本<${tagVersion}>，则安装 @latest<${latestVersion}>版本>和 tag:[${checkGitVersion}]版本：${packageVersion}中，${colors.yellow('较大的版本')}`));
						console.log(colors.red(` 如果配置文件中版本<${packageVersion}> 大于 @latest<${latestVersion}>版本和 tag:[${checkGitVersion}]版本<${tagVersion}>，则安装 配置文件中版本<${packageVersion}>`));

					} else {
						console.log(colors.red(` ${item}已安装版本：${colors.blue(installedVersion)} vs package中版本：${colors.blue(packageVersion)} vs 最新版本 ${item + '@latest: ' + colors.blue(latestVersion)}不一致`));
						console.log(colors.red(` 如果配置文件中版本<${colors.blue(packageVersion)}> 小于 @latest<${colors.blue(latestVersion)}>版本，则安装 @latest<${colors.blue(latestVersion)}>版本，并更新配置文件版本为<${colors.blue(latestVersion)}>`));
						console.log(colors.red(` 如果配置文件中版本<${colors.blue(packageVersion)}> 大于 @latest<${latestVersion}>版本，则安装 配置文件中版本<${colors.blue(packageVersion)}>`));
					}


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
	} else {
		return opts.callback && opts.callback();

	}


}

function getNeedVersion(packageVersion, installedVersion, latestVersion, tagVersion) {
	packageVersion = packageVersion && packageVersion.replace(/^(\^|\~)/, '');
	installedVersion = installedVersion && installedVersion.replace(/^(\^|\~)/, '');
	latestVersion = latestVersion && latestVersion.replace(/^(\^|\~)/, '');
	tagVersion = tagVersion && tagVersion.replace(/^(\^|\~)/, '');
	let needVersion = packageVersion;
	if (tagVersion) {
		needVersion = compareVersion(latestVersion, tagVersion) > 0 ? latestVersion : tagVersion;
		needVersion = compareVersion(needVersion, packageVersion) > 0 ? needVersion : packageVersion;

	} else {
		needVersion = compareVersion(latestVersion, packageVersion) > 0 ? latestVersion : packageVersion;
	}


	//如果未安装包或者已安装包的版本不等于实际需要安装包的版本，则安装实际需要的包的版本
	if (!installedVersion || compareVersion(installedVersion, packageVersion) !== 0 || compareVersion(needVersion, installedVersion) !== 0) {
		return needVersion
	}
	return null;
}

