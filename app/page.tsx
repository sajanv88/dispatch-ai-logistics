import { Dispatch } from "@/components/dispatch/dispatch";
import { mapStyleFor } from "@/lib/map-style";

// Configuration is read here, on the server, and handed to the console as
// plain props, so none of it needs a NEXT_PUBLIC_ variable.
export default function Page() {
  return (
    <Dispatch
      mapStyle={mapStyleFor(process.env.MAP_TILE_URL, process.env.MAP_ATTRIBUTION)}
      demo={!process.env.ANTHROPIC_API_KEY}
    />
  );
}
