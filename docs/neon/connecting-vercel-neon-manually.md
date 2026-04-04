> This page location: Tools & Workflows > Integrations (3rd party) > Deploy > Vercel > Manual Setup
> Full Neon documentation index: https://neon.com/docs/llms.txt

# Connect Vercel and Neon manually

Learn how to connect a Vercel project to a Neon database manually

**What you will learn:**

- [When to use manual connections over integrations](https://neon.com/docs/guides/vercel-manual#when-to-choose-this-path)
- [How to connect using environment variables](https://neon.com/docs/guides/vercel-manual#connection-steps)
- [Advanced CI/CD automation options](https://neon.com/docs/guides/vercel-manual#cicd-based-preview-branching-github-actions)

**Related topics**

- [Vercel-Managed Integration](https://neon.com/docs/guides/vercel-managed-integration)
- [Neon-Managed Integration](https://neon.com/docs/guides/neon-managed-vercel-integration)
- [Automate branching with GitHub Actions](https://neon.com/docs/guides/branching-github-actions)

---

## When to choose this path

Choose manual connection if you prefer not to install a Marketplace integration. This approach is ideal when you:

- Deploy via a custom pipeline (self-hosted CI, monorepo, etc.)
- Need non-Vercel hosting (for example Cloudflare Workers + Vercel Functions hybrid)
- Want full control over branch naming, seeding, migration, or teardown

If you simply want Neon and Vercel with minimal setup, stick to the managed integrations. They're simpler and include UI support.

---

## Prerequisites

- Neon project with database (get a connection string via **Connect** in the Console)
- Deployed Vercel project

---

## Connection steps

1. Copy the connection string from the [Neon Console](https://console.neon.tech). Click **Connect** on your Project Dashboard, select the branch, role, and database you want, then copy the _Connection string_.

   ![Neon connection details modal](https://neon.com/docs/connect/connection_details.png)

   For example:

   ```text
   postgresql://alex:AbC123dEf@ep-cool-darkness-123456.us-east-2.aws.neon.tech/dbname?sslmode=require&channel_binding=require
                ^              ^                                               ^
                |- <role>      |- <hostname>                                   |- <database>
   ```

2. In the Vercel dashboard, open your project and navigate to **Settings → Environment Variables**.

3. Add either:

   ```text
   Key: DATABASE_URL
   Value: <your connection string>
   ```

   _or_ the granular `PG*` variables:

   ```text
   PGUSER=alex
   PGHOST=ep-cool-darkness-123456.us-east-2.aws.neon.tech
   PGDATABASE=dbname
   PGPASSWORD=AbC123dEf
   PGPORT=5432
   ```

   **Note:** Neon uses the default Postgres port, `5432`.

4. Select which environments need database access (Production, Preview, Development) and click **Save**.

5. Redeploy your application (or wait for your next deployment) for the variables to take effect.

That's it. Your Vercel app now connects to Neon just like any other Postgres database.

---

## CI/CD-based Preview Branching (GitHub Actions)

Looking for a full CI/CD recipe? See **[Automate branching with GitHub Actions](https://neon.com/docs/guides/branching-github-actions)**.

---

## Related docs (Vercel)

- [Integration Overview](https://neon.com/docs/guides/vercel-overview)
- [Vercel-Managed (Native Integration)](https://neon.com/docs/guides/vercel-managed-integration)
- [Neon-Managed (Connectable Account)](https://neon.com/docs/guides/neon-managed-vercel-integration)
- [Managing preview branch cleanup](https://neon.com/docs/guides/vercel-branch-cleanup)
- [Connecting to Neon from Vercel](https://neon.com/docs/guides/vercel-connection-methods)
- [Migrating from Vercel Postgres](https://neon.com/docs/guides/vercel-postgres-transition-guide)
