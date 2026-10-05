import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isAllowedExternalUrl } from "../src/platform/external-url-policy.ts";

test("Takeout and supported account authorization links can open", () => {
  for (const url of [
    "https://takeout.google.com/",
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture",
    "https://accounts.spotify.com/authorize?state=fixture",
    "https://mcp.swiggy.com/auth/authorize?state=fixture",
    "https://mcp-server.zomato.com/authorize?state=fixture",
    "https://www.playstation.com",
    "https://ca.account.sony.com/api/v1/ssocookie",
  ])
    assert.equal(isAllowedExternalUrl(url), true, url);
});

test("Untrusted URLs cannot reach the native browser opener", () => {
  for (const url of [
    "https://accounts.spotify.com.evil.test/authorize",
    "http://accounts.spotify.com/authorize",
    "https://user:password@accounts.spotify.com/authorize",
    "https://accounts.spotify.com:444/authorize",
    "https://accounts.spotify.com/authorize#unexpected",
    "https://api.meethue.com/route/api",
    "https://api.meethue.com/v2/oauth2/authorize?state=fixture",
    "https://takeout.google.com/evil",
    "javascript:alert(1)",
    "invalid",
  ])
    assert.equal(isAllowedExternalUrl(url), false, url);
});

test("Native opener capability permits Takeout and provider login endpoints", () => {
  const capability = JSON.parse(
    readFileSync(
      new URL("../src-tauri/capabilities/default.json", import.meta.url),
      "utf8",
    ),
  );
  const entries = capability.permissions
    .find(
      (permission: { identifier?: string }) =>
        permission.identifier === "opener:allow-open-url",
    )
    .allow.map((entry: { url: string }) => entry.url);
  assert.ok(!entries.some((url: string) => url.includes("meethue.com")));
  for (const url of [
    "https://takeout.google.com/",
    "https://accounts.spotify.com/authorize?*",
    "https://mcp.swiggy.com/auth/authorize?*",
    "https://mcp-server.zomato.com/authorize?*",
  ])
    assert.ok(entries.includes(url), url);
});
