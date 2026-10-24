export const SCHEMA_VERSION = 1;
export const uid = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
export const latestSubmission = milestone => milestone.submissions.at(-1);
export const milestoneStatus = milestone => {
  const latest = latestSubmission(milestone);
  if (!latest) return 'not_started';
  if (latest.evaluation?.decision === 'changes_requested' || latest.approval?.decision === 'changes_requested') return 'changes_requested';
  if (!latest.evaluation) return 'mentor_review';
  if (!latest.approval) return 'client_review';
  return 'approved';
};
export const progress = project => project.milestones.filter(milestone => milestoneStatus(milestone) === 'approved').length;
export const person = (state, id) => state.users.find(user => user.id === id);
const requireRule = (condition, message) => { if (!condition) throw new Error(message); };
const requiredText = (value, label, maximum = 2000) => {
  requireRule(typeof value === 'string' && value.trim().length > 0, `${label} is required.`);
  requireRule(value.trim().length <= maximum, `${label} must be ${maximum} characters or fewer.`);
  return value.trim();
};
const validDate = value => {
  requireRule(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid due date.');
  const date = new Date(`${value}T12:00:00Z`);
  requireRule(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value, 'Choose a valid due date.');
  return value;
};
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function transition(current, actorId, command, input = {}) {
  const state = structuredClone(current);
  const actor = person(state, actorId);
  requireRule(actor, 'Choose a demo account to continue.');
  const timestamp = new Date().toISOString();
  let project;
  if (command === 'post') {
    requireRule(actor.role === 'business', 'Only a business can post a project.');
    const skills = requiredText(input.skills, 'Skills', 200).split(',').map(skill => skill.trim()).filter(Boolean);
    requireRule(skills.length <= 6, 'Add up to six skills.');
    project = {
      id: uid('project'), ownerId: actor.id, title: requiredText(input.title, 'Project title', 100),
      description: requiredText(input.description, 'Project brief'), category: requiredText(input.category, 'Category', 40),
      skills: [...new Set(skills)], duration: requiredText(input.duration, 'Duration', 40),
      status: 'open', studentId: null, mentorId: null, applications: [],
      milestones: [{ id: uid('milestone'), title: requiredText(input.milestone, 'First checkpoint', 100), dueDate: validDate(input.dueDate), submissions: [] }],
      createdAt: timestamp, activity: []
    };
    state.projects.unshift(project);
  } else {
    project = state.projects.find(candidate => candidate.id === input.projectId);
    requireRule(project, 'Project not found.');
    requireRule(project.status !== 'completed', 'Completed projects are locked.');
    const isOwner = actor.role === 'business' && project.ownerId === actor.id;
    if (command === 'apply') {
      requireRule(actor.role === 'student', 'Only students can apply.');
      requireRule(project.status === 'open', 'Applications have closed.');
      requireRule(!project.applications.some(application => application.studentId === actor.id), 'You have already applied.');
      project.applications.push({ id: uid('application'), studentId: actor.id, pitch: requiredText(input.pitch, 'Your introduction'), status: 'pending', createdAt: timestamp });
    } else if (command === 'select') {
      requireRule(isOwner, 'Only the project owner can select a student.');
      requireRule(project.status === 'open' && !project.studentId, 'A student has already been selected.');
      const selected = project.applications.find(application => application.id === input.applicationId);
      requireRule(selected?.status === 'pending', 'Select a pending application.');
      project.studentId = selected.studentId;
      project.status = 'matching';
      project.applications.forEach(application => { application.status = application.id === selected.id ? 'accepted' : 'not_selected'; });
    } else if (command === 'assign') {
      requireRule(isOwner, 'Only the project owner can assign a supervisor.');
      requireRule(project.status === 'matching' && project.studentId && !project.mentorId, 'Select a student before assigning one supervisor.');
      requireRule(person(state, input.mentorId)?.role === 'mentor', 'Choose a supervisor.');
      project.mentorId = input.mentorId;
      project.status = 'active';
    } else if (command === 'addMilestone') {
      requireRule(isOwner, 'Only the project owner can add checkpoints.');
      requireRule(project.milestones.every(milestone => milestone.submissions.length === 0), 'The checkpoint plan is locked after the first submission.');
      project.milestones.push({ id: uid('milestone'), title: requiredText(input.title, 'Checkpoint title', 100), dueDate: validDate(input.dueDate), submissions: [] });
    } else {
      requireRule(project.status === 'active' && project.studentId && project.mentorId, 'The project needs one student and one supervisor before work starts.');
      const milestone = project.milestones.find(candidate => candidate.id === input.milestoneId);
      requireRule(milestone, 'Checkpoint not found.');
      const latest = latestSubmission(milestone);
      const status = milestoneStatus(milestone);
      if (command === 'submit') {
        requireRule(actor.role === 'student' && actor.id === project.studentId, 'Only the selected student can submit work.');
        requireRule(['not_started', 'changes_requested'].includes(status), 'This checkpoint is already submitted or approved.');
        const url = safeUrl(input.url);
        requireRule(url, 'Use a complete http:// or https:// deliverable link.');
        milestone.submissions.push({ id: uid('submission'), studentId: actor.id, url, notes: requiredText(input.notes, 'Submission notes'), submittedAt: timestamp, evaluation: null, approval: null });
      } else if (command === 'evaluate') {
        requireRule(actor.role === 'mentor' && actor.id === project.mentorId, 'Only the assigned supervisor can evaluate work.');
        requireRule(status === 'mentor_review', 'Only a new submission can be evaluated.');
        requireRule(['approved', 'changes_requested'].includes(input.decision), 'Choose an evaluation decision.');
        const rating = Number(input.rating);
        requireRule(Number.isInteger(rating) && rating >= 1 && rating <= 5, 'Choose a score from 1 to 5.');
        latest.evaluation = { mentorId: actor.id, decision: input.decision, rating, feedback: requiredText(input.feedback, 'Supervisor feedback'), createdAt: timestamp };
      } else if (command === 'approve') {
        requireRule(isOwner, 'Only the project owner can approve work.');
        requireRule(status === 'client_review', 'Supervisor approval is required before client review.');
        requireRule(['approved', 'changes_requested'].includes(input.decision), 'Choose an approval decision.');
        latest.approval = { clientId: actor.id, decision: input.decision, feedback: requiredText(input.feedback, 'Client feedback'), createdAt: timestamp };
        if (project.milestones.every(candidate => milestoneStatus(candidate) === 'approved')) {
          project.status = 'completed';
          project.completedAt = timestamp;
          requireRule(!state.records.some(record => record.projectId === project.id), 'An experience record already exists.');
          state.records.push({
            id: uid('experience'), projectId: project.id, studentId: project.studentId, mentorId: project.mentorId, clientId: project.ownerId,
            projectTitle: project.title, skills: [...project.skills], issuedAt: timestamp,
            rating: project.milestones.reduce((total, candidate) => total + latestSubmission(candidate).evaluation.rating, 0) / project.milestones.length,
            evidence: project.milestones.map(candidate => ({ milestoneId: candidate.id, title: candidate.title, ...structuredClone(latestSubmission(candidate)) })),
            verification: 'demo-workflow-only'
          });
        }
      } else {
        throw new Error('Unknown action.');
      }
    }
  }
  const messages = { post: 'Project published', apply: 'Application submitted', select: 'Student selected', assign: 'Supervisor assigned · project started', addMilestone: 'Checkpoint added', submit: 'Deliverable submitted', evaluate: input.decision === 'approved' ? 'Supervisor approved the deliverable' : 'Supervisor requested changes', approve: input.decision === 'approved' ? 'Client approved the deliverable' : 'Client requested changes' };
  project.activity.unshift({ id: uid('event'), actorId: actor.id, message: messages[command], createdAt: timestamp });
  if (project.status === 'completed') project.activity.unshift({ id: uid('event'), actorId: actor.id, message: 'Project completed · experience record issued', createdAt: timestamp });
  return { state, projectId: project.id };
}
