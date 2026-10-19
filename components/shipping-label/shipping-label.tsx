"use client";

import { Barcode, QRCode, saveCode } from "@nuvui/barcodes";
import { Button } from "@nuvui/react";
import { useRef, useState } from "react";
import type { Depot, Stop } from "@/lib/types";
import "./shipping-label.scss";

const company = "Dispatch Logistics";

/**
 * The shipping-label block, for one stop's parcel. A delivery goes from the
 * depot to the stop; a pickup comes from the stop back to the depot. The
 * barcode and the QR code both hold the tracking number, which changes when
 * the agent reissues the label.
 */
export function ShippingLabel({ stop, depot }: { stop: Stop; depot: Depot }) {
  const barcode = useRef<SVGSVGElement>(null);
  const [said, setSaid] = useState("");
  const { parcel } = stop;

  const depotLines = [company, depot.address, `${depot.postcode} ${depot.city}`, "Netherlands"];
  const stopLines = [stop.name, stop.address, `${stop.postcode} ${stop.city}`, "Netherlands"];
  const [from, to] = stop.kind === "pickup" ? [stopLines, depotLines] : [depotLines, stopLines];

  async function save(format: "svg" | "png") {
    if (!barcode.current) return;
    const name = `label-${parcel.tracking}`;
    await saveCode(barcode.current, { name, format });
    setSaid(`Saved the barcode as ${name}.${format}.`);
  }

  return (
    <div className="shipping-label">
      <div className="shipping-label__head">
        <div className="shipping-label__about">
          <h3 className="shipping-label__title">
            {stop.kind === "pickup" ? "Pickup" : "Delivery"} for {stop.name}
          </h3>
          <p className="shipping-label__text">
            The barcode and the QR code are the tracking number.
          </p>
        </div>
        <div className="shipping-label__actions">
          <Button intent="secondary" size="sm" onClick={() => save("svg")}>
            Save as SVG
          </Button>
          <Button intent="secondary" size="sm" onClick={() => save("png")}>
            Save as PNG
          </Button>
        </div>
      </div>
      <p className="shipping-label__said" role="status">
        {said}
      </p>

      <article className="shipping-label__label" aria-label={`Label for ${stop.name}`}>
        <div className="shipping-label__row">
          <section className="shipping-label__party">
            <h4 className="shipping-label__heading">From</h4>
            <address className="shipping-label__address">
              {from.map((line) => (
                <span key={line} className="shipping-label__line">
                  {line}
                </span>
              ))}
            </address>
          </section>
          <dl className="shipping-label__facts">
            <div className="shipping-label__fact">
              <dt className="shipping-label__heading">Service</dt>
              <dd className="shipping-label__value">{parcel.service}</dd>
            </div>
            <div className="shipping-label__fact">
              <dt className="shipping-label__heading">Weight</dt>
              <dd className="shipping-label__value">{parcel.weightKg} kg</dd>
            </div>
            <div className="shipping-label__fact">
              <dt className="shipping-label__heading">Window</dt>
              <dd className="shipping-label__value">
                {stop.window.from}–{stop.window.to}
              </dd>
            </div>
          </dl>
        </div>

        <section className="shipping-label__party shipping-label__party--to">
          <h4 className="shipping-label__heading">To</h4>
          <address className="shipping-label__address shipping-label__address--to">
            {to.map((line) => (
              <span key={line} className="shipping-label__line">
                {line}
              </span>
            ))}
          </address>
        </section>

        <div className="shipping-label__codes">
          <Barcode
            ref={barcode}
            value={parcel.tracking}
            height={64}
            aria-label={`Tracking number ${parcel.tracking}`}
          />
          <QRCode
            value={parcel.tracking}
            size={88}
            quietZone={2}
            aria-label={`QR code of tracking number ${parcel.tracking}`}
          />
        </div>
      </article>
    </div>
  );
}
