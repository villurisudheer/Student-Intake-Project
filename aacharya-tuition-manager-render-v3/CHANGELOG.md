# Changelog

## v3.0.0

- Converted the tuition manager from browser-local storage to a Render-hosted web application.
- Added private `/admin` manager and public `/` student/parent intake form.
- Added persistent SQLite storage under `DATA_DIR`.
- Added automatic master Excel workbook generation after every important mutation.
- Added detailed Students, Classes, Attendance, Fees, Payments, Tests, Intake, Settings and Audit data.
- Payments now record payer name/relation and received-by person.
- Added attendance counters and per-student attendance percentage.
- Added Finance Summary and Attendance Summary Excel sheets.
- Added old Windows-manager compatibility endpoint using `ADMIN_SYNC_KEY`.
- Removed external runtime dependencies; the app uses Node built-ins plus in-project HTTP/XLSX helpers.
- Added an end-to-end smoke test.
