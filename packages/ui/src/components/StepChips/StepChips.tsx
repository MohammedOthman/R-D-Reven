import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface Step {
  id: string;
  label: string;
}

export interface StepChipsProps {
  steps: Step[];
  currentStepId: string;
  completedStepIds?: string[];
  className?: string;
}

/** Brand doc §09 component: numbered step chips, used for wizard-style flows. */
export function StepChips({
  steps,
  currentStepId,
  completedStepIds = [],
  className,
}: StepChipsProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {steps.map((step, index) => {
        const isCompleted = completedStepIds.includes(step.id);
        const isCurrent = step.id === currentStepId;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'font-label flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isCompleted
                  ? 'bg-accent text-white'
                  : isCurrent
                    ? 'border-accent text-accent border-2'
                    : 'text-muted-tertiary border border-[var(--border-default)]',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
            </div>
            <span
              className={cn(
                'font-body text-sm whitespace-nowrap',
                isCurrent ? 'text-ink font-semibold' : 'text-muted-body',
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  'mx-1 h-px w-6 shrink-0',
                  index < currentIndex ? 'bg-accent' : 'bg-[var(--border-default)]',
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
