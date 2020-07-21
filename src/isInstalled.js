module.exports = function(pkgName) {
	try {
		require.resolve(pkgName)
		return true
	} catch {
		return false
	}
}
