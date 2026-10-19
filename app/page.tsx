import { etas } from "@/lib/geo";
import { knownAddresses } from "@/lib/seed/addresses";
import { chargers } from "@/lib/seed/chargers";
import { seedRoute } from "@/lib/seed/route";

// Stage 1 only: shows the seed data, with ETAs, until the blocks replace it.
export default function Page() {
  const times = etas(seedRoute);
  return (
    <main>
      <h1>
        {seedRoute.van.name}: {seedRoute.stops.length} stops, {chargers.length} chargers,{" "}
        {knownAddresses.length} known addresses
      </h1>
      <ol>
        {seedRoute.stops.map((stop) => (
          <li key={stop.id}>
            {stop.name}, {stop.city}: {stop.status} {stop.doneAt ?? times.get(stop.id)?.eta}
            {times.get(stop.id)?.late ? " (late)" : ""}
          </li>
        ))}
      </ol>
    </main>
  );
}
