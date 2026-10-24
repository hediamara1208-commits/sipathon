import { SCHEMA_VERSION, transition, person, milestoneStatus, latestSubmission, progress, safeUrl } from './domain.js';
import { createSeed } from './seed.js';

const STORE = 'firststep-demo-v1';
const ACCOUNT = 'firststep-account-v1';
let storageWarning = '';
function readState() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return createSeed();
    const value = JSON.parse(raw);
    if (value.version !== SCHEMA_VERSION || !Array.isArray(value.users) || !value.users.length || !Array.isArray(value.projects) || !Array.isArray(value.records)) throw new Error('Invalid saved data');
    return value;
  } catch {
    storageWarning = 'Saved data could not be loaded. A fresh demo is open; use Reset demo to replace the saved copy.';
    return createSeed();
  }
}
let state = readState();
let actorId = 'student-1';
try { actorId = localStorage.getItem(ACCOUNT) || actorId; } catch { storageWarning = 'Browser storage is unavailable. Changes will last only for this session.'; }
if (!person(state, actorId)) actorId = 'student-1';
let search = '';
let category = 'All projects';
let workspaceFilter = 'All';
let toastTimer;
let modalTrigger;
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const date = value => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const actor = () => person(state, actorId);
const labels = { open: 'Open for applications', matching: 'Needs a mentor', active: 'In progress', completed: 'Completed', not_started: 'Ready to start', mentor_review: 'Mentor review', client_review: 'Client review', changes_requested: 'Changes requested', approved: 'Approved', verified: 'Workflow verified', pending: 'Applied', accepted: 'Selected', not_selected: 'Not selected' };
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c5 4 13 4 18 0M12 12v4"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8m-7-5 2 2 4-4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 3m0 3h.01"/>',
  link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
  leaf: '<path d="M20 3c1 12-3 18-10 16-8-2-7-12 10-16ZM4 21 16 9"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  reset: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.briefcase}</svg>`;
const badge = status => `<span class="badge ${escape(status)}"><span class="status-dot"></span>${escape(labels[status] || status)}</span>`;
const tags = skills => skills.map(skill => `<span class="tag">${escape(skill)}</span>`).join('');
const avatar = (user, small = false) => `<span class="avatar ${escape(user.role)} ${small ? 'small' : ''}" aria-hidden="true">${escape(user.initials)}</span>`;
const button = (text, action, attributes = '', variant = 'primary') => `<button type="button" class="button ${variant}" data-action="${action}" ${attributes}>${text}</button>`;
const owned = project => project.ownerId === actorId;
const related = project => actor().role === 'business' ? owned(project) : actor().role === 'mentor' ? project.mentorId === actorId : project.studentId === actorId || project.applications.some(application => application.studentId === actorId);
const route = () => location.hash.slice(2).split('/');
const projectById = id => state.projects.find(project => project.id === id);
const projectData = project => `data-project="${escape(project.id)}"`;
const milestoneData = (project, milestone) => `${projectData(project)} data-milestone="${escape(milestone.id)}"`;
const empty = (title, description) => `<div class="empty">${icon('leaf')}<h3>${escape(title)}</h3><p>${escape(description)}</p></div>`;

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch { storageWarning = 'Your browser could not save this change. Keep this tab open; changes may be lost on refresh.'; }
}
if (!storageWarning) save();
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 4500);
}
function shell(content, active) {
  const user = actor();
  app.innerHTML = `<a class="skip-link" href="#main" data-action="skip">Skip to content</a>
    <aside class="sidebar">
      <a class="brand" href="#/discover" aria-label="SymbioNet home"><span class="brand-mark"><span></span><span></span><span></span></span>SymbioNet<span class="brand-dot">.</span></a>
      <div class="sidebar-label">YOUR NEXT CHAPTER</div>
      <nav aria-label="Main navigation">${[['discover', 'grid', 'Discover projects'], ['workspace', 'briefcase', 'My workspace'], ['experience', 'award', 'Experience']].map(([id, name, label]) => `<a href="#/${id}" class="nav-link ${active === id ? 'selected' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon(name)}${label}${id === 'workspace' ? `<span class="nav-count">${state.projects.filter(related).filter(project => project.status !== 'completed').length}</span>` : ''}</a>`).join('')}</nav>
      <div class="sidebar-note"><span class="tiny-star">✳</span><h3>Small steps.<br>Real possibilities.</h3><p>Build skills that go beyond the classroom.</p></div>
      <div class="sidebar-bottom"><a href="#/guide" class="nav-link ${active === 'guide' ? 'selected' : ''}">${icon('help')}How SymbioNet works</a><div class="sidebar-profile">${avatar(user, true)}<div><strong>${escape(user.name)}</strong><span>${escape(user.role)} account</span></div></div></div>
    </aside>
    <div class="page-shell"><header class="topbar"><span class="topbar-title">A little ambition goes a long way.</span><div class="account-control"><span class="demo-label"><span></span>DEMO</span><label for="account">Viewing as</label><select id="account" aria-label="Switch demo account">${state.users.map(account => `<option value="${account.id}" ${account.id === actorId ? 'selected' : ''}>${escape(account.name)} · ${account.role}</option>`).join('')}</select></div></header>
    <main id="main" tabindex="-1">${storageWarning ? `<div class="notice warning" role="alert">${escape(storageWarning)}</div>` : ''}${content}</main>
    <footer><span>SymbioNet · A little experience changes everything.</span><span><a href="#/guide">Demo guide</a> · saved in this browser ${button('Reset demo', 'reset', '', 'text-button')}</span></footer></div>`;
}

function projectCard(project) {
  const user = person(state, project.ownerId);
  const application = project.applications.find(candidate => candidate.studentId === actorId);
  return `<a class="project-card" href="#/project/${escape(project.id)}">
    <div class="card-top"><span class="project-symbol ${escape(project.category.toLowerCase())}">${icon(project.category === 'Strategy' ? 'leaf' : project.category === 'Data' ? 'grid' : 'people')}</span>${badge(project.status)}</div>
    <div class="company">${escape(user.company)}<span>↗</span></div><h3>${escape(project.title)}</h3><p class="card-description">${escape(project.description)}</p>
    <div class="tags">${tags(project.skills.slice(0, 3))}</div>
    <div class="card-meta"><span>${icon('clock')}${escape(project.duration)}</span></div>
    <div class="card-footer">${project.status === 'open' ? `<span>${icon('people')}${project.applications.length} applicant${project.applications.length === 1 ? '' : 's'}</span><strong>${application ? escape(labels[application.status]) : 'Explore project'} ${icon('arrow')}</strong>` : `<span>${progress(project)} / ${project.milestones.length} milestones approved</span><strong>Open workspace ${icon('arrow')}</strong>`}</div>
  </a>`;
}

function renderCards() {
  const grid = document.querySelector('#project-grid');
  if (!grid) return;
  const workspace = route()[0] === 'workspace';
  const projects = state.projects.filter(project => workspace ? related(project) : project.status === 'open')
    .filter(project => workspace ? workspaceFilter === 'All' || (workspaceFilter === 'Completed' ? project.status === 'completed' : project.status !== 'completed') : category === 'All projects' || project.category === category)
    .filter(project => `${project.title} ${project.description} ${project.skills.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  grid.innerHTML = projects.length ? projects.map(projectCard).join('') : empty('A new opportunity is ahead', workspace ? 'Your applications and assigned projects will appear here.' : 'Try another search or category. Businesses can also post a new project.');
  const count = document.querySelector('#result-count');
  if (count) count.textContent = `${projects.length} project${projects.length === 1 ? '' : 's'}`;
}

function listing(workspace = false) {
  const user = actor();
  const mine = state.projects.filter(related);
  const awaiting = mine.flatMap(project => project.milestones).filter(milestone => milestoneStatus(milestone) === (user.role === 'business' ? 'client_review' : user.role === 'mentor' ? 'mentor_review' : 'changes_requested')).length;
  shell(`<div class="page-heading"><div><p class="eyebrow">LET'S MAKE SOMETHING HAPPEN</p><h1>${workspace ? 'Your work, moving forward.' : `Your next step starts here${user.role === 'student' ? ', ' + escape(user.name.split(' ')[0]) : ''}.`}</h1><p>${workspace ? 'From the first introduction to the final handover. Everything in one place.' : 'Meaningful projects. A mentor in your corner. Experience you can build on.'}</p></div>${user.role === 'business' ? button(icon('plus') + ' Post a project', 'post') : ''}</div>
    ${workspace ? `<div class="stats"><div><span>Active projects</span><strong>${mine.filter(project => project.status === 'active').length}</strong></div><div><span>${user.role === 'student' ? 'Revisions to make' : 'Reviews waiting'}</span><strong>${awaiting}</strong></div><div><span>Completed projects</span><strong>${mine.filter(project => project.status === 'completed').length}</strong></div></div>` : `<section class="hero"><div class="hero-copy"><span class="hero-label"><span></span>REAL WORK. REAL GROWTH.</span><h2>You bring the potential.<br>We help you take<br>the first step.</h2><p>Take on a real business challenge with expert support,<br class="desktop-only"> and turn what you know into what you've done.</p><a class="button hero-button" href="#/workspace">Explore your workspace ${icon('arrow')}</a><div class="hero-proof"><span class="stacked-avatars">${avatar(state.users[1], true)}${avatar(state.users[3], true)}${avatar(state.users[0], true)}</span><span>One student. One mentor. A shared ambition.</span></div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="floating-note note-top">${icon('award')}<div><strong>More than a line on your CV</strong><span>Experience backed by real work</span></div></div><div class="step step-one"><span>01</span></div><div class="step step-two"><span>02</span></div><div class="step step-three">${icon('arrow')}<span>03</span></div><div class="spark spark-one">✳</div><div class="spark spark-two">✧</div><div class="floating-note note-bottom"><span class="circle-check">${icon('check')}</span><div><strong>Your potential, in motion.</strong><span>Learn. Contribute. Grow.</span></div></div></div></section>`}
    <section class="projects-section"><div class="section-heading"><div><h2>${workspace ? 'Your projects' : 'Find your kind of challenge'} <span id="result-count" class="count-label"></span></h2><p>${workspace ? 'Pick up where you left off.' : 'Small, focused projects with room to make a real difference.'}</p></div><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="Search projects or skills" aria-label="Search projects or skills" value="${escape(search)}"></label></div>
    <div class="filters" aria-label="Filter projects">${(workspace ? ['All', 'In progress', 'Completed'] : ['All projects', 'Strategy', 'Design', 'Data']).map(value => `<button class="filter ${(workspace ? workspaceFilter : category) === value ? 'active' : ''}" data-action="filter" data-value="${value}" aria-pressed="${(workspace ? workspaceFilter : category) === value}">${value}</button>`).join('')}<span class="filter-hint">${icon('people')}One student + one mentor per project</span></div><div id="project-grid" class="project-grid"></div></section>
    ${!workspace ? `<section class="how-strip"><div><span>01</span><div><strong>Find your project</strong><p>A challenge that meets your curiosity.</p></div></div><div><span>02</span><div><strong>Make it happen</strong><p>Real work, with a mentor alongside.</p></div></div><div><span>03</span><div><strong>Own your experience</strong><p>Work reviewed. Contribution recognized.</p></div></div></section>` : ''}`, workspace ? 'workspace' : 'discover');
  renderCards();
}

function teamMember(id, label) {
  const user = person(state, id);
  return `<div class="team-member">${user ? avatar(user) : '<span class="avatar vacant">?</span>'}<div><span class="eyebrow">${label}</span><strong>${user ? escape(user.name) : 'Not assigned yet'}</strong><p>${user ? escape(user.company || user.specialty) : label === 'STUDENT' ? 'Selected from applications' : 'Assigned by the business'}</p></div></div>`;
}
function submissionMarkup(submission, index) {
  const url = safeUrl(submission.url);
  return `<div class="submission"><div class="submission-heading"><strong>Submission ${index + 1}</strong><span>${date(submission.submittedAt)}</span></div><p class="preserve">${escape(submission.notes)}</p>${url ? `<a class="external-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${icon('link')} Open deliverable ${icon('arrow')}</a>` : '<p>Deliverable link unavailable.</p>'}
    ${submission.evaluation ? `<div class="review-note"><strong>Mentor · ${submission.evaluation.rating}/5 · ${submission.evaluation.decision === 'approved' ? 'Approved' : 'Changes requested'}</strong><p class="preserve">${escape(submission.evaluation.feedback)}</p><span>${escape(person(state, submission.evaluation.mentorId)?.name)} · ${date(submission.evaluation.createdAt)}</span></div>` : ''}
    ${submission.approval ? `<div class="review-note client"><strong>Client · ${submission.approval.decision === 'approved' ? 'Approved' : 'Changes requested'}</strong><p class="preserve">${escape(submission.approval.feedback)}</p><span>${escape(person(state, submission.approval.clientId)?.name)} · ${date(submission.approval.createdAt)}</span></div>` : ''}</div>`;
}
function milestoneCard(project, milestone, index) {
  const status = milestoneStatus(milestone);
  let action = '';
  if (project.status === 'active') {
    if (project.studentId === actorId && ['not_started', 'changes_requested'].includes(status)) action = button(`${icon('plus')} ${status === 'changes_requested' ? 'Submit revision' : 'Submit deliverable'}`, 'submit', milestoneData(project, milestone));
    if (project.mentorId === actorId && status === 'mentor_review') action = button('Evaluate deliverable ' + icon('arrow'), 'evaluate', milestoneData(project, milestone));
    if (owned(project) && status === 'client_review') action = button('Review & approve ' + icon('arrow'), 'approve', milestoneData(project, milestone));
  }
  return `<article class="milestone"><div class="milestone-top"><span class="milestone-number ${status === 'approved' ? 'done' : ''}">${status === 'approved' ? icon('check') : String(index + 1).padStart(2, '0')}</span><div><h3>${escape(milestone.title)}</h3><span class="muted">Due ${date(milestone.dueDate)}</span></div>${badge(status)}</div>
    ${milestone.submissions.length ? submissionMarkup(latestSubmission(milestone), milestone.submissions.length - 1) : `<p class="milestone-empty">${project.status === 'active' ? 'A clear next step. Submit your work when it is ready for mentor review.' : 'Work begins once a student and mentor are assigned.'}</p>`}
    ${milestone.submissions.length > 1 ? `<details class="history"><summary>View ${milestone.submissions.length - 1} earlier submission${milestone.submissions.length > 2 ? 's' : ''}</summary>${milestone.submissions.slice(0, -1).map(submissionMarkup).join('')}</details>` : ''}
    ${action ? `<div class="milestone-actions">${action}</div>` : ''}</article>`;
}
function applicationsSection(project) {
  if (!owned(project)) {
    const application = project.applications.find(candidate => candidate.studentId === actorId);
    if (application) return `<section class="panel application-status"><h2>Your application ${badge(application.status)}</h2><p class="preserve">${escape(application.pitch)}</p><p class="muted">${application.status === 'pending' ? 'The business will select one student. Your application is in the running.' : application.status === 'accepted' ? 'You have been selected for this project.' : 'The business selected another student for this project.'}</p></section>`;
    return '';
  }
  return `<section class="panel"><div class="section-heading compact"><h2>Applications <span class="count-label">${project.applications.length}</span></h2></div>${project.applications.length ? project.applications.map(application => {
    const student = person(state, application.studentId);
    return `<div class="application"><div class="application-person">${avatar(student)}<div><strong>${escape(student.name)}</strong><p>${escape(student.specialty)}</p></div>${badge(application.status)}</div><p class="preserve">${escape(application.pitch)}</p><div class="tags">${tags(student.skills)}</div>${project.status === 'open' ? button('Select this student ' + icon('arrow'), 'select', `${projectData(project)} data-application="${application.id}"`, 'secondary') : ''}</div>`;
  }).join('') : '<p class="muted">No applications yet. Switch to a student account to apply.</p>'}</section>`;
}
function projectView(id) {
  const project = projectById(id);
  if (!project) { shell(empty('Project not found', 'This project may have been removed when the demo was reset. Return to Discover projects.'), 'workspace'); return; }
  const application = project.applications.some(candidate => candidate.studentId === actorId);
  const nextStep = project.status === 'open' ? 'Students apply. The business selects one person.' : project.status === 'matching' ? 'Your student is selected. Assign a mentor to start the project.' : project.status === 'completed' ? 'Every milestone is approved. The experience record is ready.' : 'Submit each milestone, get mentor feedback, then client approval.';
  const phase = project.status === 'open' ? 0 : project.status === 'matching' ? 1 : project.status === 'completed' ? 4 : project.milestones.some(milestone => ['mentor_review', 'client_review', 'approved'].includes(milestoneStatus(milestone))) ? 3 : 2;
  shell(`<a class="back-link" href="#/workspace">${icon('back')} Back to workspace</a><div class="project-heading"><div><div class="company">${escape(person(state, project.ownerId).company)}<span>· ${escape(project.category)}</span></div><h1>${escape(project.title)}</h1><div class="project-subtitle">${badge(project.status)}<span>${icon('clock')}${escape(project.duration)}</span></div></div>${project.status === 'open' && actor().role === 'student' && !application ? button('Apply for this project ' + icon('arrow'), 'apply', projectData(project)) : ''}${project.status === 'completed' ? '<a class="button primary" href="#/experience">View experience record ' + icon('award') + '</a>' : ''}</div>
    <ol class="lifecycle">${['Applications', 'Team matched', 'Project work', 'Review & approval', 'Experience earned'].map((label, index) => `<li class="${index <= phase ? 'reached' : ''}" ${index === phase ? 'aria-current="step"' : ''}><span>${index < phase ? icon('check') : index + 1}</span>${label}</li>`).join('')}</ol>
    <div class="notice next-step">${icon('arrow')}<span>${nextStep}</span>${project.status === 'matching' && owned(project) ? button('Assign mentor', 'assign', projectData(project)) : ''}</div>
    <div class="detail-layout"><div class="detail-main"><section class="panel"><p class="eyebrow">THE CHALLENGE</p><h2>A little context goes a long way.</h2><p class="brief preserve">${escape(project.description)}</p><div class="tags">${tags(project.skills)}</div></section>${applicationsSection(project)}
    <section><div class="section-heading"><div><h2>Milestones</h2><p>${progress(project)} of ${project.milestones.length} approved · one clear step at a time.</p></div>${owned(project) && project.status !== 'completed' && project.milestones.every(milestone => !milestone.submissions.length) ? button(icon('plus') + ' Add milestone', 'addMilestone', projectData(project), 'secondary') : ''}</div><div class="milestones">${project.milestones.map((milestone, index) => milestoneCard(project, milestone, index)).join('')}</div></section></div>
    <aside class="detail-aside"><section class="panel"><h2>Your project team</h2>${teamMember(project.ownerId, 'BUSINESS')}${teamMember(project.studentId, 'STUDENT')}${teamMember(project.mentorId, 'MENTOR')}<div class="team-footnote">${icon('people')}One student. One mentor. Shared progress.</div></section><section class="panel"><h2>The progress you're making</h2><progress max="${project.milestones.length}" value="${progress(project)}" aria-label="Approved milestones"></progress><p class="muted">${progress(project)} of ${project.milestones.length} milestones approved</p><p class="small-text">Every deliverable is reviewed by your mentor, then approved by the business.</p></section><section class="panel"><h2>Activity</h2><ol class="activity">${project.activity.slice(0, 8).map(event => `<li><span></span><div><strong>${escape(event.message)}</strong><p>${escape(person(state, event.actorId)?.name)} · ${date(event.createdAt)}</p></div></li>`).join('')}</ol></section></aside></div>`, 'workspace');
}

function experienceView() {
  const records = state.records.filter(record => [record.studentId, record.mentorId, record.clientId].includes(actorId));
  shell(`<div class="page-heading"><div><p class="eyebrow">YOUR WORK TELLS A STORY</p><h1>Experience you can point to.</h1><p>Real contributions, reviewed by a mentor and approved by the business.</p></div></div><div class="notice">${icon('award')}<span>Demo verification follows the approval workflow. These records are illustrative, not independently certified credentials.</span></div><div class="experience-list">${records.length ? records.map(record => `<article class="experience-card"><div class="record-banner"><span class="record-mark">${icon('award')}</span><span>SYMBIONET EXPERIENCE RECORD</span>${badge('verified')}</div><div class="record-content"><p class="eyebrow">AWARDED TO ${escape(person(state, record.studentId).name.toUpperCase())}</p><h2>${escape(record.projectTitle)}</h2><p>${escape(person(state, record.clientId).company)} · Completed ${date(record.issuedAt)}</p><div class="tags">${tags(record.skills)}</div><div class="record-facts"><div><span>Mentor evaluation</span><strong>${record.rating.toFixed(1)} <small>/ 5</small></strong></div><div><span>Approved milestones</span><strong>${record.evidence.length} <small>/ ${record.evidence.length}</small></strong></div><div><span>Reviewed by</span><strong class="reviewer">${escape(person(state, record.mentorId).name)}</strong></div></div><details><summary>See evidence & approvals</summary>${record.evidence.map(submissionMarkup).join('')}</details><div class="record-footer"><span>Record ${escape(record.id.slice(0, 19))}…</span><div><a class="button secondary" href="#/project/${record.projectId}">View project</a>${button(icon('download') + ' Export record', 'export', `data-record="${record.id}"`)}</div></div></div></article>`).join('') : empty('Your story is still being written', 'Finish a project with mentor evaluations and client approvals to earn an experience record.')}</div>`, 'experience');
}
function guideView() {
  shell(`<div class="page-heading"><div><p class="eyebrow">A QUICK WALKTHROUGH</p><h1>From potential to proof.</h1><p>Try every part of SymbioNet by switching accounts in the top-right corner.</p></div></div><div class="guide-grid"><section class="panel"><h2>Try the full journey</h2><ol class="guide-steps"><li><strong>Alex · business</strong><p>Post a project with a brief, skills, and its first milestone.</p></li><li><strong>Maya or Noah · student</strong><p>Discover the project and submit an application.</p></li><li><strong>Alex · business</strong><p>Select one applicant, then assign Sofia or Daniel as the mentor. Add any remaining milestones before the first submission.</p></li><li><strong>The selected student</strong><p>Open My workspace and submit a deliverable link and notes for each milestone.</p></li><li><strong>The assigned mentor</strong><p>Evaluate the work with a score and feedback. Approve it or request a revision.</p></li><li><strong>Alex · business</strong><p>Approve mentor-reviewed work or ask for changes. A revision must pass mentor review again.</p></li><li><strong>The selected student</strong><p>When all milestones are approved, open Experience to view and export the record.</p></li></ol></section><div><section class="panel"><h2>Start in the middle, too.</h2><p>The demo includes two open opportunities, an active data project, a design project awaiting client approval, and a completed strategy project.</p><p>Try <strong>Make our impact visible</strong> as Maya, or <strong>A clearer welcome for new customers</strong> as Alex.</p><a class="button primary" href="#/workspace">Go to your workspace ${icon('arrow')}</a></section><section class="panel demo-info"><h2>What is simulated?</h2><ul><li>Accounts are a role switcher, not real sign-in.</li><li>Data is saved in this browser only; it is not shared between people or devices.</li><li>Deliverables are links. Files are not uploaded. Seeded example.com links are illustrative.</li><li>Mentor selection is manual. There are no messages, payments, or email notifications.</li><li>Experience records prove this demo's approval sequence, not real identity or independently verified work.</li></ul><p>Reset demo restores the examples and removes your local changes.</p>${button(icon('reset') + ' Reset demo', 'reset', '', 'secondary')}</section></div></div>`, 'guide');
}
function render() {
  const [page, id] = route();
  if (page === 'project') projectView(id);
  else if (page === 'workspace') listing(true);
  else if (page === 'experience') experienceView();
  else if (page === 'guide') guideView();
  else listing();
  document.title = `${page === 'project' ? projectById(id)?.title || 'Project' : { workspace: 'My workspace', experience: 'Experience', guide: 'How it works' }[page] || 'Discover projects'} · SymbioNet`;
}

function field(label, name, options = {}) {
  const { type = 'text', placeholder = '', value = '', max = 2000 } = options;
  return `<label class="field"><span>${label}</span>${type === 'textarea' ? `<textarea name="${name}" rows="4" maxlength="${max}" placeholder="${placeholder}" required>${escape(value)}</textarea>` : `<input name="${name}" type="${type}" maxlength="${max}" placeholder="${placeholder}" value="${escape(value)}" required>`}</label>`;
}
function showDialog(title, content, command, data = '', submitLabel = 'Save') {
  modalTrigger = document.activeElement;
  modal.innerHTML = `<form data-command="${command}" ${data}><div class="modal-heading"><h2 id="modal-title">${title}</h2><button class="icon-button" type="button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${content}<p id="form-error" role="alert"></p></div><div class="modal-footer">${button('Cancel', 'close', '', 'secondary')}<button class="button primary" type="submit">${submitLabel} ${icon('arrow')}</button></div></form>`;
  modal.showModal();
}
function closeDialog() { modal.close(); modalTrigger?.focus(); }
function openAction(action, data) {
  const project = projectById(data.project);
  const ids = project ? projectData(project) + (data.milestone ? ` data-milestone="${escape(data.milestone)}"` : '') : '';
  const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  if (action === 'post') showDialog('A new opportunity starts here.', `<p class="muted">Give one student a focused challenge and the support to make it happen.</p>${field('Project title', 'title', { max: 100, placeholder: 'e.g. Help us understand our customers' })}${field('The brief', 'description', { type: 'textarea', placeholder: 'What is the challenge, and what does a good outcome look like?' })}<div class="form-row"><label class="field"><span>Category</span><select name="category"><option>Strategy</option><option>Design</option><option>Data</option></select></label>${field('Time commitment', 'duration', { max: 40, placeholder: '3 weeks · 5 hrs/week' })}</div>${field('Skills, separated by commas', 'skills', { max: 200, placeholder: 'Research, Strategy, Communication' })}<h3>The first milestone</h3>${field('Milestone title', 'milestone', { max: 100, placeholder: 'Research findings & recommendations' })}${field('Due date', 'dueDate', { type: 'date', value: due })}`, 'post', '', 'Publish project');
  else if (action === 'apply') showDialog('Put your hand up.', `<p>Apply for <strong>${escape(project.title)}</strong> as ${escape(actor().name)}.</p>${field('Why is this project a good fit?', 'pitch', { type: 'textarea', placeholder: 'Share your interest, relevant skills, and availability.' })}`, 'apply', ids, 'Send application');
  else if (action === 'select') showDialog('Make the match.', `<p>Select <strong>${escape(person(state, project.applications.find(application => application.id === data.application).studentId).name)}</strong> as this project's one student?</p><p>Applications will close and other applicants will be marked not selected. Next, you will assign a mentor.</p><input type="hidden" name="applicationId" value="${escape(data.application)}">`, 'select', ids, 'Select student');
  else if (action === 'assign') showDialog('A mentor in their corner.', `<p>Choose one mentor to guide the student and evaluate their deliverables.</p><div class="mentor-options">${state.users.filter(user => user.role === 'mentor').map((user, index) => `<label class="mentor-option"><input type="radio" name="mentorId" value="${user.id}" ${index === 0 ? 'checked' : ''}>${avatar(user)}<span><strong>${escape(user.name)}</strong><small>${escape(user.specialty)}</small><span class="tags">${tags(user.skills)}</span></span></label>`).join('')}</div>`, 'assign', ids, 'Assign & start project');
  else if (action === 'addMilestone') showDialog('One more clear step.', `<p class="muted">The milestone plan locks when the first deliverable is submitted.</p>${field('Milestone title', 'title', { max: 100 })}${field('Due date', 'dueDate', { type: 'date', value: due })}`, 'addMilestone', ids, 'Add milestone');
  else if (action === 'submit') showDialog('Let your work do the talking.', `<p class="muted">Share a link your mentor and client can open. Files are not uploaded to SymbioNet.</p>${field('Deliverable link', 'url', { type: 'url', placeholder: 'https://docs.google.com/...' })}${field('What did you deliver?', 'notes', { type: 'textarea', placeholder: 'Summarize your work, explain key decisions, and note anything to review.' })}`, 'submit', ids, 'Submit for review');
  else if (['evaluate', 'approve'].includes(action)) showDialog(action === 'evaluate' ? 'Help good work get better.' : 'The final word on this milestone.', `<p class="muted">${action === 'evaluate' ? 'Evaluate this submission. Approved work moves to the business for review.' : 'Approve the work or request a revision. Every revision returns to mentor review.'}</p><label class="field"><span>Your decision</span><select name="decision"><option value="approved">Approve deliverable</option><option value="changes_requested">Request changes</option></select></label>${action === 'evaluate' ? '<label class="field"><span>Evaluation score</span><select name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Strong</option><option value="3">3 — Meets expectations</option><option value="2">2 — Needs improvement</option><option value="1">1 — Incomplete</option></select></label>' : ''}${field('Feedback', 'feedback', { type: 'textarea', placeholder: 'What worked well? What, if anything, should change?' })}`, action, ids, 'Save review');
  else if (action === 'reset') showDialog('Start fresh?', '<p>This removes your saved projects, applications, and reviews in this browser and restores the original examples.</p>', 'reset', '', 'Reset demo');
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'skip') { event.preventDefault(); document.querySelector('#main').focus(); }
  else if (action === 'close') closeDialog();
  else if (action === 'filter') {
    if (route()[0] === 'workspace') workspaceFilter = target.dataset.value;
    else category = target.dataset.value;
    document.querySelectorAll('.filter').forEach(filter => { const selected = filter === target; filter.classList.toggle('active', selected); filter.setAttribute('aria-pressed', selected); });
    renderCards();
  } else if (action === 'export') {
    const record = state.records.find(candidate => candidate.id === target.dataset.record);
    if (!record) return;
    const exported = { ...record, student: person(state, record.studentId).name, mentor: person(state, record.mentorId).name, business: person(state, record.clientId).company, notice: 'Illustrative demo record. No identity verification, external certification, or cryptographic signature.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `symbionet-${record.id}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Experience record exported.');
  } else openAction(action, target.dataset);
});
document.addEventListener('input', event => { if (event.target.id === 'search') { search = event.target.value; renderCards(); } });
document.addEventListener('change', event => {
  if (event.target.id !== 'account') return;
  actorId = event.target.value;
  try { localStorage.setItem(ACCOUNT, actorId); } catch { storageWarning = 'Browser storage is unavailable. This account selection is temporary.'; }
  search = ''; render(); toast(`Now viewing as ${actor().name} · ${actor().role}`);
});
modal.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const command = form.dataset.command;
  try {
    if (command === 'reset') {
      state = createSeed(); actorId = 'student-1'; storageWarning = ''; search = ''; category = 'All projects'; workspaceFilter = 'All';
      try { localStorage.setItem(ACCOUNT, actorId); } catch { storageWarning = 'Browser storage is unavailable.'; }
      save(); closeDialog(); location.hash = '/discover'; render(); toast('Demo reset. A fresh start.'); return;
    }
    if (!storageWarning) state = readState();
    const input = { ...Object.fromEntries(new FormData(form)), projectId: form.dataset.project, milestoneId: form.dataset.milestone };
    const result = transition(state, actorId, command, input);
    state = result.state; save(); closeDialog(); location.hash = `/project/${result.projectId}`; render();
    const messages = { post: 'Your project is open for applications.', apply: 'Application sent. Your next step is in motion.', select: 'Student selected. Assign a mentor to get started.', assign: 'Your team is ready. Let the project begin.', addMilestone: 'Milestone added.', submit: 'Deliverable sent to your mentor.', evaluate: 'Mentor evaluation saved.', approve: 'Client review saved.' };
    toast(projectById(result.projectId).status === 'completed' ? 'Project complete! Your experience record is ready.' : messages[command]);
  } catch (error) { document.querySelector('#form-error').textContent = error.message; }
});
window.addEventListener('hashchange', () => { if (modal.open) closeDialog(); render(); document.querySelector('#main').focus(); window.scrollTo(0, 0); });
window.addEventListener('storage', event => {
  if (event.key !== STORE) return;
  if (modal.open) closeDialog();
  state = readState(); render(); toast('Demo updated in another tab.');
});
render();
