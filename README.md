# dsh-own-plugins

Own-built DSH plugins (DeepSeek Harness) — replacement for third-party
plugins that broke with DSH 0.1.0-rc.6. Zero runtime dependencies, node
builtins only, unit-tested.

| Package | Replaces | Tools |
|---|---|---|
| `dsh-gitkit` | dsh-plugin-git-workflow | git_status / git_diff / git_log / git_commit / git_branch |
| `dsh-snapshot` | dsh-backup | snapshot_backup / snapshot_list / snapshot_restore |
| `dsh-plugin-doctor` | dsh-plugin-vetting | doctor_scan / doctor_scan_path |

## Install

```
dsh plugin --profile web add file:~/dsh-own-plugins/dsh-gitkit
dsh plugin --profile web add file:~/dsh-own-plugins/dsh-snapshot
dsh plugin --profile web add file:~/dsh-own-plugins/dsh-plugin-doctor
```

## Test

```
node --test dsh-gitkit/test/ dsh-snapshot/test/ dsh-plugin-doctor/test/
```

## License

MIT
