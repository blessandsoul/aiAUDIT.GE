'use client';

/* =========================================================================
   LandingShowcase: THE PRODUCT SLOT.

   This is the one section of the page that is genuinely different per landing,
   and it is the only shell component the scaffold expects you to rewrite.
   Everything above it (hero) and below it (work, faq, cta, wordmark) is shared
   and is kept in sync from landing-template/ by `python scripts/landings.py sync`.

   Import this site's bespoke demo widgets from src/features/showcase/ and render
   them here in order. Their copy lives under the `product.*` namespace in
   src/messages/{ka,en,ru}.json.

   The id="showcase" anchor is what the nav pill and the footer link scroll to.
   Do not remove it. The previous version of this codebase pointed both at
   #products, an id that lived on a component nothing imported, so the link
   scrolled nowhere.
   ========================================================================= */

export function LandingShowcase() {
  return (
    <div id="showcase" className="landing-showcase">
      {/* Replaced per landing, e.g. for aiCALL:
          <CallGeorgianVoice />
          <CallConsentGate />
          <CallOutcomeBoard />
          <CallCostSlider />
      */}
    </div>
  );
}
