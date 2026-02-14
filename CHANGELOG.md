# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-02-14

### Changed
- **Free tier limits increased**: Stitch generations 20 → **50/month**, Search queries 200 → **500/month**
- Improved README with clearer Cloud mode instructions

### Fixed
- Rate limiter consistency across all service layers

## [1.1.0] - 2026-02-13

### Added
- **Cloud Mode** (`--cloud`): Connect via N2 Cloud proxy — no gcloud setup needed
- N2 Cloud API key authentication (`N2_API_KEY`)
- STDIO ↔ HTTP bridge (`src/cloud-client.js`) for seamless MCP integration
- Auto-detection: local vs cloud mode based on environment

### Changed
- Package description updated for cloud mode support

## [1.0.0] - 2026-02-12

### Added
- Initial release
- MCP proxy for Google Stitch API
- 3-Layer Safety Architecture (retry, token refresh, TCP recovery)
- Local mode with gcloud ADC or Stitch API Key
- Tools: `generate_screen`, `edit_screen`, `get_screen`, `list_screens`, `create_project`, `list_projects`, `get_project`
