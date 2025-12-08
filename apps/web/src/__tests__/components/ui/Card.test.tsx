import { describe, it, expect } from 'vitest';
import { render } from '../../utils/test-utils';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import {
  hasHardCodedBackgroundColors,
  hasSemanticBackgroundColors,
} from '../../utils/color-utils';

describe('Card Component', () => {
  it('should render with semantic background classes', () => {
    const { container } = render(
      <Card>
        <div>Test content</div>
      </Card>,
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toBeTruthy();
    expect(hasSemanticBackgroundColors(card.className)).toBe(true);
    expect(hasHardCodedBackgroundColors(card.className)).toBe(false);
  });

  it('should render CardHeader with proper styling', () => {
    const { container } = render(
      <Card>
        <CardHeader>Header</CardHeader>
      </Card>,
    );

    const header = container.querySelector('[class*="border-b"]');
    expect(header).toBeTruthy();
  });

  it('should render CardBody', () => {
    const { container } = render(
      <Card>
        <CardBody>Body content</CardBody>
      </Card>,
    );

    const body = container.querySelector('div > div');
    expect(body).toBeTruthy();
  });

  it('should render CardFooter with proper styling', () => {
    const { container } = render(
      <Card>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    const footer = container.querySelector('[class*="border-t"]');
    expect(footer).toBeTruthy();
  });

  it('should support interactive variant', () => {
    const { container } = render(
      <Card variant="interactive">
        <div>Interactive card</div>
      </Card>,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('cursor-pointer');
  });
});


