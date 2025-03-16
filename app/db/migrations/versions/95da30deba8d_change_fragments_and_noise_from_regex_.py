"""change fragments and noise from regex to json

Revision ID: 95da30deba8d
Revises: eaa9f30f983e
Create Date: 2025-02-26 21:54:13.977279

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session


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
        for row in session.query(table.c.id, table.c.fragment_setting, table.c.noise_setting).all():
            fragment: str = row.fragment_setting
            noises: str = row.noise_setting
            fragment_json = sa.null()
            noises_settings_json = sa.null()
            if fragment:
                length, interval, packets = fragment.split(",")
                fragment_json = {"xray": {"packets": packets, "length": length, "interval": interval}}
            if noises:
                sn = noises.split("&")
                noises_settings_json = {"xray": []}
                for n in sn:
                    try:
                        tp, delay = n.split(",")
                        _type, packet = tp.split(":")
                        noises_settings_json["xray"].append(
                            {"type": _type, "packet": packet, "delay": delay})
                    except ValueError:
                        pass

            session.execute(
                table.update().where(table.c.id == row.id).values(
                    fragment_settings_temp=fragment_json, noise_settings_temp=noises_settings_json)
            )
    
    # Only add columns if they don't exist
    if 'noise_settings_temp' not in existing_columns:
        op.add_column('hosts', sa.Column('noise_settings_temp', sa.JSON(none_as_null=True), nullable=True))
    
    if 'fragment_settings_temp' not in existing_columns:
        op.add_column('hosts', sa.Column('fragment_settings_temp', sa.JSON(none_as_null=True), nullable=True))

    try:
        with op.batch_alter_table('hosts') as batch_op:
            hosts_table = sa.Table('hosts', sa.MetaData(), autoload_with=bind)
            regex_to_json(hosts_table)

            # Check if original columns still exist before dropping
            if 'noise_setting' in existing_columns:
                batch_op.drop_column('noise_setting')
                batch_op.alter_column('noise_settings_temp', new_column_name='noise_settings')

            if 'fragment_setting' in existing_columns:
                batch_op.drop_column('fragment_setting')
                batch_op.alter_column('fragment_settings_temp', new_column_name='fragment_settings')
            
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
        for row in session.query(table.c.id, table.c.fragment_settings, table.c.noise_settings).all():
            fragment_json = row.fragment_settings
            noise_json = row.noise_settings
            
            fragment_regex = sa.null()
            noise_regex = sa.null()
            
            # Convert fragment JSON back to regex
            if fragment_json and 'xray' in fragment_json:
                xray = fragment_json['xray']
                if all(k in xray for k in ['length', 'interval', 'packets']):
                    fragment_regex = f"{xray['length']},{xray['interval']},{xray['packets']}"
            
            # Convert noise JSON back to regex
            if noise_json and 'xray' in noise_json and isinstance(noise_json['xray'], list):
                noise_parts = []
                for noise in noise_json['xray']:
                    if all(k in noise for k in ['type', 'packet', 'delay']):
                        noise_parts.append(f"{noise['type']}:{noise['packet']},{noise['delay']}")
                
                if noise_parts:
                    noise_regex = "&".join(noise_parts)
            
            session.execute(
                table.update().where(table.c.id == row.id).values(
                    fragment_setting_temp=fragment_regex, noise_setting_temp=noise_regex)
            )
    
    # Only add temporary columns if they don't exist
    if 'fragment_setting_temp' not in existing_columns:
        op.add_column('hosts', sa.Column('fragment_setting_temp', sa.String(255), nullable=True))
    
    if 'noise_setting_temp' not in existing_columns:
        op.add_column('hosts', sa.Column('noise_setting_temp', sa.String(255), nullable=True))
    
    try:
        with op.batch_alter_table('hosts') as batch_op:
            hosts_table = sa.Table('hosts', sa.MetaData(), autoload_with=bind)
            json_to_regex(hosts_table)
            
            # Check if JSON columns exist before dropping
            if 'fragment_settings' in existing_columns:
                batch_op.drop_column('fragment_settings')
                batch_op.alter_column('fragment_setting_temp', new_column_name='fragment_setting')
            
            if 'noise_settings' in existing_columns:
                batch_op.drop_column('noise_settings')
                batch_op.alter_column('noise_setting_temp', new_column_name='noise_setting')
            
            session.commit()
    finally:
        session.close()
