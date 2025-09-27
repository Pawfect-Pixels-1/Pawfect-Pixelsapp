// client/src/components/StripePricingTable.tsx
import React, { useEffect, useState } from "react";

interface StripePricingTableProps {
  pricingTableId: string;
  publishableKey: string;
  className?: string;
}

/**
 * Loads the Stripe Pricing Table web component once and renders a given table.
 * Safe for client-side only. Works in React 18.
 */
export function StripePricingTable({
  pricingTableId,
  publishableKey,
  className,
}: StripePricingTableProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // If custom element already defined, we're ready
    if (customElements.get("stripe-pricing-table")) {
      setReady(true);
      return;
    }

    // Otherwise, inject the script once
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.stripe.com/v3/pricing-table.js"]'
    );
    if (existing) {
      // Wait a tick for the custom element definition
      const onDefined = () => setReady(!!customElements.get("stripe-pricing-table"));
      const id = window.setInterval(onDefined, 50);
      setTimeout(() => window.clearInterval(id), 3000);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://js.stripe.com/v3/pricing-table.js";
    script.onload = () => setReady(true);
    document.body.appendChild(script);

    // No cleanup needed for a one-time loader
  }, []);

  // Lightweight loading state (keeps layout steady)
  return (
    <div className={className}>
      {ready ? (
        // React will happily render custom elements with string attributes.
        // @ts-expect-error: JSX doesn't know these attributes but the browser does.
        <stripe-pricing-table
          pricing-table-id={pricingTableId}
          publishable-key={publishableKey}
        />
      ) : (
        <div className="w-full rounded-xl border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
          Loading pricing…
        </div>
      )}
    </div>
  );
}
