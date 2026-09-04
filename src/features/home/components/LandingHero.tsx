'use client';

import { HeroAiChat } from './HeroAiChat';
import './landing-hero.css';

export function LandingHero() {
  return (
    <section id="hero" className="landingHeroSection">
      <HeroAiChat />
    </section>
  );
}
