'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Ico } from '@/components/common/Ico';
import { Link, usePathname } from '@/i18n/navigation';
import NextLink from 'next/link';
import { localePath } from '@/i18n/seo-locales';
import { routing } from '@/i18n/routing';
import { SITE } from '@/config/site';
import { MagneticButton } from '@/components/common/MagneticButton';
import { publishedRoute } from '@/features/product-pages/routes';
import { LandingThemeToggle } from './LandingThemeToggle';
import './landing-nav.css';

/* Floating aiNOW navbar for one product domain. Home anchors and secondary
   pages share one route registry, so an unpublished page cannot remain in the
   header after its route is disabled. */

// In-page sections (ids live on the home landing components).
const SECTIONS = {
  result: 'dashboard',
  cases: 'cases',
  faq: 'faq',
  cta: 'cta',
} as const;
const PRODUCT_ITEMS = [
  { href: 'https://aichats.ge', label: 'aiCHATS', descriptionKey: 'aichats', Icon: 'solar:chat-round-line-bold-duotone' },
  { href: 'https://aicall.ge', label: 'aiCALL', descriptionKey: 'aicall', Icon: 'solar:phone-bold-duotone' },
  { href: 'https://aiads.ge', label: 'aiADS', descriptionKey: 'aiads', Icon: 'solar:target-bold-duotone' },
  { href: 'https://aicontent.ge', label: 'aiCONTENT', descriptionKey: 'aicontent', Icon: 'solar:pen-new-square-bold-duotone' },
  { href: 'https://aidocs.ge', label: 'aiDOCS', descriptionKey: 'aidocs', Icon: 'solar:file-text-bold-duotone' },
  { href: 'https://aiweb.ge', label: 'aiWEB', descriptionKey: 'aiweb', Icon: 'solar:global-bold-duotone' },
  { href: 'https://aioffice.ge', label: 'aiOFFICE', descriptionKey: 'aioffice', Icon: 'solar:case-bold-duotone' },
  { href: 'https://aiapp.ge', label: 'aiAPP', descriptionKey: 'aiapp', Icon: 'solar:widget-5-bold-duotone' },
  { href: 'https://aistaff.ge', label: 'aiSTAFF', descriptionKey: 'aistaff', Icon: 'solar:user-id-bold-duotone' },
  { href: 'https://aibrain.ge', label: 'aiBRAIN', descriptionKey: 'aibrain', Icon: 'solar:cpu-bolt-bold-duotone' },
  { href: 'https://aijurist.ge', label: 'aiJURIST', descriptionKey: 'aijurist', Icon: 'solar:scale-bold-duotone' },
  { href: 'https://aimusic.ge', label: 'aiMUSIC', descriptionKey: 'aimusic', Icon: 'solar:headphones-round-bold-duotone' },
  { href: 'https://vibecoding.ge', label: 'vibeCODING', descriptionKey: 'vibecoding', Icon: 'solar:code-square-bold-duotone' },
  { href: 'https://aitaxi.ge', label: 'aiTAXI', descriptionKey: 'aitaxi', Icon: 'solar:map-point-bold-duotone' },
] as const;

function Chevron({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

// Locale switcher entries, derived from routing.locales so the pill stays in
// sync. Labels = native names.
const LOCALE_LABELS: Record<string, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};
const LOCALES = routing.locales.map((code) => ({
  code,
  label: LOCALE_LABELS[code] ?? code.toUpperCase(),
}));
const NAV_A11Y = {
  ka: {
    open: 'მენიუს გახსნა',
    close: 'მენიუს დახურვა',
    language: 'ენის შეცვლა',
    home: 'მთავარი',
    contact: 'დაგვიკავშირდით',
    product: 'პროდუქტი',
    pricing: 'ფასები',
    blog: 'ბლოგი',
    integrations: 'ინტეგრაციები',
    security: 'უსაფრთხოება',
    solutions: 'გადაწყვეტილებები',
  },
  en: {
    open: 'Open menu',
    close: 'Close menu',
    language: 'Switch language',
    home: 'Home',
    contact: 'Contact us',
    product: 'Product',
    pricing: 'Pricing',
    blog: 'Blog',
    integrations: 'Integrations',
    security: 'Security',
    solutions: 'Solutions',
  },
  ru: {
    open: 'Открыть меню',
    close: 'Закрыть меню',
    language: 'Сменить язык',
    home: 'Главная',
    contact: 'Связаться с нами',
    product: 'Продукт',
    pricing: 'Цены',
    blog: 'Блог',
    integrations: 'Интеграции',
    security: 'Безопасность',
    solutions: 'Решения',
  },
} as const;

function Wordmark() {
  return (
    <div className="wordmark-3d text-lg leading-none">
      <span className="wm-prefix">{SITE.wordmark.prefix}</span>
      <span className="wm-mark">{SITE.wordmark.mark}</span>
      <span className="wm-accent" aria-hidden="true" />
    </div>
  );
}

export function LandingNav() {
  const t = useTranslations('landingNav');
  const tProductDescription = useTranslations('landingNav.productDescriptions');
  const locale = useLocale();
  const pathname = usePathname();
  // Some navigators return a locale-prefixed pathname after client navigation.
  // Treat both forms as the landing root so the hero/header handoff always runs.
  const isHome = pathname === '/' || pathname === `/${locale}`;

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [drawerProductsOpen, setDrawerProductsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const langButtonRef = useRef<HTMLButtonElement>(null);
  const productButtonRef = useRef<HTMLButtonElement>(null);
  const productMenuRef = useRef<HTMLLIElement>(null);
  const a11y = NAV_A11Y[locale as keyof typeof NAV_A11Y] ?? NAV_A11Y.en;

  const sectionHref = (id: string) => (isHome ? `#${id}` : `/#${id}`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body scroll lock + ESC-to-close while the mobile drawer is open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const isolatedContent = Array.from(document.querySelectorAll<HTMLElement>('main, footer')).map(
      (element) => ({
        element,
        hadInert: element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }),
    );
    isolatedContent.forEach(({ element }) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });
    const drawer = drawerRef.current;
    const focusable = (): HTMLElement[] =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute('inert'));
    const focusFrame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) {
        e.preventDefault();
        menuButtonRef.current?.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !drawer?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
      isolatedContent.forEach(({ element, hadInert, ariaHidden }) => {
        if (!hadInert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!langOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangOpen(false);
        langButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [langOpen]);

  useEffect(() => {
    if (!productOpen) return undefined;

    const closeProductMenu = () => setProductOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProductMenu();
        productButtonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !productMenuRef.current?.contains(event.target)
      ) {
        closeProductMenu();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [productOpen]);

  // Smooth-scroll on home; on other pages let <Link> navigate to /#id.
  const handleSection = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    setMenuOpen(false);
    if (isHome) {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  const atTop = !scrolled;
  const logoHidden = atTop;
  const navClassName = ['glass-nav', atTop && 'is-top', menuOpen && 'menu-open']
    .filter(Boolean)
    .join(' ');

  const blogRoute = publishedRoute('blog');

  return (
    <nav className={navClassName} data-family-header="true">
      <div className="glass-nav-bg" />

      <div className="glass-nav-inner">
        <button
          ref={menuButtonRef}
          type="button"
          className="nav-burger"
          aria-label={menuOpen ? a11y.close : a11y.open}
          aria-expanded={menuOpen}
          aria-controls="landing-nav-drawer"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
        </button>

        <Link
          href="/"
          className="nav-logo nav-logo-slot"
          aria-label={`${SITE.wordmark.prefix}${SITE.wordmark.mark}: ${a11y.home}`}
          aria-hidden={logoHidden || undefined}
          tabIndex={logoHidden ? -1 : undefined}
        >
          <Wordmark />
        </Link>

        <ul className="nav-menu">
          <li
            ref={productMenuRef}
            className={`nav-services${productOpen ? ' is-open' : ''}`}
          >
            <button
              ref={productButtonRef}
              type="button"
              className="nav-services-trigger"
              aria-expanded={productOpen}
              aria-controls="landing-product-menu"
              aria-haspopup="true"
              onClick={() => {
                setLangOpen(false);
                setProductOpen((value) => !value);
              }}
            >
              {t('products')}
              <Chevron className="nav-services-chevron" />
            </button>
            <ul
              id="landing-product-menu"
              className="nav-dropdown nav-dropdown-grid"
              aria-hidden={!productOpen}
              inert={!productOpen}
            >
              {PRODUCT_ITEMS.map((product) => (
                <li key={product.href}>
                  <a
                    href={product.href}
                    target="_blank"
                    rel="noreferrer"
                    className="nav-dd-link"
                    onClick={() => setProductOpen(false)}
                  >
                    <span className="nav-dd-icon" aria-hidden="true">
                      <Ico name={product.Icon} />
                    </span>
                    <span className="nav-product-copy">
                      <span className="nav-product-name">{product.label}</span>
                      <span className="nav-product-description">{tProductDescription(product.descriptionKey)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </li>

          {blogRoute ? (
            <li>
              <Link href={blogRoute.path} className="nav-link">
                {a11y.blog}
              </Link>
            </li>
          ) : (
            <li>
              <Link href="/blog" className="nav-link">
                {a11y.blog}
              </Link>
            </li>
          )}
        </ul>

        <div className="nav-actions">
          <div className={`nav-lang${langOpen ? ' is-open' : ''}`}>
            <button
              ref={langButtonRef}
              type="button"
              className="nav-lang-trigger"
              aria-expanded={langOpen}
              aria-controls="landing-language-menu"
              aria-label={a11y.language}
              onClick={() => {
                setProductOpen(false);
                setLangOpen((value) => !value);
              }}
            >
              <Ico name="solar:global-bold-duotone" className="nav-lang-globe" />
              {locale.toUpperCase()}
              <Ico name="solar:alt-arrow-down-bold-duotone" className="nav-lang-chevron" />
            </button>
            <ul
              id="landing-language-menu"
              className="nav-dropdown nav-lang-dropdown"
              aria-hidden={!langOpen}
              inert={!langOpen}
            >
              {LOCALES.map((l) => (
                <li key={l.code}>
                  <NextLink
                    href={localePath(l.code, pathname)}
                    className={`nav-dd-link${l.code === locale ? ' is-current' : ''}`}
                    onClick={() => setLangOpen(false)}
                  >
                    {l.label}
                  </NextLink>
                </li>
              ))}
            </ul>
          </div>

          <MagneticButton>
            <Link href={sectionHref(SECTIONS.cta)} className="glass-cta nav-call-cta" aria-label={a11y.contact} onClick={(e) => handleSection(e, SECTIONS.cta)}>
              <Ico name="solar:phone-calling-rounded-bold-duotone" className="nav-call-icon" aria-hidden="true" />
            </Link>
          </MagneticButton>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        ref={drawerRef}
        className="nav-drawer"
        id="landing-nav-drawer"
        role="dialog"
        aria-modal={menuOpen || undefined}
        aria-label={a11y.open}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <div className="nav-drawer-bg" />
        <ul className="nav-drawer-menu">
          <li>
            <button
              type="button"
              className="nav-drawer-link nav-drawer-services-trigger"
              data-i="1"
              aria-expanded={drawerProductsOpen}
              onClick={() => setDrawerProductsOpen((open) => !open)}
            >
              {t('products')}
              <Chevron className="nav-drawer-services-chevron" />
            </button>
            {drawerProductsOpen && (
              <ul className="nav-drawer-sublist">
                {PRODUCT_ITEMS.map((product) => (
                  <li key={product.href}>
                    <a
                      href={product.href}
                      target="_blank"
                      rel="noreferrer"
                      className="nav-drawer-sublink"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="nav-dd-icon" aria-hidden="true">
                        <Ico name={product.Icon} />
                      </span>
                      <span className="nav-product-copy">
                        <span className="nav-product-name">{product.label}</span>
                        <span className="nav-product-description">{tProductDescription(product.descriptionKey)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li>
            <Link
              href={blogRoute ? blogRoute.path : '/blog'}
              className="nav-drawer-link"
              data-i="2"
              onClick={() => setMenuOpen(false)}
            >
              {a11y.blog}
            </Link>
          </li>
          <li className="nav-drawer-theme-row">
            <LandingThemeToggle className="nav-drawer-theme" />
          </li>
        </ul>
      </div>
    </nav>
  );
}
