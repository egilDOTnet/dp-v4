import { describe, it, expect } from 'vitest';
import { render, screen } from './utils/test-utils';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import {
  hasHardCodedBackgroundColors,
  hasSemanticBackgroundColors,
} from './utils/color-utils';

describe('Semantic Color Usage', () => {
  describe('Card Component', () => {
    it('should use semantic background classes', () => {
      const { container } = render(
        <Card>
          <div>Test content</div>
        </Card>,
      );

      const cardElement = container.querySelector('.bg-background-secondary');
      expect(cardElement).toBeTruthy();
    });

    it('should not have hard-coded background colors', () => {
      const { container } = render(
        <Card>
          <div>Test content</div>
        </Card>,
      );

      const cardElement = container.firstChild as HTMLElement;
      const className = cardElement?.className || '';

      // Check that semantic classes are used
      expect(hasSemanticBackgroundColors(className)).toBe(true);

      // Check that no hard-coded colors are present (excluding status badges)
      const hasHardCoded = hasHardCodedBackgroundColors(className);
      expect(hasHardCoded).toBe(false);
    });
  });

  describe('Dialog Component', () => {
    it('should use semantic background classes for content', () => {
      render(
        <Dialog
          isOpen={true}
          onClose={() => {}}
          title="Test Dialog"
        >
          <div>Test content</div>
        </Dialog>,
      );

      // Dialog renders in a portal to document.body, so check there
      // The dialog should use semantic classes (bg-background-secondary)
      const allElements = document.body.querySelectorAll('*');
      let foundSemanticClass = false;
      
      allElements.forEach((element) => {
        const className = element.className || '';
        if (typeof className === 'string' && className.includes('bg-background-secondary')) {
          foundSemanticClass = true;
          // Verify no hard-coded colors in this element
          expect(hasHardCodedBackgroundColors(className)).toBe(false);
        }
      });
      
      expect(foundSemanticClass).toBe(true);
    });
  });

  describe('Color Utility Functions', () => {
    it('should detect hard-coded background colors', () => {
      expect(hasHardCodedBackgroundColors('bg-white')).toBe(true);
      expect(hasHardCodedBackgroundColors('bg-gray-50')).toBe(true);
      expect(hasHardCodedBackgroundColors('bg-gray-100')).toBe(true);
      expect(hasHardCodedBackgroundColors('bg-gray-800')).toBe(true);
    });

    it('should detect semantic background colors', () => {
      expect(hasSemanticBackgroundColors('bg-background-primary')).toBe(true);
      expect(hasSemanticBackgroundColors('bg-background-secondary')).toBe(true);
      expect(hasSemanticBackgroundColors('bg-background-tertiary')).toBe(true);
    });

    it('should allow status badge colors', () => {
      // Status badges are allowed to use color-specific classes
      expect(hasHardCodedBackgroundColors('bg-red-100')).toBe(false);
      expect(hasHardCodedBackgroundColors('bg-green-100')).toBe(false);
      expect(hasHardCodedBackgroundColors('bg-blue-100')).toBe(false);
    });

    it('should not flag semantic classes as hard-coded', () => {
      expect(hasHardCodedBackgroundColors('bg-background-primary')).toBe(false);
      expect(hasHardCodedBackgroundColors('bg-background-secondary')).toBe(false);
      expect(hasHardCodedBackgroundColors('bg-background-tertiary')).toBe(false);
    });
  });
});


