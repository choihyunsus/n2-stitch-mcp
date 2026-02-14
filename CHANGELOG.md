# Changelog

## [1.1.0] - 2025-02-14

### Fixed
- Cloud mode connection stability improvements
- Fixed internal comment cleanup for production release
- Improved error handling for transient network failures

### Changed
- Codebase cleaned for public release (English-only standards)
- All 35 test cases passing

## [1.0.0] - 2025-02-13

### Added
- Initial release
- Google Stitch MCP proxy with 3-layer safety architecture
- Cloud mode via N2 Cloud (`--cloud` flag)
- Local mode with gcloud ADC or API key
- Exponential-backoff retry (L1)
- Auto token refresh on 401 (L2)
- TCP drop recovery via polling (L3)
- `init` setup wizard
- 35 unit tests
