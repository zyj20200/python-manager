# Changelog

All notable changes to Python Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-07

### Added
- Initial release of Python Manager
- Web-based dashboard for managing Python scripts
- Support for scripts from any location on the system
- Real-time process monitoring (CPU, memory usage)
- Centralized logging system
- Auto-restart capability for failed scripts
- REST API for programmatic control
- WebSocket support for real-time updates
- Script management UI (add/remove scripts via web interface)
- Directory browser for finding Python scripts
- Multiple deployment options (setup.py, portable package)
- Support for script arguments
- Bulk operations (start all, stop all)

### Features
- Multi-script management from single interface
- Absolute and relative path support
- Configurable process limits and restart attempts
- Cross-platform compatibility (Windows, Linux, macOS)
- Modern, responsive web interface
- No database required (JSON configuration)

### Technical Details
- Built with Flask and Flask-SocketIO
- Process monitoring via psutil
- Bootstrap-inspired custom CSS
- Vanilla JavaScript (no heavy frameworks)
- Following specific naming conventions for maintainability

## [Unreleased]

### Planned Features
- Docker support
- Script scheduling (cron-like functionality)
- Resource usage graphs
- Email/webhook notifications
- Script dependencies management
- Multi-user authentication
- Dark mode theme improvements
- Export/import configurations
- Script grouping/categories
- Performance metrics history

---

To see what's being worked on, check out the [issues](https://github.com/yourusername/python-manager/issues) page.
