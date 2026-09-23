'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, CircleHelp, FileCheck2, FileText, HeartHandshake, ImagePlus, Lightbulb, LoaderCircle, MapPin, MessageCircle, PencilLine, ShieldCheck, Sparkles, Sprout, Users, X } from 'lucide-react';
import { usePortal } from '@/components/providers/portal-provider';
import MediaUploader, { MediaPreview } from '@/components/media/media-uploader';
import LocationPicker from '@/components/maps/location-picker';
import { categories as CATEGORIES, districts as DISTRICTS } from '@/data/seed';

const STEPS = [{ title: 'Describe the problem', short: 'Describe', icon: PencilLine, description: 'Tell us what needs to change' },{ title: 'Add your evidence', short: 'Evidence', icon: ImagePlus, description: 'A picture helps tell the story' },{ title: 'Pin the location', short: 'Location', icon: MapPin, description: 'Help us reach the right place' },{ title: 'A few helpful details', short: 'Understand', icon: Sparkles, description: 'Turn your concern into a challenge' },{ title: 'Review & submit', short: 'Review', icon: FileCheck2, description: 'Make sure we got it right' }];
const schema = z.object({ description: z.string().min(25, 'Tell us a little more — at least 25 characters.').max(6000, 'Keep your description under 6,000 characters.'), title: z.string().min(8, 'Give your challenge a title of at least 8 characters.').max(180), category: z.string().optional(), district: z.string().min(1, 'Choose the district where the problem is located.'), summary: z.string().min(10, 'Add a summary of at least 10 characters.').optional(), priority: z.string().optional(), severity: z.string().optional(), affectedPopulation: z.coerce.number().int('Enter a whole number of people.').min(0, 'The number of people cannot be negative.').max(100000000).optional() });
const DRAFT_KEY = 'jh-innovation-report-draft-v1';
const defaults = { description: '', title: '', category: '', district: '', summary: '', priority: 'Medium', severity: 'Medium', affectedPopulation: '' };

async function api(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

export default function ReportWizard() {
  const { user, login, refresh, notify } = usePortal();
  const { register, watch, getValues, setValue, reset, trigger, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const values = watch();
  const [step, setStep] = useState(0), [location, setLocation] = useState(null), [evidence, setEvidence] = useState([]), [answers, setAnswers] = useState({}), [history, setHistory] = useState([]), [analysis, setAnalysis] = useState(null), [source, setSource] = useState('demo'), [question, setQuestion] = useState(null), [answer, setAnswer] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [submitted, setSubmitted] = useState(null), [ready, setReady] = useState(false), [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved?.values?.description) { reset({ ...defaults, ...saved.values }); setLocation(saved.location || null); setEvidence(saved.evidence || []); setAnswers(saved.answers || {}); setHistory(saved.history || []); setRestored(true); }
    } catch { /* An unreadable local draft should not block reporting. */ }
    setReady(true);
  }, [reset]);
  useEffect(() => {
    if (!ready || submitted) return;
    const timer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, location, evidence: evidence.map(({ previewUrl, ...item }) => item), answers, history })); } catch { /* Reporting still works with browser storage disabled. */ } }, 450);
    return () => clearTimeout(timer);
  }, [values, location, evidence, answers, history, ready, submitted]);

  const context = (nextAnswers = answers) => ({ ...getValues(), location, evidence: evidence.map(({ previewUrl, ...item }) => item), answers: nextAnswers });
  const incompleteEvidence = evidence.filter(item => !item.location?.confirmed);
  function go(next) { setStep(next); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function signIn() {
    setBusy('signin'); setError('');
    try { await login('citizen'); } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  function applyAnalysis(result) {
    const generated = result.analysis || result;
    setAnalysis(generated); setSource(result.source || 'demo');
    ['title','summary','category','priority','severity','affectedPopulation'].forEach(key => { if (generated[key] != null) setValue(key, generated[key]); });
    return generated;
  }
  async function beginInterview() {
    if (!user) { setError('Sign in as a citizen to continue with the guided interview.'); return; }
    go(3); setBusy('analysis');
    try {
      const result = await api('/api/problems/analyze', context());
      const generated = applyAnalysis(result);
      const next = (result.questions || generated.followUpQuestions || []).find(item => !Object.hasOwn(answers, item.id));
      if (next) setQuestion(next); else {
        const followup = await api('/api/problems/questions', context());
        const newQuestion = (followup.questions || followup.analysis?.followUpQuestions || []).find(item => !Object.hasOwn(answers, item.id));
        setQuestion(newQuestion || null);
      }
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  async function finishInterview(nextAnswers = answers) {
    setBusy('summary'); setError('');
    try { const result = await api('/api/problems/analyze', context(nextAnswers)); applyAnalysis(result); go(4); } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  function reviewManually() {
    const description = getValues('description');
    setValue('title', description.split(/[.!?\n]/)[0].slice(0, 150)); setValue('summary', description.slice(0, 1900));
    if (!getValues('category')) setValue('category', 'Other');
    setAnalysis(null); setSource('manual'); go(4);
  }
  async function answerQuestion(skip = false) {
    if (!question) return finishInterview();
    if (!skip && !String(answer).trim()) { setError('Choose or enter an answer, or skip this question.'); return; }
    if (!skip && question.type === 'number' && (!Number.isFinite(Number(answer)) || Number(answer) < 0)) { setError('Enter a valid number, zero or greater.'); return; }
    const response = skip ? 'Not provided' : answer;
    const nextAnswers = { ...answers, [question.id]: response };
    setAnswers(nextAnswers); setHistory(items => [...items.filter(item => item.id !== question.id), { id: question.id, question: question.question, answer: response }]); setBusy('question'); setError('');
    try {
      const result = await api('/api/problems/questions', context(nextAnswers));
      setSource(result.source || source);
      const next = (result.questions || result.analysis?.followUpQuestions || []).find(item => !Object.hasOwn(nextAnswers, item.id));
      if (result.complete || !next || Object.keys(nextAnswers).length >= 6) { await finishInterview(nextAnswers); }
      else { setQuestion(next); setAnswer(''); }
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  async function nextStep() {
    setError('');
    if (step === 0) { if (await trigger('description')) go(1); return; }
    if (step === 1) return go(2);
    if (step === 2) {
      const districtValid = await trigger('district');
      if (!location?.confirmed) { setError('Select and confirm the location of this problem.'); return; }
      if (!districtValid) return;
      if (incompleteEvidence.length) { setError('Confirm where each piece of evidence was captured before continuing.'); return; }
      return beginInterview();
    }
    if (step === 3) return answerQuestion();
    if (step === 4) return submit();
  }
  async function submit() {
    const validation = schema.safeParse(getValues());
    if (!validation.success) { await trigger(); setError(validation.error.issues[0].message); return; }
    if (!getValues('title')?.trim()) { setError('Add a title to your challenge.'); return; }
    if (!user) { setError('Please sign in before submitting your challenge.'); return; }
    setBusy('submit'); setError('');
    try {
      const result = await api('/api/problems', { ...analysis, ...context(), affectedPopulation: Number(getValues('affectedPopulation')) || 0, aiAnalysis: source === 'manual' ? undefined : { ...analysis, source }, evidence: evidence.map(({ previewUrl, ...item }) => item) });
      setSubmitted(result.problem); try { localStorage.removeItem(DRAFT_KEY); } catch {} await refresh(); notify?.('Your challenge has been submitted. We’ll keep you updated.', 'success');
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  function editPreviousAnswer() {
    const previous = history.at(-1); if (!previous) return;
    setQuestion({ id: previous.id, question: previous.question, type: 'text' }); setAnswer(previous.answer === 'Not provided' ? '' : previous.answer);
    setAnswers(items => { const next = { ...items }; delete next[previous.id]; return next; }); setHistory(items => items.slice(0, -1));
  }

  const LoginCard = () => <div className="report-login"><div className="report-login-icon"><Users size={20} /></div><div><strong>A small introduction, a meaningful change.</strong><p>Use the citizen demo account to save evidence and submit your challenge.</p></div><button type="button" onClick={signIn} disabled={!!busy}>{busy === 'signin' ? <LoaderCircle size={15} className="spin" /> : null}Continue as a citizen <ArrowRight size={14} /></button></div>;

  if (submitted) return <div className="report-success-page"><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="report-success"><div className="report-success-icon"><CheckCheck size={37} /></div><span className="report-eyebrow">THE FIRST STEP TOWARD CHANGE</span><h1>Your voice. A better tomorrow.</h1><p>Your challenge has been submitted. The right people can now come together to make a difference.</p><div className="report-ticket"><span>CHALLENGE REFERENCE</span><strong>{submitted.reference || submitted.displayId || submitted.id}</strong><span className="report-status">Submitted · Awaiting review</span><h3>{submitted.title}</h3><div><span><MapPin size={14} />{submitted.district || values.district}</span><span><ImagePlus size={14} />{evidence.length} evidence files</span></div></div><Link href={`/challenges/${submitted.id}`} className="report-primary">Track your challenge <ArrowRight size={17} /></Link><Link href="/explore" className="report-success-secondary">Explore other community challenges</Link><div className="report-success-note"><ShieldCheck size={16} />Your report is part of a transparent, trackable process.</div></motion.div></div>;

  return <div className="report-page"><div className="report-breadcrumb"><Link href="/">Home</Link><ChevronRight size={13} /><span>Report a problem</span></div><header className="report-page-header"><div><div className="report-eyebrow"><span /> SMALL ACTIONS. MEANINGFUL CHANGE.</div><h1>Every solution starts with you.</h1><p>Tell us what your community needs. Together, we’ll find a way forward.</p></div><div className="report-draft-label"><ShieldCheck size={15} />Your progress saves on this device</div></header>
    <div className="report-layout"><aside className="report-sidebar"><div className="report-steps-title">LET’S MAKE A DIFFERENCE</div><nav aria-label="Report progress">{STEPS.map((item, index) => { const Icon = item.icon; return <button key={item.short} className={`report-step ${index === step ? 'is-active' : ''} ${index < step ? 'is-complete' : ''}`} type="button" disabled={index > step || !!busy} onClick={() => go(index)} aria-current={index === step ? 'step' : undefined}><span className="report-step-icon">{index < step ? <Check size={17} /> : <Icon size={18} />}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><span className="report-step-number">0{index + 1}</span></button>; })}</nav><div className="report-community-card"><div className="report-community-visual"><Sprout size={38} strokeWidth={1.4} /><span className="community-orbit one"/><span className="community-orbit two"/><HeartHandshake size={22} className="community-heart" /></div><h3>Local voices.<br />Collective impact.</h3><p>Citizens, universities, and partners working together for a better Jharkhand.</p><div><span className="report-small-avatars"><i>RK</i><i>AS</i><i>PM</i></span><span>Change starts with all of us.</span></div></div><div className="report-side-help"><CircleHelp size={17} /><div><strong>Not sure where to start?</strong><p>Describe what you see. We’ll guide you through the rest.</p></div></div></aside>
      <main className="report-form-area">{restored && <div className="report-restored"><FileText size={14} />We’ve restored your saved draft.<button type="button" aria-label="Dismiss restored draft message" onClick={() => setRestored(false)}><X size={14} /></button></div>}<div className="report-card"><div className="report-card-topline"><span>STEP 0{step + 1} <i>/ 05</i></span><span>{Math.round((step + 1) / STEPS.length * 100)}% complete</span></div><div className="report-progress-track"><span style={{ width: `${(step + 1) / STEPS.length * 100}%` }} /></div>
        <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="report-step-content">
          {step === 0 && <><div className="report-section-icon"><PencilLine size={23} /></div><h2>What’s happening in your community?</h2><p className="report-section-description">Big or small, your concern matters. Tell us about the problem in your own words.</p><label className="report-label" htmlFor="problem-description">Describe the problem <span>*</span></label><div className={`report-description-wrap ${errors.description ? 'has-error' : ''}`}><textarea id="problem-description" {...register('description')} placeholder="For example: There has been no reliable drinking water supply in our village for the last three weeks. Families have to walk 2 km to collect water…" rows={7} /><div><span><MessageCircle size={13} />Write naturally. We’ll help with the details.</span><span>{values.description.length} / 6,000</span></div></div>{errors.description && <p className="report-field-error">{errors.description.message}</p>}<div className="report-writing-tip"><Lightbulb size={19} /><div><strong>A helpful report starts with a few simple things.</strong><p>What is happening? Where do you notice it? How does it affect people around you?</p></div></div><label className="report-label" htmlFor="problem-category">What is this related to? <small>Optional</small></label><select id="problem-category" {...register('category')}><option value="">Help me find the right category</option>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select><div className="report-ai-note"><Sparkles size={14} /><span>Our guided assistant will help organize your report into a clear, actionable challenge.</span></div></>}
          {step === 1 && <><div className="report-section-icon"><ImagePlus size={23} /></div><h2>A little evidence tells a bigger story.</h2><p className="report-section-description">Add photos, a short video, or a document to help others understand the situation. This step is optional.</p>{!user ? <LoginCard /> : <MediaUploader value={evidence} onChange={setEvidence} phase="before" location={location} onLocationChange={setLocation} />}<div className="report-evidence-tip"><ShieldCheck size={18} /><p>Evidence is recorded as <strong>before</strong> documentation. Please avoid including private information or recognizable people without their consent.</p></div></>}
          {step === 2 && <><div className="report-section-icon"><MapPin size={23} /></div><h2>Let’s put the problem on the map.</h2><p className="report-section-description">Choose where the problem is happening, then confirm the pin. We never assume your location.</p><div className="report-field-row"><label className="report-label" htmlFor="problem-district">District <span>*</span><select id="problem-district" {...register('district')}><option value="">Select the district</option>{DISTRICTS.map(district => <option key={district}>{district}</option>)}</select>{errors.district && <small className="report-field-error">{errors.district.message}</small>}</label></div><LocationPicker value={location} onChange={setLocation} />{incompleteEvidence.length > 0 && location?.confirmed && <label className="report-confirm-evidence"><input type="checkbox" checked={false} onChange={() => setEvidence(items => items.map(item => item.location?.confirmed ? item : { ...item, location: { ...location, confirmed: true } }))} /><span>I confirm the {incompleteEvidence.length} unconfirmed evidence {incompleteEvidence.length === 1 ? 'file was' : 'files were'} captured at this selected location.</span></label>}{!user && <LoginCard />}</>}
          {step === 3 && <><div className="report-section-icon ai"><Sparkles size={23} /></div><div className="report-ai-title"><h2>A better understanding.<br />A stronger challenge.</h2><span className={`report-source ${source === 'gemini' ? 'real' : ''}`}>{source === 'gemini' ? 'Gemini AI' : 'Demo guide'}</span></div><p className="report-section-description">A few relevant details help the right teams understand what your community needs.</p>{busy === 'analysis' || busy === 'summary' ? <div className="report-analyzing"><span className="report-ai-orb"><Sparkles size={30} /></span><h3>{busy === 'summary' ? 'Putting your challenge together…' : 'Understanding your report…'}</h3><p>Organizing the context, evidence, and details you’ve shared.</p><div className="report-typing"><i /><i /><i /></div></div> : <>{analysis && <div className="report-ai-understanding"><Sparkles size={18} /><div><strong>{source === 'gemini' ? 'AI-generated understanding' : 'Demo understanding · rule-based guidance'}</strong><p>{analysis.summary || `You’re reporting a ${analysis.category?.toLowerCase() || 'community'} challenge in ${values.district}.`}</p></div></div>}{history.length > 0 && <div className="report-conversation">{history.map(item => <div key={item.id}><span>{item.question}</span><p><Check size={13} />{item.answer}</p></div>)}</div>}{question ? <motion.div key={question.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="report-question"><span>QUESTION {history.length + 1}</span><h3>{question.question}</h3>{question.options?.length ? <div className="report-question-options">{question.options.map(option => { const label = typeof option === 'string' ? option : option.label || option.value; return <button type="button" key={label} className={answer === label ? 'selected' : ''} onClick={() => setAnswer(label)}><span>{answer === label && <Check size={11} />}</span>{label}</button>; })}</div> : <input type={question.type === 'number' ? 'number' : 'text'} min={question.type === 'number' ? 0 : undefined} aria-label={question.question} placeholder={question.type === 'number' ? 'Enter an approximate number' : 'Share what you know…'} value={answer} onChange={event => setAnswer(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !busy) answerQuestion(); }} />}<div className="report-question-actions">{history.length > 0 && <button type="button" onClick={editPreviousAnswer} disabled={!!busy}><ArrowLeft size={12} />Previous answer</button>}<button type="button" onClick={() => answerQuestion(true)} disabled={!!busy}>I’m not sure — skip</button></div></motion.div> : <div className="report-question"><h3>{analysis ? 'We have enough context to prepare your report.' : 'Ready to understand your report.'}</h3><button type="button" className="report-primary" onClick={analysis ? () => finishInterview() : beginInterview} disabled={!!busy}>{analysis ? 'Prepare review' : 'Try analysis again'}<ArrowRight size={15} /></button></div>}{busy === 'question' && <div className="report-question-loading"><LoaderCircle size={15} className="spin" />Preparing the next relevant question…</div>}<p className="report-ai-disclaimer">{source === 'gemini' ? 'AI-generated information can be incomplete. You’ll review and edit every detail before submitting.' : 'Demo mode uses transparent, category-specific rules. Connect Gemini on the server to enable AI analysis.'}</p></>}</>}
          {step === 4 && <><div className="report-section-icon"><FileCheck2 size={23} /></div><h2>One last look. Then let’s make change.</h2><p className="report-section-description">This is your report. Review the details and edit anything that needs a little more context.</p><div className="report-review-source"><Sparkles size={14} />{source === 'gemini' ? 'AI-assisted draft · Please verify the details' : 'Demo-assisted draft · Please verify the details'}</div><label className="report-label" htmlFor="review-title">Challenge title <span>*</span><input id="review-title" {...register('title')} /></label><label className="report-label" htmlFor="review-summary">Problem summary<textarea id="review-summary" rows={4} {...register('summary')} /></label><div className="report-review-grid"><label className="report-label" htmlFor="review-category">Category<select id="review-category" {...register('category')}>{[...new Set([...CATEGORIES, values.category].filter(Boolean))].map(item => <option key={item}>{item}</option>)}</select></label><label className="report-label" htmlFor="review-population">Estimated people affected<input id="review-population" type="number" min="0" {...register('affectedPopulation')} placeholder="Approximate, if known" /></label><label className="report-label" htmlFor="review-priority">Suggested priority<select id="review-priority" {...register('priority')}>{[...new Set(['Low','Medium','High','Critical',values.priority].filter(Boolean))].map(item => <option key={item}>{item}</option>)}</select></label><label className="report-label" htmlFor="review-severity">Suggested severity<select id="review-severity" {...register('severity')}>{[...new Set(['Low','Medium','High','Critical',values.severity].filter(Boolean))].map(item => <option key={item}>{item}</option>)}</select></label></div><div className="report-review-location"><MapPin size={19} /><div><strong>{values.district}, Jharkhand</strong><p>{location?.address || `${Number(location?.latitude).toFixed(5)}, ${Number(location?.longitude).toFixed(5)}`}</p><span><Check size={12} />Location confirmed</span></div><button type="button" onClick={() => go(2)}>Edit</button></div>{evidence.length > 0 && <div className="report-review-evidence"><span>{evidence.length} evidence {evidence.length === 1 ? 'file' : 'files'} attached</span><div>{evidence.map(item => <div key={item.id}><MediaPreview media={item} controls={false} /><span>{item.name}</span></div>)}</div></div>}<details className="report-review-details"><summary>View original report & interview answers</summary><p>{values.description}</p>{history.map(item => <div key={item.id}><strong>{item.question}</strong><p>{item.answer}</p></div>)}</details>{analysis?.observations?.length > 0 && <details className="report-review-details"><summary>View assistant observations — unverified</summary>{analysis.observations.map((item, index) => <p key={index}>{typeof item === 'string' ? item : item.observation || item.description || JSON.stringify(item)}</p>)}</details>}<div className="report-submission-note"><ShieldCheck size={18} /><p>Your challenge will be sent to the relevant review team. Suggested priority, severity, and impact estimates are subject to verification.</p></div></>}
        </motion.div></AnimatePresence>{error && <div className="report-error" role="alert">{error}</div>}<footer className="report-form-footer"><button type="button" className="report-back" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0 || !!busy}><ArrowLeft size={16} />Back</button><span className="report-footer-hint">{step === 0 ? 'A few minutes can make a difference.' : step === 4 ? 'Ready to make a difference?' : 'You’re one step closer.'}</span><button type="button" className="report-primary" onClick={nextStep} disabled={!!busy}>{busy ? <LoaderCircle size={17} className="spin" /> : null}{busy === 'submit' ? 'Submitting…' : step === 4 ? 'Submit challenge' : step === 2 ? 'Understand my report' : step === 3 ? question ? 'Next question' : 'Review report' : 'Continue'}{!busy && <ArrowRight size={16} />}</button></footer></div><div className="report-under-card"><ShieldCheck size={13} />Secure, transparent, and built for your community.<span>JHARKHAND INNOVATION</span></div></main>
    </div></div>;
}
