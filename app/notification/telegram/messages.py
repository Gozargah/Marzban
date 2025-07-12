# In this file, we define message templates for Telegram notifications.
# Using templates helps to avoid string concatenation and improves code readability.

USER_STATUS_CHANGE = """
{status}
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

CREATE_USER = """
🆕 #Create_User
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Data Limit</b>: <code>{data_limit}</code>
<b>Expire Date:</b> <code>{expire_date}</code>
<b>Data Limit Reset Strategy:</b> <code>{data_limit_reset_strategy}</code>
<b>Has Next Plan</b>: <code>{has_next_plan}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

MODIFY_USER = """
✏️ #Modify_User
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Data Limit</b>: <code>{data_limit}</code>
<b>Expire Date:</b> <code>{expire_date}</code>
<b>Data Limit Reset Strategy:</b> <code>{data_limit_reset_strategy}</code>
<b>Has Next Plan</b>: <code>{has_next_plan}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

REMOVE_USER = """
🗑️ #Remove_User
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

RESET_USER_DATA_USAGE = """
🔁 #Reset_User_Data_Usage
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Data Limit</b>: <code>{data_limit}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

USER_DATA_RESET_BY_NEXT = """
🔁 #Reset_User_By_Next
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Data Limit</b>: <code>{data_limit}</code>
<b>Expire Date:</b> <code>{expire_date}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

USER_SUBSCRIPTION_REVOKED = """
🛑 #Revoke_User_Subscribtion
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<i>Belongs To</i>: <code>{admin_username}</code>
<i>By: #{by}</i>
"""

CREATE_ADMIN = """
#Create_Admin
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Is Sudo:</b> <code>{is_sudo}</code>
<b>Is Disabled:</b> <code>{is_disabled}</code>
<b>Used Traffic:</b> <code>{used_traffic}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

MODIFY_ADMIN = """
#Modify_Admin
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Is Sudo:</b> <code>{is_sudo}</code>
<b>Is Disabled:</b> <code>{is_disabled}</code>
<b>Used Traffic:</b> <code>{used_traffic}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

REMOVE_ADMIN = """
#Remove_Admin
<b>Username:</b> <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

ADMIN_RESET_USAGE = """
#Admin_Usage_Reset
<b>Username:</b> <code>{username}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

ADMIN_LOGIN = """
#Login_Attempt
<i>Status</i>: {status}
➖➖➖➖➖➖➖➖➖
<b>Username:</b> <code>{username}</code>
<b>Password:</b> <code>{password}</code>
<b>IP:</b> <code>{client_ip}</code>
"""

CREATE_HOST = """
#Create_Host
➖➖➖➖➖➖➖➖➖
<b>Remark:</b> <code>{remark}</code>
<b>Address:</b> <code>{address}</code>
<b>Inbound Tag:</b> <code>{tag}</code>
<b>Port:</b> <code>{port}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
<i>By: #{by}</i>
"""

MODIFY_HOST = """
#Modify_Host
➖➖➖➖➖➖➖➖➖
<b>Remark:</b> <code>{remark}</code>
<b>Address:</b> <code>{address}</code>
<b>Inbound Tag:</b> <code>{tag}</code>
<b>Port:</b> <code>{port}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
<i>By: #{by}</i>
"""

REMOVE_HOST = """
#Remove_Host
➖➖➖➖➖➖➖➖➖
<b>Remark:</b> <code>{remark}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: {id}
<i>By: #{by}</i>
"""

MODIFY_HOSTS = """
#Modify_Hosts
➖➖➖➖➖➖➖➖➖
All hosts has been updated by <b>#{by}</b>
"""

CREATE_NODE = """
#Create_Node
➖➖➖➖➖➖➖➖➖
<b>ID:</b> <code>{id}</code>
<b>Name:</b> <code>{name}</code>
<b>Address:</b> <code>{address}</code>
<b>Port:</b> <code>{port}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

MODIFY_NODE = """
#Modify_Node
➖➖➖➖➖➖➖➖➖
<b>ID:</b> <code>{id}</code>
<b>Name:</b> <code>{name}</code>
<b>Address:</b> <code>{address}</code>
<b>Port:</b> <code>{port}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

REMOVE_NODE = """
#Remove_Node
➖➖➖➖➖➖➖➖➖
<b>ID:</b> <code>{id}</code>
<b>Name:</b> <code>{name}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

CONNECT_NODE = """
#Connect_Node
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Node Version:</b> <code>{node_version}</code>
<b>Core Version:</b> <code>{core_version}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
"""

ERROR_NODE = """
#Error_Node
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Error:</b> {error}
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
"""

CREATE_USER_TEMPLATE = """
#Create_User_Template
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Data Limit:</b> <code>{data_limit}</code>
<b>Expire Duration:</b> <code>{expire_duration}</code>
<b>Username Prefix:</b> <code>{username_prefix}</code>
<b>Username Suffix:</b> <code>{username_suffix}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

MODIFY_USER_TEMPLATE = """
#Modify_User_Template
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Data Limit:</b> <code>{data_limit}</code>
<b>Expire Duration:</b> <code>{expire_duration}</code>
<b>Username Prefix:</b> <code>{username_prefix}</code>
<b>Username Suffix:</b> <code>{username_suffix}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

REMOVE_USER_TEMPLATE = """
#Remove_User_Template
<b>Name:</b> <code>{name}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

CREATE_CORE = """
#Create_core
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Exclude inbound tags:</b> <code>{exclude_inbound_tags}</code>
<b>Fallbacks inbound tags:</b> <code>{fallbacks_inbound_tags}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
<i>By: #{by}</i>
"""

MODIFY_CORE = """
#Modify_core
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Exclude inbound tags:</b> <code>{exclude_inbound_tags}</code>
<b>Fallbacks inbound tags:</b> <code>{fallbacks_inbound_tags}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
<i>By: #{by}</i>
"""

REMOVE_CORE = """
#Remove_core
➖➖➖➖➖➖➖➖➖
<b>ID:</b> <code>{id}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""

CREATE_GROUP = """
#Create_Group
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Inbound Tags:</b> <code>{inbound_tags}</code>
<b>Is Disabled:</b> <code>{is_disabled}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
<i>By: #{by}</i>
"""

MODIFY_GROUP = """
#Modify_Group
➖➖➖➖➖➖➖➖➖
<b>Name:</b> <code>{name}</code>
<b>Inbound Tags:</b> <code>{inbound_tags}</code>
<b>Is Disabled:</b> <code>{is_disabled}</code>
➖➖➖➖➖➖➖➖➖
<i>ID</i>: <code>{id}</code>
<i>By: #{by}</i>
"""

REMOVE_GROUP = """
#Remove_Group
➖➖➖➖➖➖➖➖➖
<b>ID:</b> <code>{id}</code>
➖➖➖➖➖➖➖➖➖
<i>By: #{by}</i>
"""
