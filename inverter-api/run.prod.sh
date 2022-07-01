#!/usr/bin/env bash

# nohup python3 -m gunicorn -w 1 -b 0.0.0.0 'app:app' &
python3 -m gunicorn -w 1 -b 0.0.0.0 'app:app'