# Dashboard UI for marzban

## Requirements

For development, you will only need Node.js installed on your environement.

### Node

[Node](http://nodejs.org/) is really easy to install & now include [NPM](https://npmjs.org/).
This project has been developed on the Nodejs v20.x so if you faced any issue during installation that may related to the node version, install Node with version >= v20

## Install
    Install the latest LTS version of Node.js
    git clone https://github.com/Gozargah/Marzban.git
    `bash cd Marzban/app/dashboard`
	`bash corepack enable`
    `bash pnpm install`

### Configure app

Copy `example.env` to `.env` then set the backend api address:

    VITE_BASE_API=https://somewhere.com/

#### Environment variables

| Name          | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| VITE_BASE_API | The api url of the deployed backend ([Marzban](https://github.com/gozargah/Marzban)) |

## Start development server

    pnpm dev

## Simple build for production

    pnpm build

## Contribution

Feel free to contribute. Go on and fork the project. After commiting the changes, make a PR. It means a lot to us.
