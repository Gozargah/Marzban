"""reformat hosts

Revision ID: 4eb0a0eb835f
Revises: be0c5f840473
Create Date: 2024-12-04 14:32:38.599601

"""
from alembic import op
from sqlalchemy.orm import Session
import commentjson
import json
from config import XRAY_JSON
from app.db.models import ProxyHost


# revision identifiers, used by Alembic.
revision = '4eb0a0eb835f'
down_revision = 'be0c5f840473'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        config = commentjson.loads(XRAY_JSON)
    except (json.JSONDecodeError, ValueError):
        with open(XRAY_JSON, 'r') as file:
            config = commentjson.loads(file.read())

    # find current inbound tags
    inbounds = [inbound['tag'] for inbound in config['inbounds'] if 'tag' in inbound]

    connection = op.get_bind()
    session = Session(bind=connection)
    # remove hosts with old inbound tag
    session.query(ProxyHost).filter(ProxyHost.inbound_tag.notin_(inbounds)).delete(synchronize_session=False)

    # Commit the changes
    session.commit()


def downgrade() -> None:
    pass
