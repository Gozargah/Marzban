# Dashboard UI for marzban

## Requirements

For development, you will only need Node.js installed on your environement.

### Node

[Node](http://nodejs.org/) is really easy to install & now include [NPM](https://npmjs.org/).
This project has been developed on the Nodejs v16.17.0 so if you faced any issue during installation that may related to the node version, install Node with version >= v16.17.0.

## Install

    git clone https://github.com/gozargah/marz-manager.git
    cd marz-manager
    yarn install

### Configure app

Copy `example.env` to `.env` then set the backend api address:

    VITE_BASE_API=https://somewhere.com/

#### Environment variables

| Name          | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| VITE_BASE_API | The api url of the deployed backend ([Marzban](https://github.com/gozargah/Marzban)) |

## Start development server

    yarn dev

## Simple build for production

    yarn build

## Contribution

Feel free to contribute. Go on and fork the project. After commiting the changes, make a PR. It means a lot to us.

## Frontend tests

From this directory, install dependencies with `bun install --frozen-lockfile` and run:

```sh
bun run test
bun run test:typecheck
```

The Bun suite is in [`test`](test/README.md), with shared fixtures, isolated API adapters, headless component tests, and watch/coverage commands. No running app or backend is required.
