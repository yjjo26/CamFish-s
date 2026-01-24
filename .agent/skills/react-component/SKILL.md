---
name: react-component
description: Generates new React functional components with TypeScript and CSS. Use when the user asks to create a new UI component, button, panel, etc.
---

# React Component Generator

Use this skill to create consistent React components following the project's style.

## Structure

- Components should be created in `src/components/` (unless specified otherwise).
- Each component gets its own file `ComponentName.tsx` (PascalCase).
- Styles go in `ComponentName.css` in the same directory.

## Template

### ComponentName.tsx

```tsx
import React, { useState } from 'react';
import './ComponentName.css';

interface ComponentNameProps {
  // Define props here
  title?: string;
}

const ComponentName = ({ title }: ComponentNameProps) => {
  return (
    <div className="component-name">
      {title && <h3>{title}</h3>}
      {/* Content */}
    </div>
  );
};

export default ComponentName;
```

### ComponentName.css

```css
.component-name {
  /* styles */
}
```

## Rules

1. **Named Functions**: Use `const ComponentName = ...` syntax.
2. **Exports**: Use `export default ComponentName;`.
3. **Interfaces**: Always define a `Props` interface, even if empty (for future proofing), or name it `ComponentNameProps`.
4. **CSS**: Import the CSS file at the top. Use a root class name matching the component name (kebab-case).
5. **Hooks**: Import hooks from 'react'.

