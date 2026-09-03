import fs, re
p = ".env.example"
if fs.existsSync(p):
    with open(p, "r", encoding="utf-8") as f:
        s = f.read()
    s2 = re.sub(r"pat[A-Za-z0-9_]+\.[A-Za-z0-9_]+", "pat_REPLACE_WITH_YOUR_TOKEN", s)
    if s2 != s:
        with open(p, "w", encoding="utf-8", newline="") as f:
            f.write(s2)
