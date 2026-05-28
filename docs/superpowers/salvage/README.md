# Salvaged worktree WIP (2026-05-28)

During an environment cleanup, two `.claude/worktrees/` held **uncommitted** feature
work built on an **older** master (`a0f4ece`). Their committed branches were already
fully merged (`ahead=0`), but the uncommitted bits touched files
(`LabBridgeStrip.tsx`, `TopBar.tsx`, `RegressionTrackerView.tsx`) that the newer
main-tree WIP **also** changed — so a blind merge would have reconciled two divergent
unverified versions. Rather than risk that, the uncommitted work was captured here as
patches and the worktrees removed.

| Patch | Feature | Notes |
|-------|---------|-------|
| `groovy-kindling-crown.patch` | Bridge **reconnect indicator** (`ReconnectIndicator.tsx` + test, reconnect logic in `usePofBridge`/`connection-manager`/`pofBridgeStore`/`pof-bridge` types, wired into `LabBridgeStrip`/`TopBar`) | The store/hook/types were clean in main; only `LabBridgeStrip`/`TopBar` conflict with newer WIP. |
| `memoized-rolling-quail.patch` | `RegressionTrackerView` change + test | `RegressionTrackerView.tsx` diverges from the newer main-tree version. |

## Apply (against current master, expect conflicts in the noted files)

```bash
git apply --3way docs/superpowers/salvage/groovy-kindling-crown.patch
# resolve conflicts in LabBridgeStrip.tsx / TopBar.tsx, then verify the bridge UI
```

These features are **not** on master — they need manual reconciliation against the
current code before landing.
