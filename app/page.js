'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Leaf, ArrowRight, ArrowUpRight, Plus, Lightbulb, Users, CheckCircle2, GraduationCap, Handshake, Building2, Droplets, Sprout, BookOpen, HeartPulse, Zap, Recycle, MapPin, Compass, ChartNoAxesCombined } from 'lucide-react';
import { usePortal } from '@/components/providers/portal-provider';
import './home.css';

const categoryIcons = {
  'Water Resources': Droplets, Agriculture: Sprout, Education: BookOpen,
  Healthcare: HeartPulse, Energy: Zap, 'Waste Management': Recycle
};

export default function HomePage() {
  const { problems, loading } = usePortal();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const resolved = problems.filter(p => p.status === 'Resolved').length;
  const active = problems.filter(p => ['In progress', 'Assigned', 'Pilot testing', 'Implementation'].includes(p.status)).length;
  const people = problems.filter(p => p.status === 'Resolved').reduce((n, p) => n + Number(p.affectedPopulation || 0), 0);
  const districts = new Set(problems.map(p => p.district)).size;
  const categoryCounts = problems.reduce((out, p) => ({ ...out, [p.category]: (out[p.category] || 0) + 1 }), {});

  return (
    <div className="home">
      {/* ── Navigation ── */}
      <nav className={`home-nav ${scrolled ? 'scrolled' : ''}`}>
        <Link href="/" className="home-nav-brand">
          <span className="home-nav-logo"><Leaf size={24} strokeWidth={1.8} /></span>
          <span className="home-nav-title">Jharkhand<span>Innovation</span></span>
        </Link>
        <div className="home-nav-links">
          <Link href="/challenges">Explore</Link>
          <Link href="/universities">Universities</Link>
          <Link href="/partners">Partners</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/report" className="home-nav-cta">
            <Plus size={16} /> Report a problem
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-grid" aria-hidden="true" />
        <div className="home-hero-content">
          <div className="home-hero-badge">
            <span className="home-hero-badge-dot" />
            SOCIETAL INNOVATION PORTAL
          </div>
          <h1>
            Local challenges.<br />
            <em>Collective solutions.</em>
          </h1>
          <p className="home-hero-subtitle">
            Jharkhand Innovation Connect brings together citizens, universities,
            and industry partners to solve real community problems — from the
            first report to a lasting impact.
          </p>
          <div className="home-hero-actions">
            <Link href="/report" className="home-hero-primary">
              <Plus size={18} /> Report a problem <ArrowRight size={16} />
            </Link>
            <Link href="/challenges" className="home-hero-secondary">
              <Compass size={18} /> Explore challenges
            </Link>
          </div>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <div className="home-hero-orb" />
          <div className="home-hero-orb" />
          <div className="home-hero-orb" />
          <div className="home-hero-float-card">
            <span className="home-float-icon green"><Lightbulb size={22} /></span>
            <div className="home-float-text">
              <strong>Ideas meet opportunity</strong>
              <span>Connecting expertise to real needs</span>
            </div>
          </div>
          <div className="home-hero-float-card">
            <span className="home-float-icon amber"><Users size={22} /></span>
            <div className="home-float-text">
              <strong>Community-driven</strong>
              <span>Citizens lead. Experts collaborate.</span>
            </div>
          </div>
          <div className="home-hero-float-card">
            <span className="home-float-icon blue"><CheckCircle2 size={22} /></span>
            <div className="home-float-text">
              <strong>Verified impact</strong>
              <span>Location-checked resolutions</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="home-stats" aria-label="Key metrics">
        <div className="home-stat">
          <div className="home-stat-value">{loading ? '—' : problems.length}<span className="home-stat-plus">+</span></div>
          <div className="home-stat-label">Challenges reported</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-value">{loading ? '—' : active}</div>
          <div className="home-stat-label">Solutions in progress</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-value">{loading ? '—' : resolved}</div>
          <div className="home-stat-label">Challenges resolved</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-value">{loading ? '—' : districts}</div>
          <div className="home-stat-label">Districts connected</div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="home-mission">
        <span className="home-section-badge">OUR MISSION</span>
        <h2>Together, for a <em>better tomorrow</em></h2>
        <p>
          Jharkhand Innovation Connect is a societal innovation platform that
          bridges the gap between community needs and institutional expertise.
          We empower citizens to report local challenges, connect them with
          universities and partners, and track solutions from idea to impact.
        </p>
      </section>

      {/* ── How it Works ── */}
      <section className="home-steps" aria-label="How it works">
        <div className="home-step">
          <span className="home-step-number">01</span>
          <div className="home-step-icon step-green"><MapPin size={28} /></div>
          <h3>Report a problem</h3>
          <p>
            Describe a local challenge, attach photo or video evidence, confirm
            the GPS location, and submit. AI helps structure your report for
            faster review.
          </p>
        </div>
        <div className="home-step">
          <span className="home-step-number">02</span>
          <div className="home-step-icon step-amber"><GraduationCap size={28} /></div>
          <h3>Connect expertise</h3>
          <p>
            District authorities review and validate the challenge, then assign
            it to universities and partners with the right domain expertise.
          </p>
        </div>
        <div className="home-step">
          <span className="home-step-number">03</span>
          <div className="home-step-icon step-blue"><CheckCircle2 size={28} /></div>
          <h3>Build a solution</h3>
          <p>
            Multidisciplinary teams research, prototype, and pilot solutions.
            Progress is tracked through milestones and verified with after-evidence.
          </p>
        </div>
      </section>

      {/* ── Ecosystem ── */}
      <section className="home-ecosystem">
        <div className="home-ecosystem-header">
          <span className="home-section-badge">THE ECOSYSTEM</span>
          <h2>A connected <em>innovation network</em></h2>
          <p>
            Universities, industry partners, and NGOs working together across
            Jharkhand to turn community challenges into lasting solutions.
          </p>
        </div>
        <div className="home-ecosystem-grid">
          <Link href="/universities" className="home-eco-card">
            <span className="home-eco-icon" style={{ background: '#e8f5ee', color: '#087f70' }}>
              <GraduationCap size={24} />
            </span>
            <h3>Universities & HEIs</h3>
            <p>
              BIT Mesra, IIT (ISM) Dhanbad, NIT Jamshedpur, BAU Ranchi, and more —
              leading multidisciplinary research for community solutions.
            </p>
            <span className="home-eco-stat">
              <ChartNoAxesCombined size={14} /> 6 institutions · 33+ active projects
            </span>
          </Link>
          <Link href="/partners" className="home-eco-card">
            <span className="home-eco-icon" style={{ background: '#f3eff7', color: '#8c5fc4' }}>
              <Handshake size={24} />
            </span>
            <h3>Industry & partners</h3>
            <p>
              Tata Steel Foundation, PRADAN, and technology startups providing
              funding, domain expertise, and community outreach support.
            </p>
            <span className="home-eco-stat">
              <ChartNoAxesCombined size={14} /> 4 partners · 18+ contributions
            </span>
          </Link>
          <Link href="/challenges" className="home-eco-card">
            <span className="home-eco-icon" style={{ background: '#fef5e7', color: '#c49235' }}>
              <Building2 size={24} />
            </span>
            <h3>District authorities</h3>
            <p>
              Local government teams reviewing community reports, validating
              challenges, and coordinating institutional assignments.
            </p>
            <span className="home-eco-stat">
              <ChartNoAxesCombined size={14} /> {districts} districts · Statewide coordination
            </span>
          </Link>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="home-categories">
        <span className="home-section-badge">CHALLENGE AREAS</span>
        <h2>Many challenges. <em>One mission.</em></h2>
        <p>From clean water to digital access — explore the areas where your expertise can make a difference.</p>
        <div className="home-category-grid">
          {['Water Resources', 'Education', 'Agriculture', 'Healthcare', 'Energy', 'Waste Management'].map(cat => {
            const Icon = categoryIcons[cat] || Sprout;
            const colors = {
              'Water Resources': '#eaf3f7', Education: '#f4efdf', Agriculture: '#edf3e6',
              Healthcare: '#f5e9e6', Energy: '#fcf3e9', 'Waste Management': '#eff3f8'
            };
            const iconColors = {
              'Water Resources': '#6b9ba7', Education: '#af9b66', Agriculture: '#8aa274',
              Healthcare: '#b99384', Energy: '#c19564', 'Waste Management': '#6c92b1'
            };
            return (
              <Link key={cat} href={`/challenges?category=${encodeURIComponent(cat)}`} className="home-category-item">
                <span className="home-cat-icon" style={{ background: colors[cat], color: iconColors[cat] }}>
                  <Icon size={24} />
                </span>
                <strong>{cat}</strong>
                <span>{categoryCounts[cat] || 0} challenges</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="home-cta">
        <div className="home-cta-inner">
          <div className="home-cta-pattern" aria-hidden="true" />
          <div className="home-cta-content">
            <h2>Ready to make a difference?</h2>
            <p>
              Your community's next solution could start with you. Report a local
              challenge or explore where your expertise is needed.
            </p>
          </div>
          <div className="home-cta-actions">
            <Link href="/report" className="home-cta-white">
              <Plus size={16} /> Report a problem
            </Link>
            <Link href="/login" className="home-cta-outline">
              Sign in <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer">
        <span className="home-footer-brand">
          <Leaf size={18} /> © 2026 Jharkhand Innovation Connect
        </span>
        <div className="home-footer-links">
          <Link href="/challenges">Challenges</Link>
          <Link href="/universities">Universities</Link>
          <Link href="/partners">Partners</Link>
          <Link href="/login">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
