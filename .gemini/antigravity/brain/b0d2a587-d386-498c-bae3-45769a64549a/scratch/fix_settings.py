import os

file_path = r'c:\Users\shahb\myApplications\Trade Desk-CFD\app\(dashboard)\settings\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('+') or line.startswith('-'):
        # Only remove if it looks like a diff marker we injected
        # e.g. "+    const", "-            {autoExecEnabled && ("
        # But wait, some markers are inside strings potentially?
        # In our case, it seems most are at the start of the line.
        l = line[1:]
        new_lines.append(l)
    else:
        new_lines.append(line)

# Since we might have redundant blocks now, we should also look for specific redundancies if needed.
# But for now, let's just clean the prefixes.

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Cleaned diff markers from file.")
