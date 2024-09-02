# Clash Template

## Usage
- Can be used to send completely prepared config to users depend on your usage.

## Config Template
- With the config template, you can change things like routing and rules.

## Settings Template
You can change some values in custom configs depending on the streamSettings type that is not accessible directly from the dashboard.

For example, you can change these values for http configs (you can change anything that is part of netSettings except those accessible from the dashboard).
```yaml
http-opts:
  - ip-version: dual
    method: "GET"
    headers:
      Connection:
        - keep-alive
```
### supported network type
| network     | support |
|-------------|--------:|
| WebSocket   |       ✅ |
| gRPC        |       ✅ |
| http        |       ✅ |
| h2          |       ✅ |
| kcp         |       ❌ |
| tcp         |       ✅ |
| httpupgrade |      ♻️ |
| splithttp   |       ❌ |

♻️ In clash httpupgrade it's part of WebSocket.

## How To Use
First of all, you need to set a directory for all of your templates (home, subscription page, etc.).
```shell
CUSTOM_TEMPLATES_DIRECTORY="/var/lib/marzban/templates/"
```
Make sure you put all of your templates in this folder.\
If you are using Docker, make sure Docker has access to this folder.\
Then, we need to make a directory for our Clash template.
```shell
mkdir /var/lib/marzban/templates/v2ray
```
After that, put your templates (config and settings) in the directory.\
Now, change these variables with your files' names.
```shell
CLASH_SUBSCRIPTION_TEMPLATE = "clash/default.yml")
CLASH_SETTINGS_TEMPLATE = "clash/settings.yml")
```
Now, restart your Marzban and enjoy.

If you have already changed your env variables, and you want to just update the template files, there is no need to restart Marzban.

## Docs
you can use these docs to find out how to modify template files

[Mihomo Docs](https://wiki.metacubex.one/en/) 