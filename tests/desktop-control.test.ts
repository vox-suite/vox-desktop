import assert from "node:assert/strict";
import { test } from "node:test";
import { DesktopControlStore } from "../src/features/desktop-control/store.ts";
import { applyAppCommand } from "../src/features/desktop-control/commands.ts";
test("changed selection rejects stale command without executing", async () => {
  const store = new DesktopControlStore();
  const revision = store.snapshot().revision;
  store.patch({ page: "spaces", spaceId: "space-1", selectedItemId: "node-1" });
  let executed = false;
  const result = await applyAppCommand(
    {
      commandId: "a",
      expiresAt: "2099-01-01T00:00:00Z",
      expectedRevision: revision,
      action: "update_node",
      arguments: {},
    },
    store,
    async () => {
      executed = true;
      return {};
    },
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "stale_context");
  assert.equal(executed, false);
});
test("duplicate command returns original result without repeating mutation", async () => {
  const store = new DesktopControlStore();
  let calls = 0;
  const command = {
    commandId: "b",
    expiresAt: "2099-01-01T00:00:00Z",
    expectedRevision: null,
    action: "create_space",
    arguments: { intent: "Trip" },
  };
  const execute = async () => {
    calls++;
    return { spaceId: "created" };
  };
  const [a, b] = await Promise.all([
    applyAppCommand(command, store, execute),
    applyAppCommand(command, store, execute),
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(calls, 1);
});
test("expired or unknown commands never execute", async () => {
  const store = new DesktopControlStore();
  let calls = 0;
  const execute = async () => {
    calls++;
    return {};
  };
  assert.equal(
    (
      await applyAppCommand(
        {
          commandId: "c",
          expiresAt: "2000-01-01",
          expectedRevision: null,
          action: "navigate",
          arguments: {},
        },
        store,
        execute,
      )
    ).error,
    "expired",
  );
  assert.equal(
    (
      await applyAppCommand(
        {
          commandId: "d",
          expiresAt: "2099-01-01",
          expectedRevision: null,
          action: "run_command",
          arguments: {},
        },
        store,
        execute,
      )
    ).error,
    "unsupported",
  );
  assert.equal(calls, 0);
});
test('sign-out clears resource context from the previous account',()=>{
 const store=new DesktopControlStore();store.patch({resourceDetails:{title:'Private trip'},spaceId:'old-space'});
 store.reset();assert.equal(store.snapshot().resourceDetails,undefined);assert.equal(store.snapshot().spaceId,null);
});
