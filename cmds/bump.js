const {bumpAction, sharedActionParamsCfg} = require('../modules/git-actions/git-actions');

module.exports = {
  command: 'bump',
  describe: 'Bumps tag version of latest tag (starts from 0.1.0 ' +
    'if no existing tags, VERSION file, or package.json file).',
  builder: Object.assign({}, sharedActionParamsCfg),
  handler: async argv => await bumpAction(argv),
};
