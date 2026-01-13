# UnoPim MCP Server - Confluence Documentation

This folder contains comprehensive documentation for adding to your Confluence wiki.

## 📋 Documentation Pages

### 1. **MCP Server Overview** (`01-MCP-Server-Overview.md`)
   - What is the MCP Server
   - Key capabilities and features
   - Architecture diagram
   - Use cases and benefits
   - Technology stack

### 2. **Installation & Setup** (`02-Installation-and-Setup.md`)
   - Prerequisites
   - Step-by-step installation
   - Configuration options
   - Testing the connection
   - Production deployment

### 3. **Available Tools Reference** (`03-Available-Tools-Reference.md`)
   - Complete reference for all 24 tools
   - Input parameters and examples
   - Response formats
   - Error handling

### 4. **Usage Examples** (`04-Usage-Examples.md`)
   - Real-world scenarios
   - Customer onboarding workflows
   - Product import examples
   - Image upload examples
   - Configurable products
   - Bulk operations

### 5. **Troubleshooting** (`05-Troubleshooting.md`)
   - Common issues and solutions
   - Connection problems
   - Authentication issues
   - Tool execution errors
   - Performance optimization

## 🚀 Adding to Confluence

### Parent Page
Add these as **child pages** of:
**https://picopublish.atlassian.net/wiki/spaces/picogenerelt/pages/984875011/UnoPim+POC+-+Azure+Setup**

### Page Hierarchy Structure

```
UnoPim POC - Azure Setup (existing page)
├── 📘 MCP Server Overview
├── ⚙️ Installation & Setup
├── 📚 Available Tools Reference
├── 💡 Usage Examples
└── 🔧 Troubleshooting
```

### Step-by-Step Instructions

#### 1. Login to Confluence
Navigate to: https://picopublish.atlassian.net

#### 2. Navigate to Parent Page
Go to: **UnoPim POC - Azure Setup** page

#### 3. Create Child Pages

For each documentation file:

1. **Click "+" or "Create"** at the top
2. **Select "Blank page"**
3. **Set parent page**: UnoPim POC - Azure Setup
4. **Copy content** from markdown file
5. **Format in Confluence**:
   - Headings: Use Confluence heading styles (H1, H2, H3)
   - Code blocks: Use code macro with language syntax
   - Tables: Use table macro
   - Links: Convert markdown links to Confluence links
   - Callouts: Use info/warning/success panels

#### 4. Page Titles and Emojis

Use these exact titles with emojis:

- 📘 **UnoPim MCP Server - Overview**
- ⚙️ **UnoPim MCP Server - Installation & Setup**
- 📚 **UnoPim MCP Server - Available Tools Reference**
- 💡 **UnoPim MCP Server - Usage Examples**
- 🔧 **UnoPim MCP Server - Troubleshooting**

#### 5. Add Labels

Add these labels to all pages:
- `unopim`
- `mcp-server`
- `claude`
- `api`
- `documentation`

#### 6. Set Permissions

Ensure pages are:
- ✅ Viewable by: All PicoPublish team
- ✅ Editable by: Developers and Admins

### Formatting Tips for Confluence

#### Converting Code Blocks

**Markdown:**
```json
{
  "sku": "PROD-001"
}
```

**Confluence:**
1. Use code block macro
2. Set language: `json`
3. Paste content

#### Converting Tables

**Markdown:**
```
| Tool | Description |
|------|-------------|
| `tool1` | Description |
```

**Confluence:**
1. Insert table
2. Set header row
3. Copy content

#### Converting Callouts

**Markdown:**
```
**⚠️ Important:** Note text
```

**Confluence:**
1. Use "Warning" or "Info" panel macro
2. Add title
3. Add content

#### Converting Links

**Markdown:**
```
[Link text](https://example.com)
```

**Confluence:**
1. Highlight text
2. Click link button
3. Add URL

### Quick Formatting Reference

| Element | Markdown | Confluence |
|---------|----------|------------|
| Heading 1 | `#` | Heading 1 dropdown |
| Heading 2 | `##` | Heading 2 dropdown |
| Code inline | `` `code` `` | Ctrl+Shift+M |
| Code block | ` ``` ` | Macro: Code Block |
| Bold | `**text**` | Ctrl+B |
| Italic | `*text*` | Ctrl+I |
| Link | `[text](url)` | Ctrl+K |
| List | `- item` | Bullet list button |
| Table | Manual | Macro: Table |

## 📝 Maintenance

### Updating Documentation

When the MCP server is updated:

1. **Update markdown files** in this folder
2. **Rebuild if needed**: `npm run build`
3. **Update Confluence pages** with new content
4. **Update "Last Updated" date** at bottom of each page
5. **Notify team** of major changes

### Version Control

- **Current Version**: 1.0.0
- **Last Updated**: 2026-01-13
- **Confluence Sync**: Required after major updates

## 🎯 Documentation Best Practices

### 1. Keep Examples Current
- Test all code examples regularly
- Update with actual customer scenarios
- Remove deprecated features

### 2. Add Screenshots
Consider adding screenshots for:
- UnoPim UI showing results
- Claude Desktop interface
- Configuration files

### 3. Link Related Pages
- Cross-reference between docs
- Link to external resources
- Add "See also" sections

### 4. Gather Feedback
- Add comments section in Confluence
- Track common questions
- Update based on user feedback

## 📊 Documentation Metrics

Current documentation includes:

- **Total Pages**: 5
- **Total Words**: ~15,000
- **Code Examples**: 100+
- **Tools Documented**: 24
- **Scenarios Covered**: 15+
- **Troubleshooting Issues**: 30+

## 🤝 Contributing

To contribute to this documentation:

1. **Edit markdown files** in this folder
2. **Follow existing structure** and formatting
3. **Test all code examples** before committing
4. **Update README** if adding new pages
5. **Sync to Confluence** after approval

## 📞 Support

For documentation questions:
- **Slack**: #unopim-support
- **Email**: dev@picopublish.com
- **Wiki Owner**: [Your Name]

---

**Documentation Version**: 1.0.0
**Created**: 2026-01-13
**Last Synced to Confluence**: Pending
**Status**: ✅ Ready for Confluence Upload
