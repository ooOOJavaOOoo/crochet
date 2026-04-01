'use client';

import type { Step } from '@/app/page';

interface StepIndicatorProps {
  currentStep: Step;
  isGenerating: boolean;
}

const STEPS = [
  { id: 'image', number: 1, label: 'Choose Image' },
  { id: 'settings', number: 2, label: 'Settings' },
  { id: 'generating', number: 3, label: 'Generating' },
  { id: 'preview', number: 4, label: 'Preview' },
  { id: 'buying', number: 5, label: 'Buy' },
];

export default function StepIndicator({ currentStep, isGenerating }: StepIndicatorProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const isCompleted = (stepId: string) => {
    const stepIndex = STEPS.findIndex((s) => s.id === stepId);
    return stepIndex < currentStepIndex;
  };

  return (
    <>
      {/* Desktop version: Show all steps */}
      <div className="sticky top-0 z-40 hidden bg-white/85 backdrop-blur-sm border-b border-[color:var(--border-soft)] px-4 py-3 sm:px-6 lg:px-8 shadow-sm md:block">
        <div className="mx-auto max-w-7xl flex justify-center gap-8">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`
                  flex items-center justify-center h-8 w-8 rounded-full font-semibold text-sm
                  transition-all
                  ${
                    currentStep === step.id
                      ? 'bg-[color:var(--brand-primary)] text-white'
                      : isCompleted(step.id)
                      ? 'bg-[color:var(--brand-primary)] text-white'
                      : 'bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)]'
                  }
                `}
              >
                {isCompleted(step.id) ? '✓' : step.number}
              </div>
              <span
                className={`
                  text-sm font-semibold hidden sm:inline
                  ${
                    currentStep === step.id
                      ? 'text-[color:var(--foreground)]'
                      : 'text-[color:var(--text-secondary)]'
                  }
                `}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="h-1 w-8 rounded-full bg-[color:var(--border-soft)] mx-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile version: Show current step only */}
      <div className="sticky top-0 z-40 bg-white/85 backdrop-blur-sm border-b border-[color:var(--border-soft)] px-4 py-3 sm:px-6 shadow-sm md:hidden">
        <div className="text-sm text-[color:var(--text-secondary)]">
          <span className="font-semibold text-[color:var(--foreground)]">
            Step {STEPS.find((s) => s.id === currentStep)?.number}
          </span>
          {' '}
          {isGenerating ? (
            <span className="animate-pulse">Generating...</span>
          ) : (
            <span>{STEPS.find((s) => s.id === currentStep)?.label}</span>
          )}
        </div>
      </div>
    </>
  );
}
