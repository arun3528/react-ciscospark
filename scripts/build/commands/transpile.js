const {transpile} = require(`../../utils/build`);

module.exports = {
  command: `transpile <packageName> [packagePath]`,
  desc: `Transpile a package with babel`,
  builder: {},
  handler: ({packageName, packagePath}) => {
    if (packageName) {
      if (packagePath) {
        return transpile(packageName, packagePath);
      }
      return transpile(packageName, `./packages/node_modules/@ciscospark/${packageName}`, `es`);
    }
    return false;
  }
};
