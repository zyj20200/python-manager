# Contributing to Python Manager

First off, thank you for considering contributing to Python Manager! It's people like you that make Python Manager such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots if possible**
* **Include your Python version and OS**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain which behavior you expected to see instead**
* **Explain why this enhancement would be useful**

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the Python style guide (PEP 8)
* Include thoughtfully-worded, well-structured tests
* Document new code
* End all files with a newline

## Development Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code follows the existing style.
6. Issue that pull request!

## Style Guide

### Python Code Style

* Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
* Use meaningful variable names following the project's convention:
  * `vg_` prefix for global variables
  * `ag_` prefix for global arrays
  * `vf_` prefix for function variables
  * `af_` prefix for function arrays
* Keep functions focused and under 50 lines when possible
* Add docstrings to all functions
* Avoid using classes unless necessary
* Keep files under 1250 lines

### JavaScript Code Style

* Use meaningful variable names with the same prefix convention as Python
* Avoid using imports - keep code in single files
* Add comments for complex logic
* Use consistent indentation (2 spaces)

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

Example:
```
Add script validation before starting

- Check if script file exists
- Validate Python syntax
- Show meaningful error messages

Fixes #123
```

## Project Structure

When contributing, please maintain the existing structure:

```
python-manager/
├── py_manager/       # Core modules only
├── scripts/          # Example scripts only
├── logs/            # Log files (gitignored)
├── deploy/          # Deployment tools
└── od/              # Old/archived files (gitignored)
```

## Testing

Before submitting a pull request:

1. Test all basic operations:
   - Starting/stopping scripts
   - Adding/removing scripts via UI
   - Viewing logs
   - API endpoints

2. Test on different platforms if possible:
   - Windows
   - Linux
   - macOS

3. Verify no regression in existing features

## Questions?

Feel free to open an issue with your question or reach out to the maintainers directly.

Thank you for contributing! 🎉
