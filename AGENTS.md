<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repository and deployment

- GitHub repository: `joaquintrujillok/adoOps.Digital`
- The `origin` remote is already configured for this repository.
- Do not ask the user to configure or identify the GitHub repository again.
- Production deployments are triggered by pushing the intended release changes to `main`.
- **Never tell anyone to run `vercel --prod` to pick up a changed environment
  variable.** That command deploys the *local working directory*, not the commit
  on `main`. Run from a clone that has not been pulled, it silently ships stale
  code and re-aliases the domain to it — production rolls back, and the only
  symptom is routes returning 404. It happened on 25-08-2026: the motor
  disappeared from production minutes after it had been verified working.
  To pick up an env-var change, use **Redeploy** on the latest *Git* deployment
  in the Vercel dashboard, or push a commit to `main`. Both redeploy the commit,
  not the folder.
- When a CLI deploy really is the right tool, run `npm run desplegar`. It refuses
  to deploy from a stale clone, a dirty tree, a non-`main` branch, or commits
  that are not on GitHub yet — the four ways `vercel --prod` ships something
  other than what `main` says. `npm run al-dia` just pulls.
