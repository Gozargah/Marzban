"""migrate to groups

Revision ID: 16e19723febc
Revises: 3b59f3680c90
Create Date: 2025-03-17 08:45:33.514529

"""
import json
from enum import Enum
from collections import defaultdict, Counter
from decouple import config as decouple_config

import commentjson
import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, ForeignKey, MetaData, Table
from sqlalchemy.orm import Session
from app.db.models import (
    User,
    ProxyInbound,
)


# revision identifiers, used by Alembic.
revision = '16e19723febc'
down_revision = '3b59f3680c90'
branch_labels = None
depends_on = None


class ProxyTypes(str, Enum):
    VMess = "vmess"
    VLESS = "vless"
    Trojan = "trojan"
    Shadowsocks = "shadowsocks"


group_table = Table(
    "groups",
    MetaData(),
    Column('id', sa.Integer, primary_key=True),
    Column("name",sa.String(64),unique=True),
    Column("is_disabled",sa.Boolean(),default=False)
)
proxy_table = Table(
        'proxies',
        MetaData(),
        Column('id', sa.Integer, primary_key=True),
        Column('user_id', ForeignKey("users.id")),
        Column('type', sa.Enum(ProxyTypes)),
        Column('settings', sa.JSON)
    )
user_template_table = Table(
        "user_templates",
        MetaData(),
        Column('id', sa.Integer, primary_key=True),
        Column("name",sa.String(64),unique=True),
        Column("data_limit", sa.BigInteger, default=0),
        Column("expire_duration", sa.BigInteger, default=0),  
        Column("username_prefix", sa.String(20)),
        Column("username_suffix", sa.String(20)),
    )
template_group_association = Table(
        "template_group_association",
        MetaData(),
        Column("user_template_id", ForeignKey("user_templates.id")),
        Column("group_id", ForeignKey("groups.id")),
    )
template_inbounds_association = Table(
        "template_inbounds_association",
        MetaData(),
        Column("user_template_id", ForeignKey("user_templates.id")),
        Column("inbound_tag", ForeignKey("inbounds.tag")),
    )
excluded_inbounds_association = Table(
        "exclude_inbounds_association",
        MetaData(),
        Column("proxy_id", ForeignKey("proxies.id")),
        Column("inbound_tag", ForeignKey("inbounds.tag")),
    )
inbounds_groups_association = Table(
    "inbounds_groups_association",
    MetaData(),
    Column("inbound_id", ForeignKey("inbounds.id") ),
    Column("group_id", ForeignKey("groups.id") ),
)
users_groups_association = Table(
    "users_groups_association",
    MetaData(),
    Column("user_id", ForeignKey("users.id")),
    Column("groups_id", ForeignKey("groups.id")),
)

base_xray = {
    "log": {"loglevel": "warning"},
    "inbounds": [
        {
            "tag": "Shadowsocks TCP",
            "listen": "0.0.0.0",
            "port": 1080,
            "protocol": "shadowsocks",
            "settings": {"clients": [], "network": "tcp,udp"},
        }
    ],
    "outbounds": [{"protocol": "freedom", "tag": "DIRECT"}, {"protocol": "blackhole", "tag": "BLOCK"}],
    "routing": {"rules": [{"ip": ["geoip:private"], "outboundTag": "BLOCK", "type": "field"}]},
}

def get_config(key, default=None, cast=None):
    if cast is not None:
        return decouple_config(key, default=default, cast=cast)
    else:
        return decouple_config(key, default=default)

XRAY_JSON = get_config("XRAY_JSON", default="./xray_config.json")


def upgrade() -> None:
    
    try:
        connection = op.get_bind()
        session = Session(bind=connection)
        if session.query(User.id).count() <= 0:
            return
        result = (
            session.query(
                User.id.label("user_id"),
                proxy_table.c.type.label("proxy_type"),
                ProxyInbound.tag.label("excluded_inbound_tag"),
            )
            .join(proxy_table, proxy_table.c.user_id == User.id)
            .outerjoin(excluded_inbounds_association, proxy_table.c.id == excluded_inbounds_association.c.proxy_id)
            .outerjoin(ProxyInbound, excluded_inbounds_association.c.inbound_tag == ProxyInbound.tag)
            .group_by(User.id,  proxy_table.c.type,  ProxyInbound.tag)
            .order_by(User.id, proxy_table.c.type)
            .all()
        )
        template_count = session.query(user_template_table).count()
        if template_count > 0:
            templates = (
                session.query(
                    user_template_table.c.id.label("tid"),
                    template_inbounds_association.c.inbound_tag.label("inbounds"),
                )
                .outerjoin(ProxyInbound, template_inbounds_association.c.inbound_tag == ProxyInbound.tag)
                .group_by(user_template_table.c.id, template_inbounds_association.c.inbound_tag)
                .order_by(user_template_table.c.id)
                .all()
            )
            template_dict = defaultdict(lambda: {"id": 0, "inbounds": []})
            for row in templates:
                tid = row.tid
                t_inbounds = row.inbounds
                template_dict[tid]["id"] = tid
                template_dict[tid]["inbounds"].append(t_inbounds)

        users_dict = defaultdict(lambda: {"proxy_type": set(), "excluded_inbounds": []})

        for row in result:
            user_id = row.user_id
            tag = row.excluded_inbound_tag or "No Excluded Inbounds"
            proxy_type = row.proxy_type
            users_dict[user_id]["proxy_type"].add(proxy_type)
            users_dict[user_id]["excluded_inbounds"].append(tag)
            if len(users_dict[user_id]["excluded_inbounds"]) > 1 and "No Excluded Inbounds" in users_dict[user_id]["excluded_inbounds"]:
                users_dict[user_id]["excluded_inbounds"].remove("No Excluded Inbounds")

        groups = defaultdict(list)

        for key, value in users_dict.items():
            excluded_inbounds = tuple(sorted(value["excluded_inbounds"]))
            groups[excluded_inbounds].append({"id": key, **value})

        try:
            with open(XRAY_JSON, 'r') as file:
                config = commentjson.loads(file.read())
        except Exception:
            config = base_xray

        inbounds = [{"tag": inbound['tag'], "protocol": inbound["protocol"]}
                    for inbound in config['inbounds'] if 'tag' in inbound]

        users_dict = defaultdict(lambda: {"proxy_type": set(), "excluded_inbounds": [], "inbounds": []})
        for k, users in groups.items():
            for user in users:
                users_dict[user["id"]].update(**user)
                inbounds_ = []
                for t in user["proxy_type"]:
                    for i in inbounds:
                        if t == i["protocol"] and i["tag"] not in user["excluded_inbounds"]:
                            inbounds_.append(i["tag"])
                users_dict[user["id"]]["inbounds"] = inbounds_

        grouped = defaultdict(list)

        for key, value in users_dict.items():
            group_key = json.dumps({
                "inbounds": value["inbounds"],
            }, sort_keys=True)

            grouped[group_key].append({"id": value["id"]})

        result = {}
        counter = 1
        result["templates"] = {}
        for group_key, users in grouped.items():
            group_name = f"group{counter}"
            group_data = json.loads(group_key)
            dbinbounds = session.query(ProxyInbound).filter(ProxyInbound.tag.in_(group_data["inbounds"])).all()
            session.execute(
            group_table.insert().values(
                name=group_name,
            ))
            group_id = session.execute(sa.select(group_table).where(group_table.c.name == group_name)).scalar()
            
            # Fix: Check if dbinbounds is not empty before inserting
            if dbinbounds:
                inbound_data = [
                    {"inbound_id": i.id, "group_id": group_id} for i in dbinbounds if i.id is not None
                ]
                
                # Add additional check to ensure we're not inserting empty values
                if inbound_data:
                    session.execute(
                        inbounds_groups_association.insert(),
                        inbound_data
                    )
            
            users_data = [{"user_id": user["id"], "groups_id": group_id} for user in users]
            session.execute(
                users_groups_association.insert(),
                users_data,
            )
            counter += 1
            if template_count <= 0:
                continue
            session.commit()
            for k, val in template_dict.items():
                if Counter(val["inbounds"]) == Counter(group_data["inbounds"]):
                    # Check if association already exists
                    exists = session.execute(
                        sa.select(template_group_association).where(
                            (template_group_association.c.user_template_id == int(k)) &
                            (template_group_association.c.group_id == group_id)
                        )
                    ).scalar()
                    
                    if not exists:
                        # Insert new association
                        session.execute(
                            template_group_association.insert().values(
                                user_template_id=int(k),
                                group_id=group_id
                            )
                        )

        if template_count > 0:
            dbtemplates_assin = session.execute(template_inbounds_association.select()).all()
            grouped_data = defaultdict(list)
            for number, text in dbtemplates_assin:
                grouped_data[number].append(text)

            for k,inbounds in grouped_data.items():
                group_name = f"group{counter}"
                user_template = session.execute(user_template_table.select().where(user_template_table.c.id == int(k))).first()

                template_groups = session.execute(template_group_association.select().where(template_group_association.c.user_template_id == k)).first()
                if not template_groups:
                    session.execute(group_table.insert().values(
                        name=group_name
                    ))
                    group_id = session.execute(sa.select(group_table).where(group_table.c.name == group_name)).scalar()

                    dbinbounds = session.query(ProxyInbound).filter(ProxyInbound.tag.in_(inbounds)).all()
                    
                    # Fix: Similar check here to ensure we have valid data before insert
                    if dbinbounds:
                        inbound_data = [
                            {"inbound_id": i.id, "group_id": group_id} for i in dbinbounds if i.id is not None
                        ]
                        
                        # Add additional check to ensure we're not inserting empty values
                        if inbound_data:
                            session.execute(
                                inbounds_groups_association.insert(),
                                inbound_data
                            )
                    
                    session.execute(
                       template_group_association.insert().values(
                                user_template_id=int(k),
                                group_id=group_id,
                           )
                    )
                    counter += 1

    finally:
        session.commit()
        session.close()

def downgrade() -> None:
    pass