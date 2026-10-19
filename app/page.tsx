import { Dispatch } from "@/components/dispatch/dispatch";
import { serverEnv } from "@/lib/env";
import { mapStyleFor } from "@/lib/map-style";

// Configuration is read here, on the server, and handed to the console as
// plain props, so none of it needs a NEXT_PUBLIC_ variable.
export default function Page() {
  const env = serverEnv();
  return (
    <Dispatch
      mapStyle={mapStyleFor(env.MAP_TILE_URL, env.MAP_ATTRIBUTION)}
      demo={!env.ANTHROPIC_API_KEY}
    />
  );
}
