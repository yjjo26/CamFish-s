---
name: code-style
description: Enforces project-specific coding conventions/style for TypeScript and React. Use when writing or refactoring code.
---

# Code Style Guide

Follow these rules to maintain code quality.

## TypeScript

- **Strict Mode**: Assume strict mode is on. No implicit `any`.
- **Types vs Interfaces**: Use `interface` for object shapes (Props, State) and `type` for unions/intersections.
- **Async/Await**: Prefer `async/await` over `.then()`.

## React

- **Hooks**:
  - Always rules of hooks.
  - initializing state: `useState<Type>(initialValue)`.
- **Event Handlers**: Name them `handleEvent` (e.g., `handleClick`, 'handleSearch').
- **JSX**: key props must be unique and stable.

## General

- **Imports**: Group imports:
  1. Built-in/Third-party (react, vite, etc.)
  2. Local components
  3. Styles
- **Comments**: JavaDoc style for complex functions.
- **Console**: Remove `console.log` in production code (allow in dev/debugging).
