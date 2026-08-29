# CI / CD

Three things happen automatically, all defined in `.github/workflows`:

| Workflow | Runs on | Does |
| --- | --- | --- |
| `test.yml` | push to `main`/`dev`, every pull request | `pytest`, plus a typecheck and build of the dashboard |
| `build.yml` | push to `main`, tags `v*.*.*`, manual | builds the image for amd64/arm64 and pushes it, then deploys |
| `build-dev.yml` | push to `dev` | same, tagged `dev`, no deployment |
| `deploy.yml` | called by `build.yml`, or manual | pulls the new image on the panel host and restarts it |

The image is published to `ghcr.io/bugbusta/xenith`, which is what every
default in this repository points at. It is additionally pushed to
`<DOCKERHUB_USERNAME>/xenith` on Docker Hub, but only when the
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets are set; without them that
Docker Hub repository does not exist, and a `docker compose pull` aimed at it
quietly finds nothing to update. Docker Hub is a separate account from GitHub,
so the name comes from the secret rather than from the repository owner.

Tags: `latest` and `sha-<short>` from `main`, `dev` from `dev`, and `1.2.3` /
`1.2` from a `v1.2.3` git tag.

The dashboard is built inside the image (the `dashboard` stage in the
`Dockerfile`), so `app/dashboard/build` is not in the repository and there is
nothing to rebuild by hand before committing.

## Secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Needed for | Notes |
| --- | --- | --- |
| `DOCKERHUB_USERNAME` | pushing to Docker Hub | optional — without it the build publishes to ghcr.io only |
| `DOCKERHUB_TOKEN` | pushing to Docker Hub | an access token, not the password |
| `SSH_HOST` | deployment | address of the panel host |
| `SSH_USER` | deployment | usually `root` |
| `SSH_KEY` | deployment | the **private** key whose public half is in `~/.ssh/authorized_keys` on the host |
| `SSH_PORT` | deployment | only if SSH is not on 22 |

`GITHUB_TOKEN` is provided by Actions itself; ghcr.io needs no secret.

Without `SSH_HOST` the deploy job reports "skipping deployment" and the build
still succeeds, so the pipeline is usable before the server is wired up.

## Setting up deployment

On your workstation, make a key pair used only by CI:

```bash
ssh-keygen -t ed25519 -C "xenith-deploy" -f ~/.ssh/xenith_deploy -N ""
ssh-copy-id -i ~/.ssh/xenith_deploy.pub root@your-server
```

Put the **private** key (`~/.ssh/xenith_deploy`, the whole file including the
BEGIN/END lines) into the `SSH_KEY` secret, the server address into `SSH_HOST`
and `root` into `SSH_USER`.

Then point the server at the published image once — after this every push to
`main` updates it on its own:

```bash
xenith image ghcr.io/bugbusta/xenith:latest
```

If the package is private, log the host into ghcr.io first:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u bugbusta --password-stdin
```

Make the package public instead under **Packages → xenith → Package settings**
if you would rather not keep a token on the server.

## Deploying by hand

From the **Actions** tab: **Deploy → Run workflow**, optionally with a specific
image reference (for example `ghcr.io/bugbusta/xenith:sha-1a2b3c4` to roll
back to an earlier commit).

From the server:

```bash
xenith update                                     # pull the current tag, restart
xenith image ghcr.io/bugbusta/xenith:sha-1a2b3c4  # switch to another build
```

`xenith image` keeps the previous compose file as `docker-compose.yml.bak`.

## Releases

Tag a release when you want a fixed version rather than a moving `latest`.
Before tagging, bump `__version__` in `app/__init__.py` — it is what the
dashboard and `GET /api/system` report — and move the `Unreleased` entries in
`CHANGELOG.md` under the new version:

```bash
git tag v0.9.0 && git push origin v0.9.0
```

That publishes `0.9.0`, `0.9` and `latest`, and deploys nothing — tag builds do
not touch the server, since the deploy job only runs for `main`.
