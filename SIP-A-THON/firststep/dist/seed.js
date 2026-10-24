import { SCHEMA_VERSION, transition } from './domain.js';

export function createSeed() {
  let state = {
    version: SCHEMA_VERSION,
    users: [
      { id: 'business-1', name: 'Alex Morgan', role: 'business', company: 'Bloom Collective', initials: 'AM', specialty: 'Thoughtful brands. Real-world impact.' },
      { id: 'student-1', name: 'Maya Chen', role: 'student', initials: 'MC', specialty: 'Business & data · CentraleSupélec', skills: ['Data analysis', 'Research', 'Strategy'] },
      { id: 'student-2', name: 'Noah Williams', role: 'student', initials: 'NW', specialty: 'Design & technology · Parsons', skills: ['UX design', 'Figma', 'Research'] },
      { id: 'mentor-1', name: 'Sofia Laurent', role: 'mentor', initials: 'SL', specialty: 'Product strategist · 8 years of experience', skills: ['Strategy', 'Research', 'UX design'] },
      { id: 'mentor-2', name: 'Daniel Park', role: 'mentor', initials: 'DP', specialty: 'Analytics lead · 6 years of experience', skills: ['Data analysis', 'Dashboards', 'Strategy'] }
    ], projects: [], records: []
  };
  const execute = (actor, command, input) => {
    const result = transition(state, actor, command, input);
    state = result.state;
    return result.projectId;
  };
  const dateAhead = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const post = (title, description, category, skills, duration, milestone, days) => execute('business-1', 'post', { title, description, category, skills, duration, milestone, dueDate: dateAhead(days) });
  const staff = (projectId, mentorId) => {
    execute('student-1', 'apply', { projectId, pitch: 'I would love to turn my research and analysis skills into something useful. I can commit six hours per week and share a short progress update every Friday.' });
    execute('business-1', 'select', { projectId, applicationId: state.projects.find(project => project.id === projectId).applications[0].id });
    execute('business-1', 'assign', { projectId, mentorId });
  };
  const completeMilestone = (projectId, milestoneId, mentorId, approveClient = true) => {
    execute('student-1', 'submit', { projectId, milestoneId, url: 'https://example.com/symbionet-demo-deliverable', notes: 'Demo deliverable: a research summary, prioritized recommendations, and a clear handover. This example.com link is illustrative.' });
    execute(mentorId, 'evaluate', { projectId, milestoneId, decision: 'approved', rating: 5, feedback: 'Strong synthesis with clear evidence behind the recommendations. The handover is easy to follow.' });
    if (approveClient) execute('business-1', 'approve', { projectId, milestoneId, decision: 'approved', feedback: 'The work meets the brief and gives our team practical next steps. Thank you!' });
  };

  const completedId = post('Turn customer feedback into a roadmap', 'Help our small team understand what customers need most. Synthesize anonymized survey responses into themes and recommend three product improvements.', 'Strategy', 'Research, Strategy, Data analysis', '2 weeks · 5 hrs/week', 'Research synthesis & recommendations', -5);
  staff(completedId, 'mentor-1');
  completeMilestone(completedId, state.projects.find(project => project.id === completedId).milestones[0].id, 'mentor-1');

  const reviewId = post('A clearer welcome for new customers', 'Audit our welcome journey and map the moments that cause confusion. Deliver a practical onboarding improvement plan for our next launch.', 'Design', 'UX design, Research, Figma', '3 weeks · 4 hrs/week', 'Onboarding audit & improvement plan', 3);
  staff(reviewId, 'mentor-1');
  completeMilestone(reviewId, state.projects.find(project => project.id === reviewId).milestones[0].id, 'mentor-1', false);

  const activeId = post('Make our impact visible', 'Build a simple impact dashboard for our community initiatives. Start with the metrics that matter, then turn a small sample dataset into a clear story the team can use.', 'Data', 'Data analysis, Dashboards, Strategy', '4 weeks · 6 hrs/week', 'Metric map & dashboard outline', 7);
  execute('business-1', 'addMilestone', { projectId: activeId, title: 'Dashboard prototype & handover', dueDate: dateAhead(21) });
  staff(activeId, 'mentor-2');

  const openId = post('Find our next community of customers', 'Explore how an independent, sustainable lifestyle brand can reach a new audience. Interview potential customers, map the landscape, and shape a focused go-to-market recommendation.', 'Strategy', 'Research, Strategy, Communication', '3 weeks · 5 hrs/week', 'Audience research & opportunity map', 14);
  execute('student-2', 'apply', { projectId: openId, pitch: 'I bring a design research perspective and have run five customer interviews for a university project. I would love to help Bloom understand a new community.' });
  post('Design a more useful resource library', 'Help students find the right resources at the right time. Review our current content, sketch a simpler structure, and deliver a clickable low-fidelity prototype.', 'Design', 'UX design, Figma, Research', '2 weeks · 6 hrs/week', 'Library structure & clickable prototype', 14);
  return state;
}
