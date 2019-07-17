// @todo move validations logic up to router level ('../default/default').
// @todo allow trailing meta info in semver strings; E.g., allow `3.1.3-rc-2018`
// @todo make the creation/usage of `VERSION` file conditional
// @todo add task for 'bump' which also bumps ui_apps package.json file.

const

  chalk = require('chalk'),

  semverLib = require('semver'),

  {SemVer} = semverLib, // for constructing semver strings

  SEMVER_MAJOR = 'major',
  SEMVER_MINOR = 'minor',
  SEMVER_PATCH = 'patch',
  SEMVER_PRE_RELEASE = 'prerelease',

  allowedParts = [SEMVER_MAJOR, SEMVER_MINOR, SEMVER_PATCH, SEMVER_PRE_RELEASE],

  allowedPartsAsStr = allowedParts.join(', '),

  branchPattern = /^[a-z\d\-_]{2,55}$/i,

  {sortStringsByCharCodeTotals} = require('../../utils/string'),

  {log, error} = require('../../utils/console'),

  autoPushRemoteDisabledMsg = 'Skipping `git push ...` (`autoPushRemote` is not set.).',

  {
    gitStatus, gitCheckout, gitTagAsList,
    gitCommit, gitPush, gitTag, gitAdd, gitPull
  } = require('../../utils/gitUtils'),

  {
    ioFileExists, ioReadFile, ioWriteFile, ioPassTailThroughAndContinue
  } = require('../../utils/ioUtils'),

  sharedActionParamsCfg = {
    'from-branch': {
      alias: 'b',
      default: 'develop',
      type: 'string',
      describe: 'Branch to switch to before performing command.'
    },
    'semver-part': {
      alias: 's',
      default: 'patch',
      type: 'string',
      describe: 'Part of semver tag you want to increase ' +
        '(used by "release" and "bump" commands).'
    },
    'package-json': {
      alias: 'p',
      type: 'string',
      describe: 'package.json file to update version in if any ' +
        '(used by "release" and "bump" commands).'
    },
    'semver-file': {
      type: 'string',
      describe: 'File path to version file (if supplied writes new semver to version path ' +
        '(used by "release" and "bump" commands).'
    },
    semver: {
      type: 'string',
      describe: 'Semver to use explicitly for "bump" and/or "release" commands.'
    },
    'rc-branch-suffix': {
      default: '_Release_Candidate',
      type: 'string',
      describe: 'Release candidate branch suffix (used only by "*_release" actions).'
    },
    'auto-push-remote': {
      alias: 'remote',
      type: 'string',
      describe: 'git remote used by `git push` and `git push --tags` commands.  Is also used as boolean' +
        'which indicates whether to perform git pushes (`git push -u {remote}` and `git push --tags`) or not .'
    },
    verbose: {
      type: 'boolean',
      describe: 'Whether to run in "verbose" mode.'
    },
    debug: {
      type: 'boolean',
      describe: 'Flag for outputting debug info.'
    }
  },

  validateActionArgs = (fromBranch, semverPart, semver) => new Promise((resolve, reject) => {
    const [isValidPart] = validateSemverKey(semverPart),
      [isValidBranch] = validateBranchName(fromBranch),
      [isValidSemver, version] = validateSemver(semver);
    if (!isValidPart) {
      reject(`Only one of ${allowedPartsAsStr} allowed for \`semverPart\`.\n`)
    }
    if (!isValidBranch) {
      reject(`Branch doesn't match pattern ${branchPattern.toString()}.\n`)
    }
    if (!!semver && !isValidSemver) {
      reject(`"${semver}" is not a valid semver string.`);
    }
    resolve({semverPart, fromBranch, version});
  }),

  validateSemverKey = xs => {
    const p = (xs + '').toLowerCase();
    return [allowedParts.includes(p), p];
  },

  validateBranchName = xs => {
    const b = xs + '';
    return [branchPattern.test(b), b];
  },

  validateSemver = xs => {
    const x = xs + '',
      validSemver = xs ? semverLib.valid(x) : '';
    return [!!validSemver, validSemver];
  },

  increaseSemverPart = partName => version => {
    switch ((partName + '').toLowerCase()) {
      case SEMVER_MAJOR:
      case SEMVER_MINOR:
      case SEMVER_PATCH:
      case SEMVER_PRE_RELEASE:
        return semverLib.inc(version, partName);
      default:
        throw new Error(`Invalid semantic part name "${partName}".`);
    }
  },

  checkoutBranch = branch => () => {
    log(`Ensuring on branch ${branch}.\n`);
    return gitCheckout(branch).then(log, log);
  },

  getCurrentSemver = (versionFilePath, packageJsonFilePath) => () => {
    log(`Getting current semver:\n`);
    return ioFileExists(versionFilePath)
      .then(getCurrentSemverFromFile(versionFilePath))
      .catch(getCurrentSemverFromPackageJson(packageJsonFilePath))
      .catch(getCurrentSemverFromGit)
      .then(semver => {
        if (!semver) {
          error(`No semver found in \`git tag -l '*.*.*'\` or in ${versionFilePath}.\n`);
          process.exit(1);
        }
        const cleanedSemver = semverLib.clean(semver);
        log(`Found semver "${semver}".\n`);
        return cleanedSemver;
      });
  },

  getCurrentSemverFromFile = filePath => () => {
    return !filePath ? Promise.reject('No file path.') : (
      log(`From version file ...\n`),
        ioReadFile(filePath, {encoding: 'utf8'})
          .then(contents => {
            const [isValidExpectedSemver, semver] = validateSemver(contents.trim());
            if (!isValidExpectedSemver) {
              error(`${semver} is in usable semver format.  ` +
                `See https://semver.org/ for more.\n`);
            }
            return semver;
          })
          .catch(() => log(`Unable to read file ${filePath}.\n`))
    )
  },

  getCurrentSemverFromPackageJson = filePath => () => {
    return !filePath ? Promise.reject('No file path.') : (
      log('From package json file ...\n'),
        ioReadFile(filePath, {encoding: 'utf8'})
          .then(contents => {
            const json = JSON.parse(contents);
            if (!json) {
              error(`Package json file: ${filePath} is empty.  Expected non-empty file.\n`);
            }
            const [isValidExpectedSemver, semver] = validateSemver(json.version.trim());
            if (!isValidExpectedSemver) {
              error(`${semver} is in usable semver format.  ` +
                `See https://semver.org/ for more.\n`);
            }
            return semver;
          })
          .catch(() => log(`Unable to read file ${filePath}.\n`))
    )
  },

  getCurrentSemverFromGit = () => {
    log('From `git tag`...\n');
    return gitTagAsList()
      .then(xs => {
        // Filter for by matching semvers and get the highest one.
        return sortStringsByCharCodeTotals(
          xs.filter(str => {
            const [valid] = validateSemver(str);
            return valid;
          })
        ).shift();
      });
  },

  writeSemverFile = filePath => ([semver, filePaths = []]) => {
    log('Checking "version" file filepath...:', filePath, semver, filePaths);
    if (!semver) {
      throw new Error('writeSemverFile requires a valid semver string.');
    }
    if (!filePath) {
      return Promise.resolve([semver, filePaths]);
    }

    log('Writing semver to file...\n');

    // Make file contents
    const semverLastItem = semver ? semver[semver.length - 1] : '\n',
      fileContents = semverLastItem !== '\n' ? semver + '\n' : semver;

    // Write file
    return ioWriteFile(filePath, fileContents)
      .then(() => {
        log(`semver file written successfully at '${filePath}'.\n`);
        filePaths.push(filePath);
        return [semver, filePath, filePaths];
      })
      .catch(err => {
        log(
          `An error occurred while attempting to write ` +
          `semver file to ${filePath}.  ${err}\n`
        );
        return [semver, '', filePaths];
      })
      .then(([_semver, _filePath, _filePaths]) =>
        _filePath ?
          ioPassTailThroughAndContinue(() => gitAdd(_filePath), _semver, _filePaths) :
          [_semver, _filePaths]
      );
  },

  writePackageJsonFile = filePath => ([semver, filePaths = []]) => {
    if (!filePath) {
      return Promise.resolve([semver, filePaths]);
    }
    return ioFileExists(filePath)
      .then(() => ioReadFile(filePath))
      .then(contents => [contents, JSON.parse(contents)])
      .then(([contents, packageJson]) => {
        log(`Updating ${filePath}.`);
        const txt = contents.toString('utf8'),
          spaceMultiple = txt.match(/\n(\s{2,})/)[1].length;
        log(`Formatting package json file by ${spaceMultiple} spaces.`);
        packageJson.version = semver;
        return [packageJson, spaceMultiple ? spaceMultiple : 2];
      })
      .then(([packageJson, tabSpaces]) => {
        return ioWriteFile(
          filePath,
          JSON.stringify(
            packageJson, null,
            tabSpaces
          )
        )
          .then(() => log(`${filePath} updated successfully.\n`));
      })
      .then(
        () => {
          filePaths.push(filePath);
          return [semver, filePath, filePaths]
        },
        err => {
          log(err);
          return [semver, '', filePaths];
        }
      )
      .then(([_semver, _filePath, _filePaths]) => {
        return _filePath ?
          ioPassTailThroughAndContinue(() => gitAdd(_filePath), _semver, _filePaths) :
          [_semver, _filePaths]
      });
  },

  createBranch = (semver, suffix = '_Example_Release_Candidate') => {
    const branchName = `${semver}${suffix}`;
    return ioPassTailThroughAndContinue(
      () => gitCheckout('-b', branchName), semver, branchName
    )
  },

  tagBranch = ([semver, branch]) => ioPassTailThroughAndContinue(
    () => {
      log(`tagging latest commit in branch ${chalk.cyan(branch)} ` +
        `with: ${chalk.cyan(semver)}\n`);
      return gitTag(semver)
    }, semver, branch
  ),

  pushBranch = ([semver, branch, remote = 'origin']) => ioPassTailThroughAndContinue(
    () => gitPush('-u', remote, branch), semver, branch
  ),

  pushBranchTags = ([semver, branch, remote = 'origin']) =>
    gitPush('-u', remote, '--tags')
      .then(() => [semver, branch]),

  releaseAction = ({
                     fromBranch: branch = 'develop', semverPart: part = SEMVER_PATCH,
                     semverFile = '', packageJson = '', semver: semverStr,
                     autoPushRemote = '', rcBranchSuffix = '_Release_Candidate'
                   }) =>
    new Promise(async () => {
      const {fromBranch, semverPart, version} = await validateActionArgs(branch, part, semverStr),
        isAutoPush = !!autoPushRemote,
        versionFile = semverFile ? semverFile.trim() : '',
        packageJsonFile = packageJson ? packageJson.trim() : ''
      ;
      return gitStatus()
        .then(log)
        .then(checkoutBranch(fromBranch))
        .then(gitPull)
        .then(() => version || getCurrentSemver(versionFile, packageJsonFile)(version))
        .then(semver => version || increaseSemverPart(semverPart)(semver))
        .then(semver => {
          const collectedTouchedFilePaths = [];
          log(`Upgraded semver: ${semver}\n`);
          return [semver, collectedTouchedFilePaths];
        })
        .then(writeSemverFile(versionFile))
        .then(writePackageJsonFile(packageJsonFile))

        // Commit changes
        .then(([semver, touchedFiles]) =>
          touchedFiles.length > 0 ? ioPassTailThroughAndContinue(
            () => gitCommit('-m', `"rc-version - Repo version upgraded to ${semver}."`),
            semver, branch
          ) : [semver, branch]
        )

        // Tag latest commit on rc-branch
        .then(tagBranch)

        // Push commit
        .then(([semver]) => {
          log(chalk.dim('Pushing "tag changes" (to default remote) ...'));
          if (!isAutoPush) {
            log(autoPushRemoteDisabledMsg);
          }
          return ioPassTailThroughAndContinue(
            () => isAutoPush ? gitPush() :
              Promise.resolve([semver]), semver
          );
        })

        // Create rc-branch
        .then(semver => createBranch(semver, rcBranchSuffix))

        // Push rc branch
        .then(([semver, branch]) => {
          log(chalk.dim('Pushing "rc branch" ...'));
          if (!isAutoPush) {
            log(autoPushRemoteDisabledMsg);
          }
          return ioPassTailThroughAndContinue(
            () => isAutoPush ? pushBranch([semver, branch].concat([autoPushRemote])) :
              Promise.resolve([semver, branch]), semver, branch
          )
        })

        // Push tags
        .then(([semver, branch]) => {
          log(chalk.dim('Pushing "tags" ...'));
          const isAutoPush = !!autoPushRemote;
          if (!isAutoPush) {
            log(autoPushRemoteDisabledMsg);
          }
          return ioPassTailThroughAndContinue(
            () => isAutoPush ? pushBranchTags([semver, branch].concat([autoPushRemote])) :
              Promise.resolve([semver, branch]), semver, branch
          )
        })

        // Print success message or error
        .then(([newSemver, pushedBranch]) => {
          log(chalk.green('Command completed successfully.\n'));
          log(chalk.cyan(`Successfully tagged, created, and pushed RC branch;\n` +
            `branch: ${pushedBranch}; tag: ${newSemver};\n`));
          return [newSemver, pushedBranch];
        }, error);
    }),

  bumpAction = ({
                  fromBranch = 'develop', semverPart = SEMVER_PATCH,
                  semverFile = '', packageJson = '', autoPushRemote = '',
                  semver: semverStr
                }) => {
    return new Promise(async () => {
      const {fromBranch: _fromBranch, semverPart: _semverPart, version} =
          await validateActionArgs(fromBranch, semverPart, semverStr),
        versionFile = semverFile ? semverFile.trim() : '',
        packageJsonFile = packageJson ? packageJson.trim() : ''
      ;
      gitStatus()
        .then(log)
        .then(checkoutBranch(_fromBranch))
        .then(gitPull)
        .then(() => !!version ?
          version : getCurrentSemver(versionFile, packageJsonFile)(version)
        )
        .then(increaseSemverPart(_semverPart))

        // Announce new 'semver' and set up file changes tracking
        .then(semver => {
          const collectedTouchedFilePaths = [];
          log(`Upgraded semver: ${semver}\n`);
          return [semver, collectedTouchedFilePaths];
        })

        // Write semvers and get touched files list
        .then(writeSemverFile(versionFile))
        .then(writePackageJsonFile(packageJsonFile))

        // Commit changes
        .then(([semver, touchedFiles]) =>
          touchedFiles.length > 0 ? ioPassTailThroughAndContinue(
            () => gitCommit('-m', `"Version - Bumped version to ${semver}."`), semver, touchedFiles
          ) : [semver, touchedFiles]
        )

        // Tag commit
        .then(([semver, filePaths]) =>
          tagBranch([semver, _fromBranch])
            .then(() => [semver, _fromBranch, filePaths])
        )

        // Push commit
        .then(([semver, branch, filePaths]) => {
          log('Pushing commits (to default remote) ...');
          const isAutoPush = !!autoPushRemote,
            hasFilePaths = !!filePaths.length;
          if (!isAutoPush) {
            log(autoPushRemoteDisabledMsg);
          } else if (!hasFilePaths) {
            log('Nothing to push.  Skipping `git push ...`.')
          }
          return ioPassTailThroughAndContinue(
            () => isAutoPush && hasFilePaths ?
              gitPush() : Promise.resolve([semver, branch]), semver, branch
          )
        })

        // Push tags
        .then(tuple => ioPassTailThroughAndContinue(
          () => !!autoPushRemote ?
            pushBranchTags(tuple.concat([autoPushRemote])) :
            Promise.resolve(tuple), ...tuple
          )
        )

        // Print success message or error
        .then(([semver, taggedBranch]) => {
          log(chalk.green('\n`bump` success.\n'));
          log(chalk.cyan(`Bumped tag for branch ` +
            `${taggedBranch} to ${semver} successfully.\n`));
          return [semver, taggedBranch];
        }, error);
    });
  }
;

module.exports = {
  releaseAction,
  bumpAction,
  sharedActionParamsCfg,
};
