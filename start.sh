#!/bin/bash
python -m alembic upgrade head
python main.py