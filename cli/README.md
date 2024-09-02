# CLI

**Usage**:

```console
$ [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `admin`
* `completion`: Generate and install completion scripts.
* `subscription`
* `user`

## `admin`

**Usage**:

```console
$ admin [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `create`: Creates an admin
* `delete`: Deletes the specified admin
* `import-from-env`: Imports the sudo admin from env
* `list`: Displays a table of admins
* `update`: Updates the specified admin

### `admin create`

Creates an admin

Password can also be set using the `MARZBAN_ADMIN_PASSWORD` environment variable for non-interactive usages.

**Usage**:

```console
$ admin create [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--sudo / --no-sudo`: [default: no-sudo]
* `-tg, --telegram-id TEXT`
* `-dc, --discord-webhook TEXT`
* `--help`: Show this message and exit.

### `admin delete`

Deletes the specified admin

Confirmations can be skipped using `--yes/-y` option.

**Usage**:

```console
$ admin delete [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.

### `admin import-from-env`

Imports the sudo admin from env

Confirmations can be skipped using `--yes/-y` option.

What does it do?
  - Creates a sudo admin according to `SUDO_USERNAME` and `SUDO_PASSWORD`.
  - Links any user which doesn't have an `admin_id` to the imported sudo admin.

**Usage**:

```console
$ admin import-from-env [OPTIONS]
```

**Options**:

* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.

### `admin list`

Displays a table of admins

**Usage**:

```console
$ admin list [OPTIONS]
```

**Options**:

* `-o, --offset INTEGER`
* `-l, --limit INTEGER`
* `-u, --username TEXT`: Search by username
* `--help`: Show this message and exit.

### `admin update`

Updates the specified admin

NOTE: This command CAN NOT be used non-interactively.

**Usage**:

```console
$ admin update [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--help`: Show this message and exit.

## `completion`

Generate and install completion scripts.

**Usage**:

```console
$ completion [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `install`: Install completion for the specified shell.
* `show`: Show completion for the specified shell,...

### `completion install`

Install completion for the specified shell.

**Usage**:

```console
$ completion install [OPTIONS]
```

**Options**:

* `--shell [bash|zsh|fish|powershell|pwsh]`: The shell to install completion for.
* `--help`: Show this message and exit.

### `completion show`

Show completion for the specified shell, to copy or customize it.

**Usage**:

```console
$ completion show [OPTIONS]
```

**Options**:

* `--shell [bash|zsh|fish|powershell|pwsh]`: The shell to install completion for.
* `--help`: Show this message and exit.

## `subscription`

**Usage**:

```console
$ subscription [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `get-config`: Generates a subscription config.
* `get-link`: Prints the given user's subscription link.

### `subscription get-config`

Generates a subscription config.

Generates a subscription config for the given user in the given format.

The output will be written in the output file when the `output-file` is present,
  otherwise will be shown in the terminal.

**Usage**:

```console
$ subscription get-config [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `-f, --format [v2ray|clash]`: [required]
* `-o, --output TEXT`: Writes the generated config in the file if provided
* `--base64`: Encodes output in base64 format if present
* `--help`: Show this message and exit.

### `subscription get-link`

Prints the given user's subscription link.

NOTE: This command needs `XRAY_SUBSCRIPTION_URL_PREFIX` environment variable to be set
  in order to work correctly.

**Usage**:

```console
$ subscription get-link [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--help`: Show this message and exit.

## `user`

**Usage**:

```console
$ user [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `list`: Displays a table of users
* `set-owner`: Transfers user's ownership

### `user list`

Displays a table of users

NOTE: Sorting is not currently available.

**Usage**:

```console
$ user list [OPTIONS]
```

**Options**:

* `-o, --offset INTEGER`
* `-l, --limit INTEGER`
* `-u, --username TEXT`: Search by username(s)
* `-s, --search TEXT`: Search by username/note
* `--status [active|disabled|limited|expired|on_hold]`
* `--admin, --owner TEXT`: Search by owner admin's username(s)
* `--help`: Show this message and exit.

### `user set-owner`

Transfers user's ownership

NOTE: This command needs additional confirmation for users who already have an owner.

**Usage**:

```console
$ user set-owner [OPTIONS]
```

**Options**:

* `-u, --username TEXT`
* `--admin, --owner TEXT`: Admin's username
* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.
