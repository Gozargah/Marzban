"""change fragments and noise from regex to json

Revision ID: 95da30deba8d
Revises: eaa9f30f983e
Create Date: 2025-02-26 21:54:13.977279

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision = '95da30deba8d'
down_revision = 'eaa9f30f983e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('hosts')]
    
    # If both target columns already exist, skip the migration entirely
    if 'noise_settings' in existing_columns and 'fragment_settings' in existing_columns:
        return
    
    session = Session(bind=bind)
    
    def regex_to_json(table: sa.Table):
        # Only query columns that exist
        columns_to_query = [table.c.id]
        if 'fragment_setting' in existing_columns:
            columns_to_query.append(table.c.fragment_setting)
        if 'noise_setting' in existing_columns:
            columns_to_query.append(table.c.noise_setting)
            
        for row in session.query(*columns_to_query).all():
            updates = {}
            
            if 'fragment_setting' in existing_columns and hasattr(row, 'fragment_setting') and row.fragment_setting:
                fragment = row.fragment_setting
                fragment_json = sa.null()
                if fragment:
                    try:
                        length, interval, packets = fragment.split(",")
                        fragment_json = {"xray": {"packets": packets, "length": length, "interval": interval}}
                        updates['fragment_settings'] = fragment_json
                    except ValueError:
                        pass
                        
            if 'noise_setting' in existing_columns and hasattr(row, 'noise_setting') and row.noise_setting:
                noises = row.noise_setting
                noises_settings_json = sa.null()
                if noises:
                    try:
                        sn = noises.split("&")
                        noises_settings_json = {"xray": []}
                        for n in sn:
                            try:
                                tp, delay = n.split(",")
                                _type, packet = tp.split(":")
                                noises_settings_json["xray"].append(
                                    {"type": _type, "packet": packet, "delay": delay})
                            except ValueError:
                                continue
                        updates['noise_settings'] = noises_settings_json
                    except ValueError:
                        pass
                        
            if updates:
                session.execute(
                    table.update().where(table.c.id == row.id).values(**updates)
                )
    
    # Add new JSON columns
    if 'noise_settings' not in existing_columns:
        op.add_column('hosts', sa.Column('noise_settings', sa.JSON(none_as_null=True), nullable=True))
    
    if 'fragment_settings' not in existing_columns:
        op.add_column('hosts', sa.Column('fragment_settings', sa.JSON(none_as_null=True), nullable=True))

    try:
        with op.batch_alter_table('hosts') as batch_op:
            hosts_table = sa.Table('hosts', sa.MetaData(), autoload_with=bind)
            regex_to_json(hosts_table)

            # Drop old columns if they exist
            if 'noise_setting' in existing_columns:
                batch_op.drop_column('noise_setting')

            if 'fragment_setting' in existing_columns:
                batch_op.drop_column('fragment_setting')
            
            session.commit()
    finally:
        session.close()


def downgrade() -> None:
    bind = op.get_bind()
    
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('hosts')]
    
    # If both target columns already exist, skip the migration entirely
    if 'noise_setting' in existing_columns and 'fragment_setting' in existing_columns:
        return
    
    session = Session(bind=bind)
    
    def json_to_regex(table: sa.Table):
        # Only query columns that exist
        columns_to_query = [table.c.id]
        if 'fragment_settings' in existing_columns:
            columns_to_query.append(table.c.fragment_settings)
        if 'noise_settings' in existing_columns:
            columns_to_query.append(table.c.noise_settings)
            
        for row in session.query(*columns_to_query).all():
            updates = {}
            
            if hasattr(row, 'fragment_settings') and row.fragment_settings:
                fragment_json = row.fragment_settings
                fragment_regex = sa.null()
                
                # Convert fragment JSON back to regex
                if fragment_json and 'xray' in fragment_json:
                    xray = fragment_json['xray']
                    if all(k in xray for k in ['length', 'interval', 'packets']):
                        fragment_regex = f"{xray['length']},{xray['interval']},{xray['packets']}"
                        updates['fragment_setting'] = fragment_regex
            
            if hasattr(row, 'noise_settings') and row.noise_settings:
                noise_json = row.noise_settings
                noise_regex = sa.null()
                
                # Convert noise JSON back to regex
                if noise_json and 'xray' in noise_json and isinstance(noise_json['xray'], list):
                    noise_parts = []
                    for noise in noise_json['xray']:
                        if all(k in noise for k in ['type', 'packet', 'delay']):
                            noise_parts.append(f"{noise['type']}:{noise['packet']},{noise['delay']}")
                    
                    if noise_parts:
                        noise_regex = "&".join(noise_parts)
                        updates['noise_setting'] = noise_regex
            
            if updates:
                session.execute(
                    table.update().where(table.c.id == row.id).values(**updates)
                )
    
    # Add old string columns
    if 'fragment_setting' not in existing_columns:
        op.add_column('hosts', sa.Column('fragment_setting', sa.String(255), nullable=True))
    
    if 'noise_setting' not in existing_columns:
        op.add_column('hosts', sa.Column('noise_setting', sa.String(255), nullable=True))
    
    try:
        with op.batch_alter_table('hosts') as batch_op:
            hosts_table = sa.Table('hosts', sa.MetaData(), autoload_with=bind)
            json_to_regex(hosts_table)
            
            # Drop JSON columns if they exist
            if 'fragment_settings' in existing_columns:
                batch_op.drop_column('fragment_settings')
            
            if 'noise_settings' in existing_columns:
                batch_op.drop_column('noise_settings')
            
            session.commit()
    finally:
        session.close()
