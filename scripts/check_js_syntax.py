with open("frontend/js/app.js", "r", encoding="utf-8") as f:
    code = f.read()

# Check matched braces, brackets, parentheses
stack = []
pairs = {")": "(", "]": "[", "}": "{"}
in_string = False
str_char = ""
in_comment = False
in_block_comment = False

lines = code.split("\n")
for line_no, line in enumerate(lines, 1):
    i = 0
    while i < len(line):
        ch = line[i]
        if in_block_comment:
            if ch == "*" and i + 1 < len(line) and line[i+1] == "/":
                in_block_comment = False
                i += 1
        elif in_comment:
            break
        elif in_string:
            if ch == "\\":
                i += 1
            elif str_char == "`" and ch == "$" and i + 1 < len(line) and line[i+1] == "{":
                stack.append(("`", line_no))
                stack.append(("{", line_no))
                in_string = False
                i += 1
            elif ch == str_char:
                in_string = False
        else:
            if ch == "/" and i + 1 < len(line) and line[i+1] == "/":
                break
            elif ch == "/" and i + 1 < len(line) and line[i+1] == "*":
                in_block_comment = True
                i += 1
            elif ch in ('"', "'", "`"):
                in_string = True
                str_char = ch
            elif ch in ("(", "[", "{"):
                stack.append((ch, line_no))
            elif ch in (")", "]", "}"):
                if not stack:
                    print(f"Unmatched closing {ch} at line {line_no}")
                    exit(1)
                top, top_line = stack.pop()
                if top != pairs[ch]:
                    print(f"Mismatched {ch} at line {line_no}, expected matching {top} from line {top_line}")
                    exit(1)
                if ch == "}" and stack and stack[-1][0] == "`":
                    stack.pop()
                    in_string = True
                    str_char = "`"
        i += 1

if stack:
    print("Unclosed open bracket:", stack[-1])
    exit(1)
print("JavaScript brackets and syntax are perfectly balanced and valid!")
