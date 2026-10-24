import test from 'node:test';
import assert from 'node:assert/strict';
import { transition, milestoneStatus, safeUrl, SCHEMA_VERSION } from '../dist/domain.js';
import { createSeed } from '../dist/seed.js';

function scenario() {
  let state = { version: SCHEMA_VERSION, users: createSeed().users, projects: [], records: [] };
  const act = (actor, command, input = {}) => {
    const result = transition(state, actor, command, { projectId: state.projects[0]?.id, milestoneId: state.projects[0]?.milestones[0]?.id, ...input });
    state = result.state;
    return state;
  };
  const post = () => act('business-1', 'post', { title: 'Customer research', description: 'Understand customer needs and present a focused plan.', category: 'Strategy', skills: 'Research, Strategy', duration: '2 weeks', milestone: 'Research findings', dueDate: '2026-11-15' });
  const apply = (student = 'student-1') => act(student, 'apply', { pitch: 'I can help with interviews and analysis.' });
  const select = () => act('business-1', 'select', { applicationId: state.projects[0].applications[0].id });
  const staff = () => { post(); apply(); select(); act('business-1', 'assign', { mentorId: 'mentor-1' }); };
  const submit = (input = {}) => act('student-1', 'submit', { url: 'https://example.com/research', notes: 'Five interviews, a synthesis, and three recommendations.', ...input });
  const evaluate = (decision = 'approved', input = {}) => act('mentor-1', 'evaluate', { rating: 4, feedback: 'Clear, actionable research.', decision, ...input });
  const approve = (decision = 'approved', input = {}) => act('business-1', 'approve', { feedback: 'This addresses the brief.', decision, ...input });
  return { act, post, apply, select, staff, submit, evaluate, approve, get state() { return state; }, get project() { return state.projects[0]; } };
}

test('the complete lifecycle creates exactly one evidence-backed experience record', () => {
  const demo = scenario();
  demo.staff();
  assert.equal(demo.project.status, 'active');
  assert.equal(demo.project.studentId, 'student-1');
  assert.equal(demo.project.mentorId, 'mentor-1');
  demo.submit();
  assert.equal(milestoneStatus(demo.project.milestones[0]), 'mentor_review');
  demo.evaluate();
  assert.equal(milestoneStatus(demo.project.milestones[0]), 'client_review');
  assert.equal(demo.state.records.length, 0);
  demo.approve();
  assert.equal(demo.project.status, 'completed');
  assert.equal(demo.state.records.length, 1);
  const record = demo.state.records[0];
  assert.equal(record.rating, 4);
  assert.equal(record.studentId, demo.project.studentId);
  assert.equal(record.evidence[0].evaluation.mentorId, 'mentor-1');
  assert.equal(record.evidence[0].approval.clientId, 'business-1');
  assert.equal(record.verification, 'demo-workflow-only');
  assert.throws(() => demo.approve(), /locked/);
  assert.throws(() => demo.submit(), /locked/);
  assert.throws(() => demo.act('business-1', 'addMilestone', { title: 'Extra', dueDate: '2026-12-01' }), /locked/);
  assert.equal(demo.state.records.length, 1);
});

test('one student is selected; all other applications close and cannot replace the student', () => {
  const demo = scenario();
  demo.post(); demo.apply(); demo.apply('student-2');
  assert.throws(() => demo.apply(), /already applied/);
  demo.select();
  assert.deepEqual(demo.project.applications.map(application => application.status), ['accepted', 'not_selected']);
  assert.equal(demo.project.status, 'matching');
  assert.throws(() => demo.act('business-1', 'select', { applicationId: demo.project.applications[1].id }), /already been selected/);
  assert.throws(() => demo.apply('student-2'), /closed/);
});

test('a student must be selected before assigning one valid supervisor and starting work', () => {
  const demo = scenario(); demo.post();
  assert.throws(() => demo.act('business-1', 'assign', { mentorId: 'mentor-1' }), /Select a student/);
  demo.apply(); demo.select();
  assert.throws(() => demo.submit(), /one student and one supervisor/);
  assert.throws(() => demo.act('business-1', 'assign', { mentorId: 'student-2' }), /Choose a supervisor/);
  demo.act('business-1', 'assign', { mentorId: 'mentor-1' });
  assert.throws(() => demo.act('business-1', 'assign', { mentorId: 'mentor-2' }), /Select a student/);
  assert.equal(demo.project.mentorId, 'mentor-1');
});

test('role and assignment checks reject actions from the wrong account', () => {
  const demo = scenario(); demo.staff();
  assert.throws(() => demo.act('student-2', 'submit', { url: 'https://example.com', notes: 'test' }), /selected student/);
  assert.throws(() => demo.act('mentor-1', 'apply', { pitch: 'test' }), /Only students/);
  assert.throws(() => demo.act('student-1', 'post', {}), /Only a business/);
  assert.throws(() => demo.act('student-1', 'select', {}), /project owner/);
  assert.throws(() => demo.act('student-1', 'assign', {}), /project owner/);
  assert.throws(() => demo.act('mentor-1', 'addMilestone', {}), /project owner/);
  demo.submit();
  assert.throws(() => demo.act('mentor-2', 'evaluate', { decision: 'approved', rating: 5, feedback: 'fine' }), /assigned supervisor/);
  assert.throws(() => demo.act('student-1', 'approve', { decision: 'approved', feedback: 'fine' }), /project owner/);
  const otherBusiness = structuredClone(demo.state);
  otherBusiness.users.push({ id: 'business-2', role: 'business', name: 'Another owner' });
  assert.throws(() => transition(otherBusiness, 'business-2', 'approve', { projectId: demo.project.id, milestoneId: demo.project.milestones[0].id }), /project owner/);
});

test('client approval cannot skip supervisor review or use a rejected evaluation', () => {
  const demo = scenario(); demo.staff();
  assert.throws(() => demo.approve(), /Supervisor approval is required/);
  assert.throws(() => demo.evaluate(), /new submission/);
  demo.submit();
  assert.throws(() => demo.approve(), /Supervisor approval is required/);
  assert.throws(() => demo.submit(), /already submitted/);
  demo.evaluate('changes_requested');
  assert.throws(() => demo.approve(), /Supervisor approval is required/);
  assert.equal(demo.state.records.length, 0);
});

test('supervisor-requested revisions preserve history and must pass fresh reviews', () => {
  const demo = scenario(); demo.staff(); demo.submit(); demo.evaluate('changes_requested');
  demo.submit({ notes: 'Added the missing interview findings.' });
  assert.equal(demo.project.milestones[0].submissions.length, 2);
  assert.equal(demo.project.milestones[0].submissions[0].evaluation.decision, 'changes_requested');
  assert.equal(demo.project.milestones[0].submissions[1].evaluation, null);
  assert.throws(() => demo.approve(), /Supervisor approval is required/);
  demo.evaluate(); demo.approve();
  assert.equal(demo.state.records[0].evidence[0].notes, 'Added the missing interview findings.');
});

test('client-requested revisions also return to supervisor review', () => {
  const demo = scenario(); demo.staff(); demo.submit(); demo.evaluate(); demo.approve('changes_requested');
  assert.equal(milestoneStatus(demo.project.milestones[0]), 'changes_requested');
  demo.submit({ url: 'https://example.com/research-v2' });
  assert.equal(milestoneStatus(demo.project.milestones[0]), 'mentor_review');
  assert.throws(() => demo.approve(), /Supervisor approval is required/);
  demo.evaluate(); demo.approve();
  assert.equal(demo.project.milestones[0].submissions[0].approval.decision, 'changes_requested');
  assert.equal(demo.state.records[0].evidence[0].url, 'https://example.com/research-v2');
});

test('all checkpoints must be approved; the plan locks at the first submission', () => {
  const demo = scenario(); demo.staff();
  demo.act('business-1', 'addMilestone', { title: 'Handover', dueDate: '2026-11-20' });
  demo.submit();
  assert.throws(() => demo.act('business-1', 'addMilestone', { title: 'Late scope', dueDate: '2026-11-22' }), /plan is locked/);
  demo.evaluate(); demo.approve();
  assert.equal(demo.project.status, 'active');
  assert.equal(demo.state.records.length, 0);
  const milestoneId = demo.project.milestones[1].id;
  demo.submit({ milestoneId }); demo.evaluate('approved', { milestoneId, rating: 5 }); demo.approve('approved', { milestoneId });
  assert.equal(demo.state.records[0].evidence.length, 2);
  assert.equal(demo.state.records[0].rating, 4.5);
});

test('invalid data is rejected without mutating the existing state', () => {
  const demo = scenario(); demo.staff();
  const before = structuredClone(demo.state);
  assert.throws(() => demo.submit({ url: 'javascript:alert(1)' }), /deliverable link/);
  assert.throws(() => demo.submit({ notes: '   ' }), /notes is required/);
  assert.deepEqual(demo.state, before);
  assert.throws(() => demo.act('business-1', 'addMilestone', { title: 'Bad date', dueDate: '2026-02-31' }), /valid due date/);
  demo.submit();
  for (const rating of [0, 6, 2.5, 'wrong']) assert.throws(() => demo.evaluate('approved', { rating }), /score from 1 to 5/);
  assert.throws(() => demo.evaluate('unknown'), /evaluation decision/);
  assert.throws(() => demo.evaluate('approved', { feedback: ' ' }), /feedback is required/);
  assert.equal(demo.project.milestones[0].submissions[0].evaluation, null);
});

test('safe links reject scripts, data, files, and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/demo', 'https://user:password@example.com', 'not a URL']) assert.equal(safeUrl(url), null);
  assert.equal(safeUrl('https://example.com/work'), 'https://example.com/work');
});

test('successful transitions are immutable and records snapshot final evidence', () => {
  const demo = scenario(); demo.staff();
  const before = demo.state;
  demo.submit();
  assert.equal(before.projects[0].milestones[0].submissions.length, 0);
  demo.evaluate(); demo.approve();
  const record = demo.state.records[0];
  assert.notEqual(record.evidence[0].evaluation, demo.project.milestones[0].submissions[0].evaluation);
});

test('seed examples are coherent and cover discovery, work, client review, and experience', () => {
  const state = createSeed();
  assert.equal(state.projects.length, 5);
  assert.equal(state.projects.filter(project => project.status === 'open').length, 2);
  assert.equal(state.records.length, 1);
  assert.ok(state.projects.some(project => project.milestones.some(milestone => milestoneStatus(milestone) === 'client_review')));
  for (const project of state.projects) {
    if (['active', 'completed'].includes(project.status)) {
      assert.ok(project.studentId && project.mentorId);
      assert.equal(project.applications.filter(application => application.status === 'accepted').length, 1);
    }
    if (project.status === 'completed') assert.ok(project.milestones.every(milestone => milestoneStatus(milestone) === 'approved'));
  }
});
