import re

def check_length(content, max_length=100):
    """
    检查生成的正文字数是否超过限制。
    中文字符计为1，英文字符和标点也计为1。
    忽略空格和换行。
    """
    # 移除空格和换行符，以更准确地计算实际字符数
    cleaned_content = re.sub(r'\s+', '', content)

    current_length = len(cleaned_content)

    if current_length > max_length:
        return False, f"内容超长：当前字数为 {current_length}，超过了最大限制 {max_length} 字。请重新精简内容。"

    return True, f"字数检查通过：当前字数为 {current_length}。"

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # 如果从命令行传入了文本，则使用传入的文本
        text = sys.argv[1]
    else:
        # 否则使用一个示例进行测试
        text = "这是一个测试文本，用于检查字数统计功能是否正常工作。在这个文本中，我们混合了中英文，比如Hello World，以及一些标点符号！@#￥%……&*"

    passed, message = check_length(text, 100)
    print(message)
    if not passed:
        sys.exit(1)
    sys.exit(0)
