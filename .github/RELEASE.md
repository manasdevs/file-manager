# CI/CD Setup and Release Process

This repository uses GitHub Actions for continuous integration and automated npm publishing.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers**: Push to `main` or `develop` branches, and on pull requests

**What it does**:
- Tests on Node.js 18.x and 20.x
- Runs ESLint
- Runs TypeScript type checking
- Runs all tests (69 tests)
- Builds the package
- Builds the example application

### 2. Publish Workflow (`.github/workflows/publish.yml`)

**Triggers**: When a GitHub release is created

**What it does**:
- Installs dependencies
- Runs tests
- Builds the package
- Publishes to npm with provenance

## Setup Instructions

### 1. Configure npm Token

To enable automated npm publishing, you need to add your npm token as a GitHub secret:

1. **Generate npm Token**:
   ```bash
   npm login
   npm token create --type=automation
   ```

2. **Add to GitHub Secrets**:
   - Go to your repository on GitHub
   - Navigate to `Settings` → `Secrets and variables` → `Actions`
   - Click `New repository secret`
   - Name: `NPM_TOKEN`
   - Value: Paste your npm automation token
   - Click `Add secret`

### 2. Enable Provenance (Optional but Recommended)

Provenance provides supply chain security by linking your npm package to its source:

1. Go to npmjs.com and sign in
2. Navigate to your package settings
3. Enable "Require provenance" (if available)

## Creating a Release

### Method 1: Using GitHub UI (Recommended)

1. Go to your repository on GitHub
2. Click on `Releases` in the right sidebar
3. Click `Create a new release`
4. Fill in the details:
   - **Tag**: Create a new tag (e.g., `v1.0.0`, `v1.1.0`)
   - **Release title**: Same as tag or descriptive (e.g., "v1.0.0 - Initial Release")
   - **Description**: Describe what's new, bug fixes, breaking changes
5. Click `Publish release`

The GitHub Action will automatically:
- Run all tests
- Build the package
- Publish to npm

### Method 2: Using GitHub CLI

```bash
# Install GitHub CLI if needed
brew install gh

# Create and publish a release
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "First stable release with all core features"
```

### Method 3: Manual Publish (Not Recommended)

If you need to publish manually:

```bash
# Update version in package.json
cd packages/manas-fm
npm version patch  # or minor, major

# Publish
npm publish
```

## Version Bumping

Before creating a release, update the version in `packages/manas-fm/package.json`:

```bash
cd packages/manas-fm

# For bug fixes
npm version patch  # 1.0.0 → 1.0.1

# For new features (backward compatible)
npm version minor  # 1.0.0 → 1.1.0

# For breaking changes
npm version major  # 1.0.0 → 2.0.0
```

Then commit and push:

```bash
git add package.json
git commit -m "chore: bump version to v1.0.1"
git push
```

## Release Checklist

Before creating a release, ensure:

- [ ] All tests pass locally (`pnpm test`)
- [ ] Code is linted (`pnpm lint`)
- [ ] Types are valid (`pnpm typecheck`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Version is updated in `package.json`
- [ ] CHANGELOG is updated (if you maintain one)
- [ ] Breaking changes are documented
- [ ] README is up to date

## Monitoring

After creating a release:

1. **Check GitHub Actions**:
   - Go to `Actions` tab in your repository
   - Monitor the "Publish to npm" workflow

2. **Verify npm Publication**:
   - Visit https://www.npmjs.com/package/manas-fm
   - Confirm the new version is listed

3. **Test Installation**:
   ```bash
   npm install manas-fm@latest
   ```

## Troubleshooting

### Publish fails with "401 Unauthorized"
- Verify `NPM_TOKEN` secret is correctly set
- Ensure the token has automation/publish permissions
- Check if the token has expired

### Publish fails with "403 Forbidden"
- Check npm account has publish permissions for the package
- For scoped packages, verify organization membership

### Tests fail in CI
- Run tests locally first: `pnpm test`
- Check Node.js version compatibility
- Review CI logs for specific errors

## Security

- Never commit npm tokens to the repository
- Use automation tokens for CI/CD
- Enable 2FA on your npm account
- Regularly rotate your npm tokens
- Use provenance for supply chain security
