# 🎨 VS Code Copilot-like Chat UI — Design Analysis & Technical Prompt

## 📁 Source File: `/home/sahon/Downloads/pbm/Plain Text.html`

## 🎯 Target: VS Code Copilot-style Extension UI (Customized)

---

## ✅ 1. Complete Component Analysis

### `[A]` Header Bar

| Element            | File Location      | Description                  | Required?             |
| ------------------ | ------------------ | ---------------------------- | --------------------- |
| Tab (Chat / Codex) | HTML ~line 134     | Default chat tab + Codex tab | ✅ **Required**       |
| New Chat (+)       | HTML ~line 140     | Start new chat               | ✅ Required           |
| Expand Panel       | HTML ~line 143     | Expand/collapse panel        | ✅ Required           |
| Settings (⚙)       | HTML ~line 142     | Settings shortcut            | ✅ Required           |
| Window Controls    | HTML ~line 145-147 | minimize, maximize, close    | ⬜ Handled by VS Code |

### `[B]` Sub-header

| Element         | Description               | Required?       |
| --------------- | ------------------------- | --------------- |
| Back Button (←) | Navigate back in history  | ✅ **Required** |
| Chat Title      | Current chat session name | ✅ Required     |
| Split Button    | Split panel view          | ✅ Required     |

### `[C]` Message Area

| Element              | Description                                       | Required?       |
| -------------------- | ------------------------------------------------- | --------------- |
| User Bubble (right)  | User message, right-aligned, max-width 65%        | ✅ **Required** |
| AI Block (left)      | AI response, left-aligned, max-width 90%          | ✅ **Required** |
| Thinking Block       | Collapsible thinking section with pulse animation | ✅ **Required** |
| AI Content Rich Text | code blocks, highlights, lists                    | ✅ **Required** |
| Typewriter Cursor    | Text streaming effect                             | ✅ Required     |

### `[D]` AI Action Buttons

| Element                    | Description                 | Required?       |
| -------------------------- | --------------------------- | --------------- |
| Regenerate (🔄)            | Re-generate response        | ✅ **Required** |
| Copy (📋)                  | Copy to clipboard           | ✅ **Required** |
| Like/Dislike (👍👎)        | Feedback                    | ✅ **Required** |
| Agent Tag (e.g. code-guru) | Shows which agent responded | ✅ **Required** |

### `[E]` Input Section ⭐ **Main Focus**

| Element                  | Current Design                | Required?       | Customization         |
| ------------------------ | ----------------------------- | --------------- | --------------------- |
| Textarea                 | `#chatInput` — plain textarea | ✅              | **Needs improvement** |
| File Attach (+ button)   | label with file input         | ✅ OK           | —                     |
| Agent Pill 1 (sahon)     | dropdown agent selector       | ✅ **Required** | Add more features     |
| Agent Pill 2 (code-guru) | dropdown model selector       | ✅ **Required** | Add more features     |
| Slider/Options (⚙)       | Additional options            | ⬜ Optional     | —                     |
| Send Button              | arrow-down icon               | ✅ Required     | —                     |
| Attachment Preview       | thumbnail + remove button     | ✅ **Required** | —                     |

### `[F]` Status Bar

| Element             | Description         | Required?   |
| ------------------- | ------------------- | ----------- |
| Environment (Local) | Current environment | ✅ Required |
| Approval Status     | Default Approvals   | ✅ Required |
| Sync Indicator      | Syncing spinner     | ✅ Required |

---

## ⚠️ 2. Input Box Issues (as noted by user)

**Current problems** with the input box:

1. **Plain Textarea** — No syntax highlighting or formatting
2. **No Slash Commands** — No `/fix`, `/explain` type command support
3. **No Mention System** — Cannot `@code-guru` to mention agents
4. **No Rich Context** — No direct file reference support (`file:path`)
5. **No Multi-line Indicator** — Shift+Enter confusion
6. **No Character/Token Count** — Cannot see how much text can be written
7. **No Quick Action Icons** — Missing utility buttons (clear, expand, etc.)

---

## 🎯 3. Technical Prompt for Customized Input Box

Below is the prompt to send to the original designer. This is for creating a customized input box in VS Code Copilot Chat style:

---

## 📝 TECHNICAL PROMPT (Ready to Send)

```
Create a VS Code Copilot Chat-style input box component with the following specifications:

## Design Reference
The UI follows VS Code dark theme (bg: #1e1e1e, sidebar: #252526, input: #3c3c3c, accent: #007acc) with Inter font family. The existing design has a standard textarea-based input.

## Required Input Box Features

### 1. Rich Textarea
- Multi-line textarea with auto-resize (min 36px, max 120px)
- Placeholder text: "Describe what to build or ask..."
- Shift+Enter for newline, Enter to send
- Dark theme styled with proper border, focus ring (#007acc)
- Scrollbar styling matching VS Code

### 2. Slash Command System (/)
- Type `/` to trigger command palette dropdown
- Supported commands: `/fix` (fix code), `/explain` (explain code), `/test` (write tests), `/docs` (generate docs), `/review` (review code), `/refactor` (refactor code)
- Each command has: icon, name, description, shortcut hint
- Keyboard navigation (↑↓ arrows, Enter to select, Esc to dismiss)
- Filter commands as user types after `/`

### 3. Mention System (@)
- Type `@` to trigger agent/model selector dropdown
- Show available agents with icons (sahon, code-guru, gpt-4o, claude-3.5, gemini, o3-mini)
- Each agent shows: icon, name, brief description
- Keyboard navigable dropdown
- Selected mention shows as styled pill/token inside input

### 4. File Reference System (# or :)
- Type `#` or `file:` to reference workspace files
- Quick file picker dropdown showing recent files
- File icon + filename display

### 5. Attachment Area
- Drag & drop support for files/images
- Click to attach via file dialog
- Attachment preview shows: thumbnail (for images), file icon + name (for code)
- Remove button (×) on each attachment
- Max attachment size indicator

### 6. Input Footer
| Left Side | Right Side |
|-----------|------------|
| + Attach button | Slider/Options button |
| Agent pill (sahon) ▼ dropdown | Send button (→) |
| Model pill (code-guru) ▼ dropdown | |

### 7. Agent/Model Dropdowns
- Drop-up (appears above the pill, not below)
- Smooth animation (dropUp: opacity + translateY)
- Sections: "Agents" label, list with icons
- Checkmark (✓) on selected item
- Close on outside click

### 8. Send Button States
- Default: muted color, border style
- Active (has text or files): accent color (#007acc), white icon
- Disabled (generating): 50% opacity, no pointer events
- Loading spinner during generation

### 9. Extra Polish
- Character/token count (optional, shown when approaching limit)
- Clear button (×) when input has content
- Code button (</>) to toggle code block insert
- AI context indicator showing what context will be sent

## Interaction Requirements
- All JavaScript must be vanilla (no frameworks) or use Web Component pattern
- Event delegation for dynamic elements
- Proper focus management (keep textarea focused after dropdown selection)
- Accessibility: ARIA labels, keyboard navigation, focus traps in dropdowns
- Smooth animations (150-200ms transitions)
- Zero external dependencies beyond Font Awesome icons

## Visual Style
- Backward compatible with existing CSS variables
- Additional CSS variables for new components:
  --dropdown-bg, --hover-bg, --focus-ring, --pill-active-bg, --mention-bg
- Consistent with VS Code dark theme throughout
- Monospace font (JetBrains Mono / Cascadia Code) for code elements
```

---

## 🏗️ 4. Complete Extension Architecture for Full UI

```
VS Code Copilot-like Extension UI
├── 📁 webview/ (VS Code Webview Panel)
│   ├── index.html            ← This HTML file (customized)
│   ├── style.css             ← VS Code Dark Theme CSS
│   └── script.js             ← Controller + Integration
├── 📁 src/
│   ├── extension.ts          ← VS Code Extension Entry
│   ├── panel.ts              ← Webview Panel Manager
│   ├── chatController.ts     ← Chat logic
│   ├── messageHandler.ts     ← Message send/receive
│   ├── serverBridge.ts       ← MCP/Server connection
│   └── types.ts              ← Type definitions
├── package.json
└── tsconfig.json
```

---

## ✅ 5. Reusable UI Components from This Design

| #   | Component        | Reusable from File? | Needs Customization? |
| --- | ---------------- | ------------------- | -------------------- |
| 1   | Header Tab       | ✅ Yes              | Name change only     |
| 2   | Sub-header       | ✅ Yes              | —                    |
| 3   | User Bubble      | ✅ Yes              | —                    |
| 4   | AI Message Block | ✅ Yes              | —                    |
| 5   | Thinking Block   | ✅ Yes (excellent)  | —                    |
| 6   | AI Actions       | ✅ Yes              | —                    |
| 7   | Status Bar       | ✅ Yes              | —                    |
| 8   | Agent Dropdown   | ✅ Yes              | —                    |
| 9   | **Input Box**    | ❌ **No**           | **Full redesign**    |
| 10  | Attachment       | ✅ Yes              | —                    |
| 11  | Send Button      | ✅ Yes              | —                    |

---

## 🚀 Summary

In the current design, **all UI elements except the input box** are already well-designed like VS Code Copilot Chat. Only the input box needs to be enriched with:

1. **Slash Commands** (`/fix`, `/explain`)
2. **Mention System** (`@agent`)
3. **File Reference** (`file:` or `#`)
4. **Drag & Drop** attachment
5. **Better Visual** — pills, icons, clear button, token count

Send the Technical Prompt above to the designer. They will understand exactly what features are needed.
