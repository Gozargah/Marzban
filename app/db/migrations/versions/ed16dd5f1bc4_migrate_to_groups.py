"""migrate to groups

Revision ID: ed16dd5f1bc4
Revises: ed4ea5ae1cf0
Create Date: 2024-12-20 09:26:23.847134

"""
import json
from collections import defaultdict

import commentjson
import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, ForeignKey, MetaData, Table
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    Group,
    ProxyInbound,
    User,
    UserTemplate,
)
from app.models.proxy import ProxyTypes
from config import XRAY_JSON

# revision identifiers, used by Alembic.
revision = 'ed16dd5f1bc4'
down_revision = 'ed4ea5ae1cf0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    db = Session(bind=connection)
    if db.query(User.id).count() <= 0:
        return
    proxy_table = Table(
        'proxies',
        MetaData(),
        Column('id', sa.Integer, primary_key=True),
        Column('user_id', ForeignKey("users.id")),
        Column('type', sa.Enum(ProxyTypes)),
        Column('settings', sa.JSON)
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
    result = (
        db.query(
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
    template_count = db.query(UserTemplate).count()
    if template_count > 0:
        templates = (
            db.query(
                UserTemplate.id.label("tid"),
                template_inbounds_association.c.inbound_tag.label("inbounds"),
            )
            .outerjoin(ProxyInbound, template_inbounds_association.c.inbound_tag == ProxyInbound.tag)
            .group_by(UserTemplate.id, template_inbounds_association.c.inbound_tag)
            .order_by(UserTemplate.id)
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
        config = commentjson.loads(XRAY_JSON)
    except (json.JSONDecodeError, ValueError):
        with open(XRAY_JSON, 'r') as file:
            config = commentjson.loads(file.read())
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
        dbinbounds = db.query(ProxyInbound).filter(ProxyInbound.tag.in_(group_data["inbounds"])).all()
        dbgroup = Group(
            name=group_name,
        )
        dbgroup.inbounds.extend(dbinbounds)
        db.add(dbgroup)
        db.commit()
        db.refresh(dbgroup)
        users_id = [user["id"] for user in users]
        dbusers = db.query(User).filter(User.id.in_(users_id)).all()
        for dbuser in dbusers:
            dbuser.groups.append(dbgroup)
        db.add_all(dbusers)
        if template_count <= 0:
            continue
        for k, val in template_dict.items():
            if val["inbounds"] == group_data["inbounds"]:
                template = db.query(UserTemplate).filter(UserTemplate.id == k).first()
                template.groups.append(dbgroup)
                db.add(template)
        counter += 1
    inbounds = [inbound['tag'] for inbound in config['inbounds'] if 'tag' in inbound]
    db.query(ProxyInbound).filter(ProxyInbound.tag.notin_(inbounds)).delete(synchronize_session=False)
    db.commit()
    if template_count > 0:
        dbtemplates = db.query(UserTemplate).options(joinedload(UserTemplate.groups)).all()
        for dbtemplate in dbtemplates:
            group_name = f"group{counter}"
            if len(dbtemplate.groups) <= 0:
                t_inbounds = template_dict.get(int(dbtemplate.id))["inbounds"]
                dbinbounds = db.query(ProxyInbound).filter(ProxyInbound.tag.in_(t_inbounds)).all()
                group = Group(
                    name=group_name,
                )
                group.inbounds.extend(dbinbounds)
                db.add(group)
                db.commit()
                db.refresh(group)
                dbtemplate.groups = [group]
                db.add(dbtemplate)
                counter += 1
    db.commit()


def downgrade() -> None:
    pass
