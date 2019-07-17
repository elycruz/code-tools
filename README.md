# code-tools
A cli tool for running common code tasks on code/repos and the like ('release', 'release-candidate', 'bump' commands etc.).

## Installation:
Two ways to install:

### Development way:
1.  Clone repo: `git clone git@github.com:elycruz/code-tools.git`.
2.  Run `npm install` or `yarn install` in repo's root. 
3.  Run `npm link` or `yarn link` from repo's root.

### Automatic way:
`npm i elycruz/code-tools -g` or
`yarn global elycruz/code-tools`

## Usage
```
$ code-tools --help    # For help
$ code-tools -h        # ""
$ code-tools [command] [...args] # For command see below

# Pertinent examples:
# Note: for `rc`, and `bump` commands make sure your branch is clean before running (as 
#  you don't want to miss any changes in your created release branch.

# Example 1:
# - Checkout 'develop' branch.
# - Bump package.json version up on the 'patch' position.
# - Use updated semver from package.json for other semver operations.
# - Create release candidate branch, commit changes, and tag changes.
$ code-tools rc -b develop --package-json=./some_dir/package.json

# Example 2:
# - Checkout 'develop' branch,
# - Bump package.json version up on 'patch' position. 
# - ""
# - Create rc branch, create rc commit, tag commit.
# - Push changes to 'origin':
$ code-tools rc -b develop --package-json=./some_dir/package.json --auto-push-remote=origin

# Example 3:  Same as example 2 (except specifying `--semver-part=minor` which is the default).
$ code-tools rc -b develop \
--package-json=./some_dir/package.json \
--auto-push-remote=origin \
--semver-part=minor

# Example 4:
# - Bump version in './VERSION' file
# - ""
# - Create bump commit, tag commit.
$ code-tools bump -b develop --version-file=./VERSION

# Example 5:
# - Same as "Example 4" except we are also pushing changes to 'origin'
#   and we are also bumping up the version in 'package.json' file.
$ code-tools bump \
--version-file=./VERSION \
--package-json=./some_dir/package.json \
--auto-push-remote=origin 

# Using `--semver` flag - 
# Bump package.json to version `13.3.3`, create rc commit, tag commit,
#   push rc branch and tags to 'origin'.
#   @note `semver` flag also works for `rc` command.
$ code-tools bump -p=./some_dir/package.json --semver 13.3.3 --auto-push-remote=origin

# Using latest tag from `git tag` -
# (using shorthand of `--auto-push-remote`
# ----
# Via `bump` command:
$ code-tools bump --from-branch=develop --remote=origin

# Via `rc` command:
$ code-tools rc --from-branch=develop --remote=origin
```

### Commands

#### `release|rc [options]` - 
Creates a release candidate branch from given branch `-b`/`--from-branch=[develop]`.
Newly created branch gets tagged (`git tag`) properly and gets the newly created tag affixed to the front
of it's suffix (`[--rc-branch-suffix=_Release_Candidate]`).

**Note:** Prerelease part from semver (anything after the patch part) gets dropped in tagging and tag bumping.
 
##### Args:
- `-b, --from-branch` - Branch to create release candidate branch and rc tag from.  Default 'develop'.
- `-p, --package-json` - File path to 'package.json' file whose "version" you want to update (if any).
- `-v, --version-file` - File path to semantic 'VERSION' file to use/update (if any).
- `-s, --semver-part` - Part of semantic version you want to upgrade (`[major, minor, patch]`); E.g.,
  part of `MAJOR.MINOR.PATCH` which you would like to bump up.  Default 'patch'.
- `--rc-branch-suffix="_Release_Candidate"` - Suffix to use for creating release candidate branch.  Default `_Release_Candidate`.
- `--auto-push-remote, --remote` - Remote to push changes to.  If set commits and tagging are pushed
  to whatever your default remote is and created 'rc-branch' is pushed to given remote.
- `--semver` - Semantic version to use. Used when you want to cut a release branch
  to a specific version explicitly  (overrides `--package-json`, 
  `--version-file` and `git tag ...` semver lookups).
- `--debug` - For outputting debug information.
- `--verbose` - For showing log messages for each action taken.

#### `bump [options]`
Bumps the tag version of the latest commit in branch upwards, updates package.json file if specified, updates
version file (`--version-file`/`-v`) if specified.

**Note:** Prerelease part from semver (anything after the patch part) gets dropped in tagging and tag bumping.

##### Args:
- `-b, --from-branch` - Branch to create release candidate branch and rc tag from.
- `-p, --package-json` - File path to 'package.json' file whose "version" you want to use/update (if any).
- `-v, --version-file` - File path to semantic 'VERSION' file to use/update (if any).
- `-s, --semver-part` - Part of semantic version you want to upgrade (`[major, minor, patch]`); E.g.,
  part of `MAJOR.MINOR.PATCH` which you would like to bump up.
- `--auto-push-remote, --remote` - Remote to push changes to.  If set commits and tagging are pushed
  to default remote (remote set in your system).
- `--semver` - Semantic version to use explicitly (overrides `--package-json`, 
  `--version-file` and `git tag ...` semver lookups).
- `--debug` - For outputting debug information.
- `--verbose` - For showing log messages for each action taken.
  
### Caveats 

#### Note about `release` and `bump` commands:
- When fetching the semver version to utilize in these commands we check four different places (in the following order):
  - `--semver` value.
  - `--version-file`/`-v` - We expected a single line with/without a new line character at the end (If file does'nt exist 
    we create if param is specified with a path).
  - `--package-json`/`-p` - If a malformed file is specified will throw error (we aren't currently checking for correct format).
    @todo fix this
  - `git tag` - Git tag list filtered to the designated format (tags get sorted properly using charCode totals to ensure
    we get the greatest tag to increase from).
- When running `bump` and/or `release` command with `--auto-push-remote` option and no `--version-file` and/or `--package-json` option
  No 'change' commit is made however latest commit in branch is tagged with said tag and tag is then pushed via `git push --tag ...`.
  
## Mvp Todos:
- [X] - Ability to change the remote that 'release' command pushes release branch for (currently hard coded to 'origin').

## Wish-list
- [ ] - Ability to have a dot file ('.code-tools' etc.) somewhere in 'repo-to-manipulate' that could have some meta-data/options 
  that could be used by 'code-tools' tool.
- [ ] - '--dry-run' option (for quick-testing dry-running operations).
- [ ] - Cleanup messages to be simpler/shorter - There are some long messages and some un-required (which should
    probably only be shown in 'verbose' mode) in the log output
    they should be shorter.
    
## License
MIT
