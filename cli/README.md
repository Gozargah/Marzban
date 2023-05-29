# `marzban-cli`

**Usage**:

```console
marzban cli [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--install-completion`: Install completion for the current shell.
* `--show-completion`: Show completion for the current shell, to copy it or customize the installation.
* `--help`: Show this message and exit.

**Commands**:

* `admin`
* `subscription`
* `user`

## `marzban cli admin`

**Usage**:

```console
marzban cli admin [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `create`: Creates an admin
* `delete`: Deletes the specified admin
* `import-from-env`: Imports the sudo admin from env
* `list`: Displays a table of admins
* `update`: Updates the specified admin

### `marzban cli admin create`

Creates an admin

Password can also be set using the `MARZBAN_ADMIN_PASSWORD` environment variable for non-interactive usages.

**Usage**:

```console
marzban-cli admin create [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--sudo / --no-sudo`
* `--help`: Show this message and exit.

### `marzban-cli admin delete`

Deletes the specified admin

Confirmations can be skipped using `--yes/-y` option.

**Usage**:

```console
marzban cli admin delete [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.

### `marzban cli admin import-from-env`

Imports the sudo admin from env

Confirmations can be skipped using `--yes/-y` option.

What does it do?
  - Creates a sudo admin according to `SUDO_USERNAME` and `SUDO_PASSWORD`.
  - Links any user which doesn't have an `admin_id` to the imported sudo admin.

**Usage**:

```console
marzban cli admin import-from-env [OPTIONS]
```

**Options**:

* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.

### `marzban cli admin list`

Displays a table of admins

**Usage**:

```console
marzban cli admin list [OPTIONS]
```

**Options**:

* `-o, --offset INTEGER`
* `-l, --limit INTEGER`
* `-u, --username TEXT`: Search by username
* `--help`: Show this message and exit.

### `marzban cli admin update`

Updates the specified admin

NOTE: This command CAN NOT be used non-interactively.

**Usage**:

```console
marzban cli admin update [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--help`: Show this message and exit.

## `marzban cli subscription`

**Usage**:

```console
marzban cli subscription [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `get-config`: Generates a subscription config.
* `get-link`: Prints the given user's subscription link.

### `marzban cli subscription get-config`

Generates a subscription config.

Generates a subscription config for the given user in the given format.

The output will be written in the output file when the `output-file` is present,
  otherwise will be shown in the terminal.

**Usage**:

```console
marzban cli subscription get-config [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `-f, --format [v2ray|clash]`: [required]
* `-o, --output TEXT`: Writes the generated config in the file if provided
* `--base64`: Encodes output in base64 format if present
* `--help`: Show this message and exit.

### `marzban cli subscription get-link`

Prints the given user's subscription link.

NOTE: This command needs `XRAY_SUBSCRIPTION_URL_PREFIX` environment variable to be set
  in order to work correctly.

**Usage**:

```console
marzban cli subscription get-link [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--help`: Show this message and exit.

## `marzban cli user`

**Usage**:

```console
marzban cli user [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `list`: Displays a table of users
* `set-owner`: Transfers user's ownership

### `marzban cli user list`

Displays a table of users

NOTE: Sorting is not currently available.

**Usage**:

```console
marzban cli user list [OPTIONS]
```

**Options**:

* `-o, --offset INTEGER`
* `-l, --limit INTEGER`
* `-u, --username TEXT`: Search by username
* `--status [active|disabled|limited|expired]`
* `--admin, --owner TEXT`: Search by owner admin's username
* `--help`: Show this message and exit.

### `marzban cli user set-owner`

Transfers user's ownership

NOTE: This command needs additional confirmation for users who already have an owner.

**Usage**:

```console
marzban cli user set-owner [OPTIONS]
```

**Options**:

* `-u, --username TEXT`
* `--admin, --owner TEXT`: Admin's username
* `-y, --yes`: Skips confirmation.
* `--help`: Show this message and exit.
