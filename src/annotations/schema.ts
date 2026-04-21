export type AnnotationStatus = 'drafted' | 'reviewed' | 'final';

export interface FrameAnnotation {
  frameId: string;
  frameNumber: number;
  variantId?: string;
  title: string;
  screenshotPath: string;
  extractedCopyPath: string;
  partNumber: string;

  purposeAndIntent: {
    summary: string;
    userAction: string;
  };

  legalAndComplianceLanguage?: {
    copyExcerpt: string;
    purpose: string;
    stakeholderGuidance: string[];
    concernsAddressed: string[];
    basis: string;
  };

  variantCopy?: {
    connected: string;
    newOrSkipped: string;
    rationale: string;
  };

  dataCalculation?: {
    source: string;
    fieldsUsed: string[];
    calculationMethod: string;
    aiOrAlgorithmicInference: 'none' | string;
  };

  dataVisualization?: {
    description: string;
    rationale: string;
  };

  additionalCopy?: string[];
  status: AnnotationStatus;
}
