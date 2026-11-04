# 分发与发布 / Distribution and releases

## 安装来源

- 市场收录尚未确认。README 中的市场入口是未来首选，不代表已经上线。
- 当前固定备用地址：<https://github.com/Veagau/dsh-account-vault/releases/download/v2.2.1/dsh-account-vault.tgz>。URL 指向指定 tag，不跟随 `latest`；资产是否存在需以 Release 页面为准。
- Desktop 使用应用内插件管理或当前实例 agent 的 `plugin_manager`，将完整 HTTPS URL 作为 `install_bundle.target`。Web/CLI 必须选中实际运行 Web 的 profile；不要假设 Desktop、CLI 默认 profile 与目标 Web 共用安装目录。先看启动配置和 CLI 帮助，再在目标 profile 安装。安装后以工具返回的 `application`、`warnings` 为准，必要时刷新。
- 本地开发仍可安装仓库绝对路径，链接安装须保留源码目录。
- 不发布 npm；`npm pack` 只是生成供远程安装的 tarball。`private: true` 保持不变，也不新增未经验证的 `engines.dsh` 兼容声明。CI 的 Node 版本不是 Harness 兼容性承诺。

## 维护者：自动打包

工作流：`.github/workflows/release.yml`。本插件直接分发 JavaScript，没有编译产物；构建门禁为 `npm run check`、`npm test`，随后 `npm pack --offline --ignore-scripts`。无需安装依赖、npm token 或 npm publish。打包清单必须包含 manifest、入口、Client、patch、图标及中英文资源。

1. 在准备发布的提交上核对 `package.json` 的版本与运行文件，再创建匹配的 `vX.Y.Z` tag。推送该 tag 将触发工作流。本文不授权或执行提交、推送或发布。
2. 若给既有 tag 补资产，在 GitHub Actions 选择已包含该工作流的分支，手动运行 **Release tgz**，`tag` 填完整既有 tag（如 `v2.2.1`）。**选择的工作流分支只提供工作流定义，打包源码始终检出该 tag，不打包 main。** 因此即使旧 tag 没有工作流也可安全补包。
3. 工作流严格核验包名及 `v${package.version} === tag`，运行检查和测试、核对打包清单；上传前再次获取远端 tag 并确认提交未变。tag 下的检查/测试失败就停止，不回退到 main 修补运行文件。
4. 使用 `contents: write` 与内置 `GITHUB_TOKEN`，只给指定的现有 tag 创建 Release（`--verify-tag`，并用 `--latest=false` 避免补旧版时改变 Latest）；稳定资产名为 `dsh-account-vault.tgz`。**已有同名资产会失败，不覆盖、不删除**；重复运行不是成功的无操作。需要替换时先调查原因，优先发布新版本/tag，不能用不同运行版本冒充旧版。
5. 发布后核对 Release 的 tag、提交与资产，下载安装到测试 profile 验证。CI 测试不是完整 UI 或兼容性验证。固定旧版 README 链接不会自动升级，新版链接应显式审阅更新。

权限不足、受保护 tag、网络错误或资产已存在都会使发布停止。此配置不主动移动 tag，不发布 npm，不更改运行代码或包版本。

## English

Marketplace inclusion is pending confirmation. Use the pinned Release URL above as the fallback, only after its asset exists. Desktop installs the full URL through in-app plugin management or the agent's `plugin_manager`; Web/CLI must use the profile actually serving that Web instance, not an assumed Desktop/default profile. Local absolute-directory installation remains supported.

The Release workflow runs on tag pushes or manual dispatch with an explicit existing tag. Manual execution takes workflow instructions from the selected branch but checks out **only the requested tag's source**, never main as a substitute. The package name and version must match; checks, tests and offline `npm pack` must pass. Required archive files are checked, and the remote tag commit is rechecked immediately before upload. No dependency installation, npm publication or compatibility declaration is added.

The built-in token needs `contents: write`. Releases are created only for a verified existing tag; the stable asset name is `dsh-account-vault.tgz`. Release creation uses `--latest=false` so backfilling an old tag does not change Latest. Existing assets are never overwritten, so reruns fail safely. A broken old tag must not be repaired by uploading a different version from main: investigate and normally release a new version/tag. Verify the downloaded asset in a test profile after publication. This guide and the local changes do not themselves commit, push or publish anything.
