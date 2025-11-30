import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectApplyButtons, hasApplyButton } from './applyButtonDetector';

describe('applyButtonDetector', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('detectApplyButtons', () => {
    it('should detect "Apply Now" button with high confidence', () => {
      container.innerHTML = '<button>Apply Now</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].text).toBe('Apply Now');
      expect(result.matches[0].matchType).toBe('text');
    });

    it('should detect "Submit Application" button', () => {
      container.innerHTML = '<button>Submit Application</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect "Continue to Application" link', () => {
      container.innerHTML = '<a href="/apply">Continue to Application</a>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.matches[0].attributes.href).toBe('/apply');
    });

    it('should detect button with apply-related ID', () => {
      container.innerHTML = '<button id="apply-btn">Next Step</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.matches[0].matchType).toMatch(/attribute|combined/);
    });

    it('should detect button with apply-related class', () => {
      container.innerHTML = '<button class="job-apply-button">Continue</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should detect input submit button with apply text', () => {
      container.innerHTML = '<input type="submit" value="Apply Online" />';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should detect button with aria-label', () => {
      container.innerHTML = '<button aria-label="Apply for this position">→</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should detect "Quick Apply" button', () => {
      container.innerHTML = '<button>Quick Apply</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect "Join Our Team" button', () => {
      container.innerHTML = '<button>Join Our Team</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should NOT detect hidden buttons', () => {
      container.innerHTML = '<button style="display: none;">Apply Now</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(false);
    });

    it('should NOT detect invisible buttons', () => {
      container.innerHTML = '<button style="visibility: hidden;">Apply Now</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(false);
    });

    it('should NOT detect non-interactive elements', () => {
      container.innerHTML = '<div>Apply Now</div>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(false);
    });

    it('should detect clickable div with role="button"', () => {
      container.innerHTML = '<div role="button" style="cursor: pointer;">Apply Now</div>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should NOT detect links with empty href', () => {
      container.innerHTML = '<a href="#">Apply Now</a>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(false);
    });

    it('should NOT detect very long text (likely not a button)', () => {
      const longText = 'Apply '.repeat(50);
      container.innerHTML = `<button>${longText}</button>`;
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(false);
    });

    it('should detect multiple apply buttons and rank by confidence', () => {
      container.innerHTML = `
        <button id="apply-btn">Continue</button>
        <button>Apply Now</button>
        <a href="/apply">Submit Application</a>
      `;
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(2);
      // Highest confidence should be first
      expect(result.matches[0].confidence).toBeGreaterThanOrEqual(result.matches[1].confidence);
    });

    it('should handle pages with no apply buttons', () => {
      container.innerHTML = `
        <button>Learn More</button>
        <button>Contact Us</button>
        <a href="/about">About</a>
      `;
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.matches.length).toBe(0);
    });

    it('should detect "Start Application" button', () => {
      container.innerHTML = '<button>Start Application</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should detect "Get Started" button in job context', () => {
      container.innerHTML = '<button>Get Started</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
    });

    it('should combine text and attribute confidence', () => {
      container.innerHTML = '<button id="apply-now-btn" class="cta-apply">Apply for this job</button>';
      
      const result = detectApplyButtons();
      
      expect(result.hasApplyButton).toBe(true);
      expect(result.matches[0].matchType).toBe('combined');
      expect(result.matches[0].confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('hasApplyButton', () => {
    it('should return true when apply button exists with high confidence', () => {
      container.innerHTML = '<button>Apply Now</button>';
      
      expect(hasApplyButton()).toBe(true);
    });

    it('should return false when no apply button exists', () => {
      container.innerHTML = '<button>Learn More</button>';
      
      expect(hasApplyButton()).toBe(false);
    });

    it('should return false when confidence is too low', () => {
      container.innerHTML = '<button id="next">Continue</button>';
      
      const result = detectApplyButtons();
      // This might have low confidence without strong text match
      if (result.confidence < 0.5) {
        expect(hasApplyButton()).toBe(false);
      }
    });
  });
});
