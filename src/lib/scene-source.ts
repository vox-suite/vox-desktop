import { platform } from "@/platform";
import type { MapScene } from "@/lib/map-scene";

export function subscribeMapScene(
  handler: (scene: MapScene) => void,
): () => void {
  let active = true;
  const unsubscribe = platform().live.subscribe((event) => {
    if (event.type === "map_scene") handler(event.scene as MapScene);
  });
  void platform()
    .http.request<MapScene>({ method: "GET", path: "/v1/me/map/scene" })
    .then((scene) => {
      if (active) handler(scene);
    })
    .catch(() => undefined);
  return () => {
    active = false;
    unsubscribe();
  };
}
