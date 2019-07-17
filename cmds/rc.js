const {log} = require('../utils/console'),

  {releaseAction, sharedActionParamsCfg} = require('../modules/git-actions/git-actions');

module.exports = {
  command: 'rc',
  describe: 'Alias for `release` command.  ' +
    'Bumps tag of branch (or creates a new one), optionally ' +
    'bumps version in package.json and/or VERSION file (if passed in), ' +
    'creates rc branch, creates a commit for any changes if any, ' +
    'then pushes created branch and tags to passed in remote.',
  builder: sharedActionParamsCfg,
  handler: async argv => {
    if (argv.debug) {
      log('Parsed `argv`:\n', argv);
    }
    return await releaseAction(argv)
  }
};
