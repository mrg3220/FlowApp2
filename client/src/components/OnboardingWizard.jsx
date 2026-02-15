import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpApi } from '../api/client';

const STEPS_BY_ROLE = {
  SUPER_ADMIN: [
    { key: 'welcome', title: 'Welcome to FlowApp HQ', description: 'You\'re the Dragon Head. You manage all schools, certify Sifus, and oversee operations.' },
    { key: 'create_school', title: 'Create Your First School', description: 'Navigate to Schools to set up a new school location.' },
    { key: 'manage_branding', title: 'Set Organization Branding', description: 'Go to Branding to define your org\'s colors, logo, and guidelines.' },
    { key: 'review_certs', title: 'Review Certifications', description: 'Check the Certifications page for pending title applications.' },
    { key: 'view_metrics', title: 'View Cross-School Metrics', description: 'Visit the Dashboard to see performance across all schools.' },
  ],
  OWNER: [
    { key: 'welcome', title: 'Welcome, Sifu', description: 'You manage your school\'s operations, students, and events.' },
    { key: 'setup_school', title: 'Set Up School Branding', description: 'Go to Branding to customize your school\'s identity.' },
    { key: 'create_class', title: 'Create Your First Class', description: 'Navigate to Classes to set up class schedules.' },
    { key: 'add_students', title: 'Enroll Students', description: 'Go to your Dashboard to manage student enrollments.' },
    { key: 'create_event', title: 'Create an Event', description: 'Visit Events to set up a tournament, seminar, or party.' },
    { key: 'setup_billing', title: 'Configure Billing', description: 'Set up payment plans and subscription options in Billing.' },
  ],
  STUDENT: [
    { key: 'welcome', title: 'Welcome to FlowApp', description: 'Your martial arts journey starts here. Let\'s get you set up!' },
    { key: 'view_schedule', title: 'Check Your Schedule', description: 'Go to Sessions to see upcoming classes.' },
    { key: 'view_portal', title: 'Explore Student Portal', description: 'Visit My Portal for your attendance, promotions, and progress.' },
    { key: 'browse_events', title: 'Browse Events', description: 'Check out upcoming tournaments, seminars, and workshops.' },
    { key: 'visit_shop', title: 'Visit the Shop', description: 'Get official merchandise and gear.' },
  ],
  INSTRUCTOR: [
    { key: 'welcome', title: 'Welcome, Instructor', description: 'You help teach classes and manage student progress.' },
    { key: 'view_classes', title: 'View Your Classes', description: 'Go to Classes to see your assigned classes.' },
    { key: 'checkin_students', title: 'Check In Students', description: 'Use Check In to record attendance during sessions.' },
    { key: 'training_plans', title: 'Create Training Plans', description: 'Build custom training plans for your students.' },
  ],
  EVENT_COORDINATOR: [
    { key: 'welcome', title: 'Welcome, Event Coordinator', description: 'You manage tournaments, seminars, and all organizational events.' },
    { key: 'create_venue', title: 'Set Up Venues', description: 'Go to Events to create venue locations.' },
    { key: 'create_event', title: 'Create Your First Event', description: 'Set up a tournament, seminar, workshop, or ceremony.' },
    { key: 'manage_tickets', title: 'Manage Tickets', description: 'View ticket sales and registrations for your events.' },
  ],
  MARKETING: [
    { key: 'welcome', title: 'Welcome, Marketing Team', description: 'You manage org-wide branding and merchandise.' },
    { key: 'setup_branding', title: 'Define Brand Guidelines', description: 'Go to Branding to set the org\'s visual identity.' },
    { key: 'manage_shop', title: 'Set Up Official Merch', description: 'Create org-wide products in the Shop.' },
    { key: 'help_articles', title: 'Create Help Content', description: 'Write help articles for users in the Help Center.' },
  ],
  SCHOOL_STAFF: [
    { key: 'welcome', title: 'Welcome, Staff Member', description: 'You help your Sifu manage the school.' },
    { key: 'view_dashboard', title: 'View School Dashboard', description: 'Check the Dashboard for school metrics.' },
    { key: 'manage_students', title: 'Help with Students', description: 'Assist with check-ins, enrollments, and scheduling.' },
  ],
};

export default function OnboardingWizard() {
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const steps = STEPS_BY_ROLE[user?.role] || STEPS_BY_ROLE.STUDENT;

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const progress = await helpApi.getOnboarding();
      setCompletedSteps(progress.map((p) => p.stepKey));
      // Set current step to first incomplete
      const completedKeys = progress.map((p) => p.stepKey);
      const nextIdx = steps.findIndex((s) => !completedKeys.includes(s.key));
      setCurrentStep(nextIdx === -1 ? steps.length : nextIdx);
      // If all complete, don't show
      if (nextIdx === -1) setDismissed(true);
    } catch {
      // First time - no progress yet
    } finally {
      setLoading(false);
    }
  };

  const completeStep = async (stepKey) => {
    try {
      await helpApi.completeStep(stepKey);
      setCompletedSteps((prev) => [...prev, stepKey]);
      setCurrentStep((prev) => prev + 1);
      if (currentStep >= steps.length - 1) {
        setTimeout(() => setDismissed(true), 1500);
      }
    } catch {}
  };

  if (loading || dismissed || !user) return null;

  const progress = (completedSteps.length / steps.length) * 100;
  const step = steps[currentStep];

  if (!step) return null;

  return (
    <div style={{
      position: 'fixed', top: '1rem', right: '1rem', width: '340px',
      backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      zIndex: 9998, overflow: 'hidden', border: '1px solid #e0e0e0',
    }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1rem', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>🎯 Getting Started</span>
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: '0.5rem 1rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#198754', borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Current Step */}
      <div style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{step.title}</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1rem', lineHeight: 1.5 }}>{step.description}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-sm" onClick={() => completeStep(step.key)}>Mark Complete</button>
          {currentStep < steps.length - 1 && (
            <button className="btn btn-sm btn-outline" onClick={() => setCurrentStep((p) => p + 1)}>Skip</button>
          )}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', padding: '0 1rem 0.75rem' }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: completedSteps.includes(s.key) ? '#198754' : i === currentStep ? '#0d6efd' : '#dee2e6',
            cursor: 'pointer',
          }} onClick={() => setCurrentStep(i)} />
        ))}
      </div>
    </div>
  );
}
