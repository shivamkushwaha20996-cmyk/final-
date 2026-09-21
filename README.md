# Mobile R&D Engineering Portal — v17 Stable File Command Center

Stability-first build based on the known working portal. The existing dashboard application logic is kept intact; the File Command Center is an isolated module loaded separately.

## Added
- Engineering File Command Center button
- Filename/model/record/category search
- Model filter
- File type icons
- Preview for PDF, images and text/CSV files when the browser supports it
- Download action for locally stored files
- Recent upload history from the existing local audit log
- Responsive modal layout for laptop and mobile screens

## Preserved
- Existing model picker
- Existing A→R → Hardware Checklist → S record sequence
- Existing admin upload flow
- Existing IndexedDB file storage
- Existing favorites, recently viewed, filters, presentation mode and settings
- Existing dashboard data

## Important
This build still uses browser-local IndexedDB/localStorage. It is not a shared multi-laptop repository. Centralized storage for all authorized users requires a backend such as Supabase, Firebase, Appwrite, or a custom API/storage service.
