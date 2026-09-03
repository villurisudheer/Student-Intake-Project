# Aacharya Student Intake - Render companion

This is the **public-only** companion website for `Aacharya_Tuition_Manager_v2.html`. Students/parents can submit tuition contact and class information. There is no public admin dashboard.

## What it stores

Each successful form submission creates:

- one JSON file in `DATA_DIR/submissions/`
- one row in `DATA_DIR/submissions.csv`

The private Windows manager can import these submissions from `GET /api/admin/submissions` using the `ADMIN_SYNC_KEY`.

## Local run

Requires Node.js 22.x.

```bash
set ADMIN_SYNC_KEY=my-long-private-key
npm start
```

Open `http://localhost:3000`.

Run the real smoke test with:

```bash
npm test
```

## Render deployment

1. Put this folder in a GitHub repository.
2. In Render, create a Blueprint from the repository, or create a Node Web Service.
3. Set `ADMIN_SYNC_KEY` to a long random secret. **Do not share it with students.**
4. Use a persistent disk mounted at `/var/data` if you want file submissions to survive service restarts/redeploys. The included `render.yaml` requests a 1 GB disk and a paid web-service compute plan.
5. Deploy. Render gives you a URL such as `https://your-service.onrender.com`.
6. Open the private Windows manager > Settings and enter the Render URL and the same Admin Sync Key.
7. Click **Test**, then **Import New Forms**.

### Important Render storage note

Render's ordinary service filesystem is ephemeral. If you remove the disk from `render.yaml` or use a service without persistent storage, saved JSON/CSV files can disappear after a restart or redeploy.

## Security / privacy

- The public site exposes only the student information form.
- The submission-list API requires a Bearer token equal to `ADMIN_SYNC_KEY`.
- Basic rate limiting, input size limits, field validation, a honeypot, and restrictive security headers are included.
- Collect only information needed for tuition/classes. Do not request passwords, banking information, government IDs, or similar unnecessary sensitive information.
- For real use with minors' information, make sure your academy follows applicable privacy/consent requirements.


## v1.1 endpoint check
After deployment, open `/api/health` in a browser. It must return JSON containing `\"ok\": true`. Use only the base service URL in the Windows manager, for example `https://your-service.onrender.com` (do not paste `/api/health`). Trailing slashes are accepted in v1.1.
