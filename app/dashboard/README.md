# Dashboard UI for Xenith

The dashboard is a React + TypeScript app built with Vite and Chakra UI.
It is served by the backend from `app/dashboard/build`.

## Requirements

Node.js >= 16.17.0.

## Install

```bash
cd app/dashboard
npm install
```

## Configure

Copy `example.env` to `.env` and set the backend API address:

| Name          | Description                                    |
| ------------- | ---------------------------------------------- |
| VITE_BASE_API | API url of the deployed Xenith backend       |

## Development server

```bash
npm run dev
```

Alternatively, set `DEBUG=true` in the project's root `.env` and run `python main.py`
from the repository root — the backend then starts the dev server automatically.

## Production build

```bash
npm run build -- --outDir build --assetsDir statics
```

Removing the `build` directory and starting the backend with `DEBUG=false`
rebuilds the dashboard automatically.
