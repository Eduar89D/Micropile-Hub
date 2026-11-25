# MicroPile Hub – Grout Consumption Calculator 1.1

Field calculator for [BASEco](https://github.com/Eduar89D/Micropile-Hub) (St. George, Utah). It runs in the browser, including iPhone Safari, with no server. Projects stay on the phone.

Live site: https://eduar89d.github.io/Micropile-Hub/

## Use

- Open the site, or on iPhone use Share → Add to Home Screen.
- Enter the project, batch, density, and tank residual. Defaults match the standard 5-bag batch.
- Field consumption is labeled **INFERRED**: batch gallons minus the 15 gal left in the tank.
- Low / standard / high is ±10% of that figure. The purchase reserve defaults to 3% for simple, standard ground and changes bags, pallets, and water to buy only. Medium and hard ground factors are still coming.
- Geometry (2.5 in bit, T40/20 bar, 3 × 9 ft 10 in, 2 couplers) is theoretical and is not added to the order.
- Save projects on the phone and export a project or the comparison to PDF. On iPhone, Print / Save as PDF uses the on-screen sheet if the file download does not open.

## Develop

```bash
npm install
npm test
npm run dev
npm run build
```

The Vite base path is `/Micropile-Hub/` so the production build matches GitHub Pages.

## Deploy

Pushes to `main` run `.github/workflows/pages.yml` (test, build, GitHub Pages). The workflow calls `actions/configure-pages` with `enablement: true`. The Actions token cannot create a Pages site by itself. If the deploy fails because Pages is off, a repository owner has to:

1. Open the repository on GitHub.
2. Click **Settings**. If the tab is hidden, open the repository menu and click **Settings**.
3. In the left sidebar, under **Code, planning, and automation**, click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Skip the suggested workflow templates. `pages.yml` is already the publisher.
6. Open the **Actions** tab, select **Deploy GitHub Pages**, and **Re-run all jobs**.

Footer: v1.1 — developed by ED
