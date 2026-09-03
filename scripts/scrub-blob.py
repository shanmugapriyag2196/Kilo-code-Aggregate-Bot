#!/usr/bin/env python
import sys, re
# Reads blob from stdin, writes scrubbed blob to stdout
data = sys.stdin.read()
sys.stdout.write(re.sub(r"pat[A-Za-z0-9_]+\.[A-Za-z0-9_]+", "pat_REPLACE_WITH_YOUR_TOKEN", data))
