'use client';

import { useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleCheck,
  FileCheck2,
  Flag,
  Layers3,
  Menu,
  Pause,
  Play,
  X,
} from './HomeIcon';
import { Link } from '@/src/i18n/navigation';
import { MotionWorld } from './MotionWorld';
import { useHomeChoreography } from './useHomeChoreography';

const areas = ['portfolio', 'execution', 'governance', 'outcomes'] as const;
const teams = ['alliances', 'leadership', 'reviewers'] as const;
const teamIcons = [Flag, Layers3, FileCheck2];
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal ? (
    <ArrowUpRight size={17} aria-hidden="true" />
  ) : (
    <ArrowRight size={17} aria-hidden="true" />
  );
}
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <span className="hm-word" aria-hidden="true" key={`${index}-${word}`}>
          {word}{' '}
        </span>
      ))}
    </>
  );
}
function RevealHeading({ id, text }: { id: string; text: string }) {
  return (
    <h2 id={id} aria-label={text} data-reveal>
      <Words text={text} />
    </h2>
  );
}
function Index({ number, children }: { number: string; children: ReactNode }) {
  return (
    <p className="hm-index">
      <span>
        {'// '}
        {number}
      </span>{' '}
      {children}
    </p>
  );
}

export function RevenHome({ pilotMode }: { pilotMode: boolean }) {
  const t = useTranslations('home');
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [motion, setMotion] = useState(true);
  const [area, setArea] = useState<(typeof areas)[number]>('portfolio');
  const rootRef = useRef<HTMLDivElement>(null);
  useHomeChoreography(rootRef, motion);
  const entry = pilotMode ? '/workspace' : '/sign-up';
  const closeMenu = () => setMenuOpen(false);
  return (
    <div ref={rootRef} className="hm-page hm-page--motion" data-motion={motion ? 'on' : 'off'}>
      <a href="#home-main" className="skip-link">
        {t('skip')}
      </a>
      <header className="hm-header">
        <div className="hm-container hm-nav-row">
          <Link href="/" className="hm-logo" aria-label={t('homeLabel')}>
            <Image src="/brand/reven-mark.svg" width={132} height={38} alt="Reven" priority />
          </Link>
          <nav className="hm-desktop-nav" aria-label={t('navigation')}>
            <a href="#platform">{t('nav.platform')}</a>
            <a href="#why-reven">{t('nav.why')}</a>
            <a href="#teams">{t('nav.teams')}</a>
          </nav>
          <div className="hm-nav-actions">
            <button
              className="hm-top-motion"
              onClick={() => setMotion(!motion)}
              aria-label={t(motion ? 'pause' : 'play')}
              aria-pressed={!motion}
            >
              {motion ? (
                <Pause size={15} aria-hidden="true" />
              ) : (
                <Play size={15} aria-hidden="true" />
              )}
              <span>{t(motion ? 'pause' : 'play')}</span>
            </button>
            <Link
              href="/"
              locale={locale === 'en' ? 'ar' : 'en'}
              className="hm-language"
              lang={locale === 'en' ? 'ar' : 'en'}
            >
              {locale === 'en' ? 'العربية' : 'English'}
            </Link>
            <Link href="/workspace" prefetch={false} className="hm-workspace-link">
              {t(pilotMode ? 'nav.pilot' : 'nav.workspace')} <Arrow />
            </Link>
          </div>
          <button
            className="hm-menu-button"
            aria-label={t(menuOpen ? 'closeMenu' : 'openMenu')}
            aria-expanded={menuOpen}
            aria-controls="home-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        {menuOpen && (
          <nav
            id="home-mobile-nav"
            className="hm-mobile-nav"
            aria-label={t('navigation')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setMenuOpen(false);
                document.querySelector<HTMLButtonElement>('.hm-menu-button')?.focus();
              }
            }}
          >
            <a href="#platform" onClick={closeMenu}>
              {t('nav.platform')} <Arrow />
            </a>
            <a href="#why-reven" onClick={closeMenu}>
              {t('nav.why')} <Arrow />
            </a>
            <a href="#teams" onClick={closeMenu}>
              {t('nav.teams')} <Arrow />
            </a>
            <Link href="/workspace" prefetch={false}>
              {t('nav.workspace')} <Arrow />
            </Link>
          </nav>
        )}
      </header>
      <main id="home-main">
        <section className="hm-container hm-hero" aria-labelledby="home-heading">
          <div className="hm-hero-scene">
            <MotionWorld variant="hero" paused={!motion} />
          </div>
          <div className="hm-hero-copy">
            <p className="hm-eyebrow">
              <i />
              {t('category')}
            </p>
            <h1
              id="home-heading"
              aria-label={`${t('headline.first')} ${t('headline.second')} ${t('headline.third')}`}
            >
              <span>
                <Words text={t('headline.first')} />
              </span>
              <span>
                <Words text={t('headline.second')} />
              </span>
              <span className="hm-soft">
                <Words text={t('headline.third')} />
              </span>
            </h1>
            <p className="hm-hero-lead">
              <strong>{t('positioning')}</strong>
              <span>{t('heroDescription')}</span>
            </p>
            <ul className="hm-proof-points">
              <li>{t('proof.ownership')}</li>
              <li>{t('proof.evidence')}</li>
              <li>{t('proof.bilingual')}</li>
            </ul>
            <div className="hm-hero-bottom">
              <div className="hm-entry">
                <div className="hm-entry-actions">
                  <Link href={entry} prefetch={false} className="hm-button">
                    {t(pilotMode ? 'explorePilot' : 'getStarted')} <Arrow diagonal />
                  </Link>
                  <a href="#platform" className="hm-text-link">
                    {t('secondaryCta')} <Arrow />
                  </a>
                </div>
                <p className="hm-entry-note">{t(pilotMode ? 'pilotNote' : 'entryNote')}</p>
              </div>
              <a href="#why-it-matters" className="hm-scroll">
                <ArrowDown size={15} aria-hidden="true" /> {t('scroll')}
              </a>
            </div>
          </div>
          <div className="hm-hero-route" aria-hidden="true">
            <span>01 / {t('story.nodes.agreement')}</span>
            <span>02 / {t('story.nodes.work')}</span>
            <span>03 / {t('story.nodes.result')}</span>
          </div>
        </section>
        <section
          id="why-it-matters"
          className="hm-container hm-story"
          aria-labelledby="story-heading"
        >
          <Index number="01">{t('story.eyebrow')}</Index>
          <div className="hm-film">
            <MotionWorld variant="film" paused={!motion} />
            <div className="hm-film-top">
              <span className="hm-film-status">
                <i />
                {t('story.label')}
              </span>
              <span className="hm-film-meta">REVEN / 01</span>
            </div>
            <div className="hm-film-copy">
              <RevealHeading id="story-heading" text={t('story.title')} />
              <p>{t('story.description')}</p>
            </div>
            <ol className="hm-film-journey">
              {['agreement', 'work', 'result'].map((step, index) => (
                <li key={step}>
                  <span>0{index + 1}</span>
                  {t(`story.nodes.${step}`)}
                  {index < 2 && <Arrow />}
                </li>
              ))}
            </ol>
            <button
              className="hm-motion-button"
              onClick={() => setMotion(!motion)}
              aria-label={t(motion ? 'pause' : 'play')}
              aria-pressed={!motion}
            >
              {motion ? (
                <Pause size={15} aria-hidden="true" />
              ) : (
                <Play size={15} aria-hidden="true" />
              )}
              <span>{t(motion ? 'pause' : 'play')}</span>
            </button>
          </div>
        </section>
        <section id="why-reven" className="hm-dark hm-why" aria-labelledby="why-heading">
          <div className="hm-container">
            <div className="hm-section-heading">
              <div>
                <Index number="02">{t('why.eyebrow')}</Index>
                <RevealHeading id="why-heading" text={t('why.title')} />
              </div>
              <p>{t('why.description')}</p>
            </div>
            <div className="hm-principles">
              {['clarity', 'accountability', 'confidence'].map((key, i) => (
                <article className="hm-principle" key={key}>
                  <p className="hm-mini">
                    0{i + 1} {t(`why.${key}.label`)}
                  </p>
                  <h3>{t(`why.${key}.title`)}</h3>
                  <p>{t(`why.${key}.description`)}</p>
                  <div className="hm-principle-foot">
                    <span>{t(`why.${key}.foot`)}</span>
                    <Check size={19} aria-hidden="true" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="platform" className="hm-platform" aria-labelledby="platform-heading">
          <div className="hm-container">
            <Index number="03">{t('platform.eyebrow')}</Index>
            <div className="hm-platform-heading">
              <RevealHeading id="platform-heading" text={t('platform.title')} />
              <p>{t('platform.description')}</p>
            </div>
            <div className="hm-explorer" data-area={area}>
              <div className="hm-explorer-scene">
                <MotionWorld variant="platform" paused={!motion} focus={areas.indexOf(area)} />
                <div className="hm-scene-markers" aria-hidden="true">
                  {areas.map((key, index) => (
                    <span
                      className={`hm-scene-marker hm-scene-marker--${key}`}
                      data-selected={area === key}
                      key={key}
                    >
                      <i />0{index + 1} {t(`platform.${key}.label`)}
                    </span>
                  ))}
                </div>
                <span className="hm-scene-caption">{t('platform.sceneCaption')}</span>
              </div>
              <div className="hm-explorer-content">
                <div className="hm-tabs" role="tablist" aria-label={t('platform.tabLabel')}>
                  {areas.map((key, i) => (
                    <button
                      key={key}
                      id={`tab-${key}`}
                      type="button"
                      role="tab"
                      aria-selected={area === key}
                      aria-controls="platform-panel"
                      tabIndex={area === key ? 0 : -1}
                      onClick={() => setArea(key)}
                      onKeyDown={(event) => {
                        const previous = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
                        const next = event.key === 'ArrowRight' || event.key === 'ArrowDown';
                        if (previous || next || event.key === 'Home' || event.key === 'End') {
                          event.preventDefault();
                          const index =
                            event.key === 'Home'
                              ? 0
                              : event.key === 'End'
                                ? areas.length - 1
                                : (i + (previous ? -1 : 1) + areas.length) % areas.length;
                          const selected = areas[index]!;
                          setArea(selected);
                          document.getElementById(`tab-${selected}`)?.focus();
                        }
                      }}
                    >
                      <span>0{i + 1}</span>
                      {t(`platform.${key}.label`)}
                      <Arrow diagonal />
                    </button>
                  ))}
                </div>
                <div
                  className="hm-tab-panel"
                  role="tabpanel"
                  id="platform-panel"
                  aria-labelledby={`tab-${area}`}
                  tabIndex={0}
                >
                  <p className="hm-mini">{t(`platform.${area}.label`)}</p>
                  <h3>{t(`platform.${area}.title`)}</h3>
                  <p>{t(`platform.${area}.description`)}</p>
                  <Link href={entry} prefetch={false} className="hm-text-link">
                    {t(pilotMode ? 'platform.explore' : 'platform.create')} <Arrow />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="hm-dark hm-system" aria-labelledby="system-heading">
          <div className="hm-container">
            <div className="hm-section-heading">
              <div>
                <Index number="04">{t('system.eyebrow')}</Index>
                <RevealHeading id="system-heading" text={t('system.title')} />
              </div>
              <p>{t('system.description')}</p>
            </div>
            <ol className="hm-workflow">
              {['align', 'execute', 'review', 'verify'].map((key, i) => (
                <li key={key}>
                  <span className="hm-workflow-number">0{i + 1}</span>
                  <h3>{t(`system.${key}.title`)}</h3>
                  <p>{t(`system.${key}.description`)}</p>
                </li>
              ))}
            </ol>
            <div className="hm-system-bottom">
              <p>
                <span className="hm-live-dot" />
                {t('system.note')}
              </p>
              <Link href={entry} prefetch={false} className="hm-text-link">
                {t(pilotMode ? 'explorePilot' : 'getStarted')} <Arrow />
              </Link>
            </div>
          </div>
        </section>
        <section id="teams" className="hm-container hm-teams" aria-labelledby="teams-heading">
          <div className="hm-section-heading">
            <div>
              <Index number="05">{t('teams.eyebrow')}</Index>
              <RevealHeading id="teams-heading" text={t('teams.title')} />
            </div>
            <p>{t('teams.description')}</p>
          </div>
          <div className="hm-team-grid">
            {teams.map((key, i) => (
              <article key={key} className="hm-team">
                <figure className={`hm-team-art hm-team-art--${i}`}>
                  <div className="hm-role-card" aria-hidden="true">
                    <div className="hm-role-card-top">
                      {(() => {
                        const Icon = teamIcons[i]!;
                        return <Icon size={21} strokeWidth={1.5} />;
                      })()}
                      <span>0{i + 1}</span>
                    </div>
                    <strong>{t(`teams.${key}.artTitle`)}</strong>
                    <p>{t(`teams.${key}.artDetail`)}</p>
                    <div className="hm-role-lines">
                      <span />
                      <span />
                      <span />
                    </div>
                    <CircleCheck size={23} className="hm-role-check" strokeWidth={1.4} />
                  </div>
                  <figcaption>{t('teams.illustration')}</figcaption>
                </figure>
                <p className="hm-mini">{t(`teams.${key}.label`)}</p>
                <h3>{t(`teams.${key}.title`)}</h3>
                <p>{t(`teams.${key}.description`)}</p>
                <Link href={entry} prefetch={false} className="hm-text-link">
                  {t(pilotMode ? 'explorePilot' : 'getStarted')} <Arrow />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="hm-cta" aria-labelledby="cta-heading">
          <div className="hm-container">
            <Index number="06">{t('cta.eyebrow')}</Index>
            <h2 id="cta-heading">
              {t('cta.title')} <span>{t('cta.highlight')}</span>
            </h2>
            <div className="hm-cta-bottom">
              <p>{t('tagline')}</p>
              <Link href={entry} prefetch={false} className="hm-button">
                {t(pilotMode ? 'explorePilot' : 'getStarted')} <Arrow diagonal />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="hm-footer">
        <div className="hm-container">
          <div className="hm-footer-top">
            <div>
              <Link href="/" aria-label={t('homeLabel')}>
                <Image src="/brand/reven-mark.svg" width={132} height={38} alt="Reven" />
              </Link>
              <p>{t('positioning')}</p>
            </div>
            <nav aria-label={t('footerNavigation')}>
              <a href="#platform">{t('nav.platform')}</a>
              <a href="#why-reven">{t('nav.why')}</a>
              <a href="#teams">{t('nav.teams')}</a>
              <Link href="/workspace" prefetch={false}>
                {t('nav.workspace')} <Arrow diagonal />
              </Link>
            </nav>
          </div>
          <div className="hm-footer-bottom">
            <span>© {new Date().getFullYear()} Reven</span>
            <span>{t('footerNote')}</span>
            <a href="#home-main">{t('backToTop')} ↑</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
