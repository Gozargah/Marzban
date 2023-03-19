# `marzban-cli`

**Usage**:

```console
$ marzban-cli [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--install-completion`: Install completion for the current shell.
* `--show-completion`: Show completion for the current shell, to copy it or customize the installation.
* `--help`: Show this message and exit.

**Commands**:

* `admin`

## `marzban-cli admin`

**Usage**:

```console
$ marzban-cli admin [OPTIONS] COMMAND [ARGS]...
```

**Options**:

* `--help`: Show this message and exit.

**Commands**:

* `create`: Creates an admin
* `delete`: Deletes the specified admin
* `import-from-env`: Imports the sudo admin from env
* `list`: Displays a table of admins
* `update`: Updates the specified admin

### `marzban-cli admin create`

Creates an admin

Password can also be set using the `MARZBAN_ADMIN_PASSWORD` environment variable for non-interactive usages.

**Usage**:

```console
$ marzban-cli admin create [OPTIONS]
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
$ marzban-cli admin delete [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.

### `marzban-cli admin import-from-env`

Imports the sudo admin from env

Confirmations can be skipped using `--yes/-y` option.

What does it do?
  - Creates a sudo admin according to `SUDO_USERNAME` and `SUDO_PASSWORD`.
  - Links any user which doesn't have an `admin_id` to the imported sudo admin.

**Usage**:

```console
$ marzban-cli admin import-from-env [OPTIONS]
```

**Options**:

* `-y, --yes`: Skips confirmations
* `--help`: Show this message and exit.

### `marzban-cli admin list`

Displays a table of admins

**Usage**:

```console
$ marzban-cli admin list [OPTIONS]
```

**Options**:

* `-o, --offset INTEGER`
* `-l, --limit INTEGER`
* `-u, --username TEXT`: Search by username
* `--help`: Show this message and exit.

### `marzban-cli admin update`

Updates the specified admin

NOTE: This command CAN NOT be used non-interactively.

**Usage**:

```console
$ marzban-cli admin update [OPTIONS]
```

**Options**:

* `-u, --username TEXT`: [required]
* `--help`: Show this message and exit.
