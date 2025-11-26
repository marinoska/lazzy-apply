# Test Setup

This project uses **Vitest** for unit and integration tests, and **Playwright** for end-to-end tests.

## Installation

Install dependencies:

```bash
pnpm install
```

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter @lazyapply/api test:watch

# Run with coverage
pnpm test:coverage

# Run with UI
pnpm test:ui
```

### End-to-End Tests (Playwright)

```bash
# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Install Playwright browsers (first time only)
pnpm exec playwright install
```

## Test Structure

### Unit Tests (`apps/api/src/__tests__/`)

- **`fileType.test.ts`**: Tests for file type constants and type derivation
- **`outbox.test.ts`**: Tests for Outbox model with file type validation
- **`cvData.test.ts`**: Tests for CV Data model using ParsedCVData structure
- **`updateOutboxStatus.test.ts`**: Integration tests for the transaction-based outbox update

### E2E Tests (`e2e/`)

- **`outbox-workflow.spec.ts`**: Full workflow tests for file upload and CV parsing

## Test Coverage

The tests cover the following changes:

1. **File Type Refactoring**
   - Uppercase file types (PDF, DOCX)
   - Shared `FileUploadContentType` from `@lazyapply/types`
   - Direct connection between type and enum values

2. **Outbox Model**
   - File type field validation
   - Immutability of file type
   - Outbox status transitions

3. **CV Data Storage**
   - ParsedCVData structure compatibility
   - All fields properly saved
   - Query methods (findByUploadId, findByUserId)

4. **Transaction-Based Updates**
   - Atomic outbox completion and CV data save
   - Rollback on failure
   - Proper error handling

## Configuration Files

- **`vitest.workspace.ts`**: Workspace configuration for monorepo
- **`apps/api/vitest.config.ts`**: API-specific Vitest config
- **`apps/upload-queue-consumer/vitest.config.ts`**: Consumer-specific Vitest config
- **`playwright.config.ts`**: Playwright E2E test configuration
- **`apps/api/src/__tests__/setup.ts`**: Test setup with MongoDB Memory Server

## MongoDB Memory Server

Unit tests use `mongodb-memory-server` to provide an in-memory MongoDB instance. This ensures:
- Fast test execution
- No external dependencies
- Clean state for each test
- Isolated test environment

## Best Practices

1. **No inline imports**: All imports at the top of the file
2. **Descriptive test names**: Clear what is being tested
3. **Arrange-Act-Assert**: Standard test structure
4. **Clean up**: Tests clean up after themselves
5. **Type safety**: Full TypeScript support in tests
