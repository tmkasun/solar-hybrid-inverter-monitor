#!/usr/bin/env bash

python3 -m gunicorn -w 1 -b 0.0.0.0 'app:app'