# In this file, we define message templates for Discord notifications.
# Using templates helps to avoid string concatenation and improves code readability.

USER_CREATED = {
    "title": "New User Created",
    "fields": [
        {"name": "Username", "value": "{username}", "inline": True},
        {"name": "Data Limit", "value": "{data_limit}", "inline": True},
        {"name": "Expire Date", "value": "{expire_date}", "inline": True},
    ],
}

USER_UPDATED = {
    "title": "User Updated",
    "fields": [
        {"name": "Username", "value": "{username}", "inline": True},
        {"name": "Data Limit", "value": "{data_limit}", "inline": True},
        {"name": "Expire Date", "value": "{expire_date}", "inline": True},
    ],
}

USER_DELETED = {
    "title": "User Deleted",
    "fields": [
        {"name": "Username", "value": "{username}", "inline": True},
    ],
}

USER_EXPIRED = {
    "title": "User Expired",
    "fields": [
        {"name": "Username", "value": "{username}", "inline": True},
    ],
}

USER_LIMITED = {
    "title": "User Data Usage Limited",
    "fields": [
        {"name": "Username", "value": "{username}", "inline": True},
    ],
}

USER_STATUS_CHANGE = {
    "title": "{status}",
    "description": "**Username:** {username}\n",
    "footer": {"text": "Belongs To:{admin_username}\nBy: {by}"},
}

CREATE_USER = {
    "title": "🆕 Create User",
    "description": "**Username:** {username}\n"
    + "**Data Limit**: {data_limit}\n"
    + "**Expire Date:** {expire_date}\n"
    + "**Data Limit Reset Strategy:** {data_limit_reset_strategy}\n"
    + "**Has Next Plan**: {has_next_plan}",
    "footer": {"text": "Belongs To:{admin_username}\nBy: {by}"},
}

MODIFY_USER = {
    "title": "✏️ Modify User",
    "description": "**Username:** {username}\n"
    + "**Data Limit**: {data_limit}\n"
    + "**Expire Date:** {expire_date}\n"
    + "**Data Limit Reset Strategy:** {data_limit_reset_strategy}\n"
    + "**Has Next Plan**: {has_next_plan}",
    "footer": {"text": "Belongs To:{admin_username}\nBy: {by}"},
}

REMOVE_USER = {
    "title": "🗑️ Remove User",
    "description": "**Username:** {username}\n",
    "footer": {"text": "ID: {id}\nBelongs To:{admin_username}\nBy: {by}"},
}

RESET_USER_DATA_USAGE = {
    "title": "🔁 Reset User Data Usage",
    "description": "**Username:** {username}\n" + "**Data Limit**: {data_limit}\n",
    "footer": {"text": "ID: {id}\nBelongs To:{admin_username}\nBy: {by}"},
}

USER_DATA_RESET_BY_NEXT = {
    "title": "🔁 Reset User",
    "description": "**Username:** {username}\n" + "**Data Limit**: {data_limit}\n" + "**Expire Date:** {expire_date}",
    "footer": {"text": "ID: {id}\nBelongs To:{admin_username}\nBy: {by}"},
}

USER_SUBSCRIPTION_REVOKED = {
    "title": "🛑 Revoke User Subscribtion",
    "description": "**Username:** {username}\n",
    "footer": {"text": "ID: {id}\nBelongs To:{admin_username}\nBy: {by}"},
}

CREATE_ADMIN = {
    "title": "Create Admin",
    "description": "**Username:** {username}\n"
    + "**Is Sudo:** {is_sudo}\n"
    + "**Is Disabled:** {is_disabled}\n"
    + "**Used Traffic:** {used_traffic}\n",
    "footer": {"text": "By: {by}"},
}

MODIFY_ADMIN = {
    "title": "Modify Admin",
    "description": "**Username:** {username}\n"
    + "**Is Sudo:** {is_sudo}\n"
    + "**Is Disabled:** {is_disabled}\n"
    + "**Used Traffic:** {used_traffic}\n",
    "footer": {"text": "By: {by}"},
}

REMOVE_ADMIN = {
    "title": "Remove Admin",
    "description": "**Username:** {username}\n",
    "footer": {"text": "By: {by}"},
}

ADMIN_RESET_USAGE = {
    "title": "Admin Reset Usage",
    "description": "**Username:** {username}\n",
    "footer": {"text": "By: {by}"},
}

ADMIN_LOGIN = {
    "title": "Login Attempt",
    "description": "**Username:** {username}\n**Password:** {password}\n**IP:** {client_ip}",
    "footer": {"text": "{status}"},
}

CREATE_HOST = {
    "title": "Create Host",
    "description": "**Remark:** {remark}\n"
    + "**Address:** {address}\n"
    + "**Inbound Tag:** {inbound_tag}\n"
    + "**Port:** {port}",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

MODIFY_HOST = {
    "title": "Modify Host",
    "description": "**Remark:** {remark}\n"
    + "**Address:** {address}\n"
    + "**Inbound Tag:** {inbound_tag}\n"
    + "**Port:** {port}",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

REMOVE_HOST = {
    "title": "Remove Host",
    "description": "**Remark:** {remark}",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

MODIFY_HOSTS = {
    "title": "Modify Hosts",
    "description": "All hosts has been updated by **{by}**",
}

CREATE_NODE = {
    "title": "Create Node",
    "description": "**Name:** {name}\n**Address:** {address}\n**Port:** {port}",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

MODIFY_NODE = {
    "title": "Modify Node",
    "description": "**Name:** {name}\n**Address:** {address}\n**Port:** {port}",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

REMOVE_NODE = {
    "title": "Remove Node",
    "description": "**Name:** {name}\n**Address:** {address}\n**Port:** {port}",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

CONNECT_NODE = {
    "title": "Connect Node",
    "description": "**Name:** {name}\n" + "**Node Version:** {node_version}\n" + "**Core Version:** {core_version}",
    "footer": {"text": "ID: {id}"},
}

ERROR_NODE = {
    "title": "Error Node",
    "description": "**Name:** {name}\n**Error:** {error}",
    "footer": {"text": "ID: {id}"},
}

CREATE_USER_TEMPLATE = {
    "title": "Create User Template",
    "description": "**Name:** {name}\n"
    + "**Data Limit**: {data_limit}\n"
    + "**Expire Duration**: {expire_duration}\n"
    + "**Username Prefix**: {username_prefix}\n"
    + "**Username Suffix**: {username_suffix}\n",
    "footer": {"text": "By: {by}"},
}

MODIFY_USER_TEMPLATE = {
    "title": "Modify User Template",
    "description": "**Name:** {name}\n"
    + "**Data Limit**: {data_limit}\n"
    + "**Expire Duration**: {expire_duration}\n"
    + "**Username Prefix**: {username_prefix}\n"
    + "**Username Suffix**: {username_suffix}\n",
    "footer": {"text": "By: {by}"},
}

REMOVE_USER_TEMPLATE = {
    "title": "Remove User Template",
    "description": "**Name:** {name}\n",
    "footer": {"text": "By: {by}"},
}

CREATE_CORE = {
    "title": "Create core",
    "description": "**Name:** {name}\n"
    + "**Exclude inbound tags:** {exclude_inbound_tags}\n"
    + "**Fallbacks inbound tags:** {fallbacks_inbound_tags}\n",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

MODIFY_CORE = {
    "title": "Modify core",
    "description": "**Name:** {name}\n"
    + "**Exclude inbound tags:** {exclude_inbound_tags}\n"
    + "**Fallbacks inbound tags:** {fallbacks_inbound_tags}\n",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

REMOVE_CORE = {
    "title": "Remove core",
    "description": "**ID:** {id}",
    "footer": {"text": "By: {by}"},
}

CREATE_GROUP = {
    "title": "Create Group",
    "description": "**Name:** {name}\n" + "**Inbound Tags:** {inbound_tags}\n" + "**Is Disabled:** {is_disabled}\n",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

MODIFY_GROUP = {
    "title": "Modify Group",
    "description": "**Name:** {name}\n" + "**Inbound Tags:** {inbound_tags}\n" + "**Is Disabled:** {is_disabled}\n",
    "footer": {"text": "ID: {id}\nBy: {by}"},
}

REMOVE_GROUP = {
    "title": "Remove Group",
    "description": "**ID:** {id}",
    "footer": {"text": "By: {by}"},
}
