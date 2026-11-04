# 账号保险库 / Account Vault

![Account Vault](docs/account-vault-cover.png)

[中文](#中文) · [English](#english) · [截图 / Screenshots](docs/screenshots.md)

## 中文

在 DSH 里保存常用账号和密码。支持搜索、密码生成、多套保险库和加密备份，无云同步。

### 安装

1. 下载或克隆仓库，保留本地目录。
2. 请 DSH agent 用 `plugin_manager` 安装该目录，或直接调用工具（不是终端命令）：

   ```json
   {"action":"install_bundle","target":"<account-vault 目录的绝对路径>"}
   ```

3. 按返回提示刷新页面，从侧边栏打开「账号保险库」。

需要支持 bundle 的 Harness、Web Crypto 和 localStorage（通常为 HTTPS 或 localhost）。安装影响当前 profile；Windows JSON 路径中的反斜杠写成 `\\`。

### 开始使用

1. 创建主保险库，设置独立的强密码。
2. 解锁后点击「添加账号」，填写名称、密码等信息并保存。
3. 在列表中搜索、编辑或复制；在设置中修改密码、创建附加库。

默认空闲 5 分钟锁定，离开面板也会锁定。

### 备份与恢复

1. 在设置中导出备份：主库导出全部库，附加库只导出自身。
2. 在主库设置或首次恢复界面导入文件。
3. 选择合并或覆盖：合并只添加不存在的库，不合并账号；**覆盖全部会替换所有本地库**。

覆盖前先备份。忘记密码无法找回；旧备份仍需原密码。

### 注意事项

- 账号使用 PBKDF2-SHA-256 和 AES-256-GCM 加密，存于当前浏览器和来源的 localStorage；库数量等元数据可见。
- 清除站点数据、更换浏览器或来源地址可能丢失数据，请保留备份。
- 附加库不是安全沙箱。同源脚本、扩展或有设备访问权限的 agent 可能获取解锁后的明文；锁定不保证擦除内存或剪贴板历史。
- 未经过独立安全审计，请勿作为唯一的密码保管方案。

[详细说明](docs/guide.md) · [反馈问题](https://github.com/Veagau/dsh-account-vault/issues)

### 开发

```sh
npm run check
npm test
```

回归测试不等于完整 UI 测试或安全审计。请勿在 Issue 中上传真实密码或备份。

## English

Keep everyday accounts and passwords in DSH. Includes search, password generation, multiple vaults and encrypted backups. No cloud sync.

### Install

1. Download or clone the repository and keep the local directory.
2. Ask a DSH agent to install it with `plugin_manager`, or call the tool directly (not a shell command):

   ```json
   {"action":"install_bundle","target":"<absolute path to account-vault>"}
   ```

3. Follow the returned instructions, refresh if needed and open **Account Vault** from the sidebar.

Requires a bundle-capable Harness, Web Crypto and localStorage, usually on HTTPS or localhost. Installation affects the current profile. Escape Windows path backslashes as `\\` in JSON.

### Get started

1. Create a main vault with a strong, unique password.
2. Unlock it, select **Add account**, fill in the entry and save.
3. Search, edit or copy entries from the list. Use Settings to change passwords or create extra vaults.

The default idle lock is 5 minutes. Leaving the panel also locks it.

### Back up and restore

1. Export from Settings: the main vault exports all vaults; extra vaults export only themselves.
2. Import from main-vault Settings or the initial restore screen.
3. Choose merge or replace. Merge adds missing vaults, not individual entries. **Replace all replaces every local vault.**

Back up before replacing. Forgotten passwords cannot be recovered; older backups still need their original passwords.

### Keep in mind

- Entries use PBKDF2-SHA-256 and AES-256-GCM in localStorage for the current browser and origin. Metadata such as vault count remains visible.
- Clearing site data or changing browser or origin can lose data. Keep backups.
- Extra vaults are not security sandboxes. Same-origin scripts, extensions or agents with device access may capture unlocked data. Locking does not guarantee memory or clipboard erasure.
- No independent security audit has been completed. Do not use this as your only password store.

[Full guide](docs/guide.md) · [Report an issue](https://github.com/Veagau/dsh-account-vault/issues)

### Development

```sh
npm run check
npm test
```

Regression tests are not complete UI coverage or a security audit. Never attach real credentials or backups to issues.

## License

[MIT](LICENSE)
