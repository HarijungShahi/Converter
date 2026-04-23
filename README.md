# Essential File Converter (Node.js + MongoDB)

Supports:

- PDF -> DOCX
- DOCX -> PDF
- PDF -> XLSX (text extraction style)
- Image conversion: PNG/JPG/JPEG/WEBP between each other
- MP4 -> MP3
- MP3 -> MP4
- Batch conversion from the UI (multiple files)
- Drag-and-drop file upload
- Auto target filtering based on selected file type(s)

## Requirements

- Node.js 18+
- MongoDB running locally or remote URI
- LibreOffice installed (required by `libreoffice-convert`)
- FFmpeg installed and available in PATH

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
copy .env.example .env
```

3. Start server:

```bash
npm run dev
```

4. Open:

`http://localhost:3000`

## Notes

- "PDF -> XLSX" is best-effort text extraction, not perfect table reconstruction.
- "MP3 -> MP4" creates a video container with audio stream.
- Converted files are automatically downloaded in the browser.
