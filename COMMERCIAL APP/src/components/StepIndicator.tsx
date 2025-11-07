import React from 'react';
import { CheckCircleIcon } from './Icons';

interface StepIndicatorProps {
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = ['Extract Data', 'Review Changes', 'Standardize Data', 'Group Data'];

  const getStepClass = (stepIndex: number) => {
    const stepNumber = stepIndex + 1;
    if (stepNumber < currentStep) return 'step-indicator__item step-indicator__item--complete';
    if (stepNumber === currentStep) return 'step-indicator__item step-indicator__item--active';
    return 'step-indicator__item';
  };

  const getIcon = (stepIndex: number) => {
      const stepNumber = stepIndex + 1;
      if (stepNumber < currentStep) {
          return (
            <span className="step-indicator__dot step-indicator__dot--complete">
              <CheckCircleIcon width={14} height={14} />
            </span>
          );
      }
      return (
        <span className="step-indicator__dot">
          {stepNumber}
        </span>
      );
  }

  return (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <div key={step} className={getStepClass(index)}>
          {getIcon(index)}
          <span className="step-indicator__label">
            {step}
            {index + 1 === currentStep && <span className="step-indicator__status">In progress</span>}
          </span>
        </div>
      ))}
    </div>
  );
};