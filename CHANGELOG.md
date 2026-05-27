# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.3.0](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.2.2...v1.3.0) (2026-05-27)

### [1.2.2](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.2.1...v1.2.2) (2026-05-26)


### Bug Fixes

* add error logging for self-update failures ([2c699ad](https://github.com/NoNameCanUse9/quadlet_manager/commit/2c699ad1db90be9059c728be27392485213b5dd1))
* SelfUpdate timeout too short and improve error messages ([72d4414](https://github.com/NoNameCanUse9/quadlet_manager/commit/72d4414873db1c0f71a312e76f583bb0db003423))

### [1.2.1](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.2.0...v1.2.1) (2026-05-26)


### Bug Fixes

* ListImages null RepoTags causing frontend crash ([db4b46b](https://github.com/NoNameCanUse9/quadlet_manager/commit/db4b46ba36553d548b61e8ef18b96bd5a4cd22a4))


### Documentation

* update CLAUDE.md with self-update feature ([fe71167](https://github.com/NoNameCanUse9/quadlet_manager/commit/fe71167954dd9e899b19fac2e8385ec818bfafef))
* update provider and WebSocket documentation ([aeed1fa](https://github.com/NoNameCanUse9/quadlet_manager/commit/aeed1faed58e15e04bf1acc6338d85b1ef5903f4))

## [1.2.0](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.1.1...v1.2.0) (2026-05-22)


### Features

* OTA self-update — download, verify, replace binary and restart ([2f7348c](https://github.com/NoNameCanUse9/quadlet_manager/commit/2f7348cd4b1363a93f97aff94cdd4e003382c297))

### [1.1.1](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.1.0...v1.1.1) (2026-05-22)

## [1.1.0](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.0.4...v1.1.0) (2026-05-22)


### Features

* support GITHUB_TOKEN env var for API authentication ([c21e8eb](https://github.com/NoNameCanUse9/quadlet_manager/commit/c21e8eb791be1027067b8a8ad83aadda94b3d972))


### Bug Fixes

* add missing title attributes to icon-only buttons ([8666114](https://github.com/NoNameCanUse9/quadlet_manager/commit/8666114727af958309508e8b2190f8fd40ae181d))
* add title to FileEditDialog close button + i18n 'close' key ([ace1314](https://github.com/NoNameCanUse9/quadlet_manager/commit/ace1314a40c49ae4e2fc64e198a660343fe0baa5))
* ListVolumes JSON unmarshal error ([107a32c](https://github.com/NoNameCanUse9/quadlet_manager/commit/107a32cfbb3588659d6a83f1cac99e599221be8e))
* update check returns 502 when GitHub API unavailable ([de934b9](https://github.com/NoNameCanUse9/quadlet_manager/commit/de934b9c540f5edd61263804b6b538eafd0c3678))


### CI/CD

* use CHANGELOG.md as release body instead of auto-generated notes ([19c8d41](https://github.com/NoNameCanUse9/quadlet_manager/commit/19c8d41d7890d713f08690c6f65f86135ea6063d))

### [1.0.4](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.0.3...v1.0.4) (2026-05-22)

### [1.0.3](https://github.com/NoNameCanUse9/quadlet_manager/compare/v1.0.2...v1.0.3) (2026-05-22)


### Bug Fixes

* correct GitHub repo path for update checker ([980c13b](https://github.com/NoNameCanUse9/quadlet_manager/commit/980c13b195a6d11280d597b144a6b8a803ec25cb))
* exec WebSocket also needs dynamic origin check ([c61aa77](https://github.com/NoNameCanUse9/quadlet_manager/commit/c61aa7712e93127a849f54fe826bb8a56f9e619b))
* WebSocket CheckOrigin rejects non-localhost connections ([2e3e341](https://github.com/NoNameCanUse9/quadlet_manager/commit/2e3e341c37e81085a0e708a336fcb1bf10a98d87))
